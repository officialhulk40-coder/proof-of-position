import { parseArgs } from "node:util";
import {
  ADDRESSES,
  createBscPublicClient,
  createEventRecorder,
  ERC20_ABI,
  formatUnits18,
  parseRpcUrls,
  requireTokenBySymbol,
  isFollowable,
  type RegistryReader,
} from "@pop/core";
import { bscAddress, cliCheck, createBawRunner, REQUIRED_BAW_VERSION, walletSettings, walletStatus, type BawRunner } from "./baw";
import { executeBuy, executeSell, WalletSignedOutError, type ExecutorDeps } from "./executor";
import { createFollower } from "./follower";
import { defaultStatePath, loadState } from "./state";

export const USAGE = `pop-follower — mirror Proof of Position callers with your Binance Agentic Wallet

Usage:
  pop-follower check
  pop-follower run --caller <0x…> [--caller <0x…>] --budget-usdt <n> [--max-open <n>] [--include-existing] [--once]
  pop-follower status
  pop-follower smoke --token <SYMBOL> --usdt <n> [--yes]

Environment: REGISTRY_ADDRESS (run), BSC_RPC_URLS, POP_FOLLOWER_STATE, DEVEX_TELEMETRY_FILE`;

export interface CliDeps {
  env: Record<string, string | undefined>;
  baw: BawRunner;
  chain: RegistryReader;
  out: (line: string) => void;
  err: (line: string) => void;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** `run` loops while this returns true (tests stop it). */
  keepRunning: () => boolean;
}

function defaultDeps(env: Record<string, string | undefined>): CliDeps {
  return {
    env,
    baw: createBawRunner(),
    chain: createBscPublicClient(parseRpcUrls(env.BSC_RPC_URLS)),
    out: (line) => console.log(line),
    err: (line) => console.error(line),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    keepRunning: () => true,
  };
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL = /^\d+(\.\d+)?$/;

function balanceReader(chain: RegistryReader) {
  return (token: `0x${string}`, owner: `0x${string}`) => chain.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [owner] });
}

async function check(deps: CliDeps): Promise<number> {
  const cli = await cliCheck(deps.baw, REQUIRED_BAW_VERSION);
  if (cli.needUpdateCli) {
    deps.err(`baw ${cli.currentCliVersion} is older than ${REQUIRED_BAW_VERSION}: npm install -g @binance/agentic-wallet@${REQUIRED_BAW_VERSION}`);
    return 1;
  }
  deps.out(`baw ${cli.currentCliVersion} ✓`);
  const status = await walletStatus(deps.baw);
  if (status !== "CONNECTED") {
    deps.err(`Agentic Wallet is ${status}: run \`baw auth signin\` and approve it in the Binance App`);
    return 1;
  }
  deps.out("wallet CONNECTED ✓");
  const settings = await walletSettings(deps.baw);
  if (settings.sessionExpireTime) {
    const hoursLeft = (Date.parse(settings.sessionExpireTime) - deps.now()) / 3_600_000;
    if (Number.isFinite(hoursLeft)) {
      const line = `session expires ${settings.sessionExpireTime} (${hoursLeft.toFixed(1)} h left)`;
      if (hoursLeft < 6) deps.err(`WARNING: ${line}; sign in again before a long run`);
      else deps.out(line);
    }
  }
  if (settings.quotaLeft !== undefined && settings.quotaLeft !== null) deps.out(`daily quota left: $${settings.quotaLeft}`);
  if (settings.tradeAllTokens === false) deps.err("WARNING: tradeAllTokens is off: the bStocks you follow must be on the wallet's allowed list (Binance App → Agentic Wallet → Settings)");
  const address = await bscAddress(deps.baw);
  deps.out(`BSC address ${address}`);
  const usdt = await balanceReader(deps.chain)(ADDRESSES.usdt, address);
  deps.out(`USDT balance ${formatUnits18(usdt, 4)}`);
  return 0;
}

async function run(deps: CliDeps, values: Record<string, string | boolean | string[] | undefined>): Promise<number> {
  const callers = (values.caller as string[] | undefined) ?? [];
  const budget = String(values["budget-usdt"] ?? "");
  const maxOpen = Number(values["max-open"] ?? "1");
  const registry = deps.env.REGISTRY_ADDRESS?.trim() ?? "";
  if (callers.length === 0 || callers.some((caller) => !ADDRESS.test(caller))) return usage(deps, "--caller <0x address> is required (repeatable)");
  if (!DECIMAL.test(budget) || Number(budget) <= 0) return usage(deps, "--budget-usdt <n> must be a positive amount");
  if (!Number.isInteger(maxOpen) || maxOpen < 1) return usage(deps, "--max-open must be a positive integer");
  if (!ADDRESS.test(registry)) return usage(deps, "set REGISTRY_ADDRESS to the deployed CallRegistry");

  const status = await walletStatus(deps.baw);
  if (status !== "CONNECTED") {
    deps.err(`Agentic Wallet is ${status}: run \`baw auth signin\` first`);
    return 2;
  }
  const wallet = await bscAddress(deps.baw);
  const telemetryFile = deps.env.DEVEX_TELEMETRY_FILE?.trim();
  const executor: ExecutorDeps = { baw: deps.baw, balanceOf: balanceReader(deps.chain), wallet, now: deps.now, sleep: deps.sleep, log: deps.out };
  const follower = await createFollower(
    {
      chain: deps.chain,
      registry: registry as `0x${string}`,
      executor,
      config: { callers, budgetUsdt: budget, maxOpen },
      statePath: defaultStatePath(deps.env),
      log: deps.out,
      record: telemetryFile ? createEventRecorder({ filePath: telemetryFile, service: "follower" }) : undefined,
    },
    { includeExisting: values["include-existing"] === true },
  );
  deps.out(`following ${callers.join(", ")} with ${budget} USDT per call (max ${maxOpen} open) from ${wallet}`);
  do {
    try {
      await follower.tick();
    } catch (error) {
      if (error instanceof WalletSignedOutError) {
        deps.err(error.message);
        return 2;
      }
      deps.err(`tick failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (values.once === true) break;
    await deps.sleep(1_000);
  } while (deps.keepRunning());
  return 0;
}

function status(deps: CliDeps): number {
  const path = defaultStatePath(deps.env);
  const state = loadState(path);
  if (state === null) {
    deps.out(`no state yet at ${path}`);
    return 0;
  }
  deps.out(`state ${path} · cursor #${state.cursor}`);
  for (const mirror of Object.values(state.mirrors).sort((a, b) => a.callId - b.callId)) {
    const detail = mirror.status === "failed" ? `error: ${mirror.error}` : mirror.status === "closed" ? `sold on ${mirror.exitReason} (order ${mirror.sellOrderId})` : `holding (order ${mirror.buyOrderId})`;
    deps.out(`#${mirror.callId} ${mirror.token} ${formatUnits18(BigInt(mirror.quantity), 6)} · ${mirror.status} · ${detail}`);
  }
  return 0;
}

/** S4 smoke: buy then sell a few cents of a bStock with the Agentic Wallet; prints latencies. Moves funds only with --yes. */
async function smoke(deps: CliDeps, values: Record<string, string | boolean | string[] | undefined>): Promise<number> {
  const symbol = String(values.token ?? "");
  const usdt = String(values.usdt ?? "");
  if (!DECIMAL.test(usdt) || Number(usdt) <= 0) return usage(deps, "--usdt <n> must be a positive amount");
  const token = requireTokenBySymbol(symbol);
  if (!isFollowable(token)) return usage(deps, `${symbol} is not a bStock`);
  if (values.yes !== true) {
    deps.out(`would buy ${usdt} USDT of ${token.symbol} (${token.address}) with the Agentic Wallet, then sell exactly what arrived; add --yes to do it`);
    return 0;
  }
  const wallet = await bscAddress(deps.baw);
  const executor: ExecutorDeps = { baw: deps.baw, balanceOf: balanceReader(deps.chain), wallet, now: deps.now, sleep: deps.sleep, log: deps.out };
  const bought = await executeBuy(executor, { token: token.address, budgetUsdt: usdt });
  deps.out(`BUY ${formatUnits18(bought.quantity, 6)} ${token.symbol}: order ${bought.orderId}, tx ${bought.txHash ?? "n/a"}, ${bought.finishedAt - bought.submittedAt} ms submit→FINISHED`);
  const sold = await executeSell(executor, { token: token.address, quantity: bought.quantity });
  deps.out(`SELL ${formatUnits18(bought.quantity, 6)} ${token.symbol}: order ${sold.orderId}, tx ${sold.txHash ?? "n/a"}, ${sold.finishedAt - sold.submittedAt} ms submit→FINISHED`);
  return 0;
}

function usage(deps: CliDeps, problem?: string): number {
  if (problem) deps.err(`error: ${problem}`);
  deps.err(USAGE);
  return 1;
}

export async function main(argv: readonly string[], overrides: Partial<CliDeps> = {}): Promise<number> {
  const deps: CliDeps = { ...defaultDeps(overrides.env ?? process.env), ...overrides };
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "help") {
    deps.out(USAGE);
    return 0;
  }
  let values: Record<string, string | boolean | string[] | undefined>;
  try {
    ({ values } = parseArgs({
      args: [...rest],
      options: {
        caller: { type: "string", multiple: true },
        "budget-usdt": { type: "string" },
        "max-open": { type: "string" },
        "include-existing": { type: "boolean" },
        once: { type: "boolean" },
        token: { type: "string" },
        usdt: { type: "string" },
        yes: { type: "boolean" },
      },
      strict: true,
    }));
  } catch (error) {
    return usage(deps, error instanceof Error ? error.message : String(error));
  }
  try {
    switch (command) {
      case "check":
        return await check(deps);
      case "run":
        return await run(deps, values);
      case "status":
        return status(deps);
      case "smoke":
        return await smoke(deps, values);
      default:
        return usage(deps, `unknown command ${command}`);
    }
  } catch (error) {
    deps.err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
