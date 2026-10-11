import { spawn } from "node:child_process";
import { z } from "zod";

/** One `baw` invocation's exit code and output. */
export interface BawResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs `baw <args>`. The real one spawns the CLI; tests pass a scripted fake. */
export type BawRunner = (args: readonly string[]) => Promise<BawResult>;

/** The Agentic Wallet CLI version this follower is written against (Wallet Skill 1.12.0). */
export const REQUIRED_BAW_VERSION = "1.10.0";

export class BawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BawError";
  }
}

const SAFE_ARG = /^[A-Za-z0-9_.:-]+$/;

/**
 * The real runner. On Windows `baw` is an npm `.cmd` shim, which only starts through a shell, so every
 * argument is first checked against a strict pattern (addresses, numbers, flags): nothing can be injected.
 */
export function createBawRunner(options: { bin?: string; timeoutMs?: number } = {}): BawRunner {
  const bin = options.bin ?? "baw";
  const timeoutMs = options.timeoutMs ?? 60_000;
  return (args) =>
    new Promise((resolve, reject) => {
      const unsafe = args.find((arg) => !SAFE_ARG.test(arg));
      if (unsafe !== undefined) {
        reject(new BawError(`refusing to pass an unsafe argument to baw: ${unsafe}`));
        return;
      }
      const child = spawn(bin, [...args], { shell: process.platform === "win32", windowsHide: true });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new BawError(`baw ${args.slice(0, 2).join(" ")} timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new BawError(`could not start ${bin}: ${error.message} (install it: npm install -g @binance/agentic-wallet@${REQUIRED_BAW_VERSION})`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });
}

/**
 * Order ids are 20-digit integers, past Number.MAX_SAFE_INTEGER: if baw ever prints one as a bare JSON
 * number, JSON.parse would round it. Quote every numeric orderId first so all digits survive.
 */
export function quoteOrderIds(raw: string): string {
  return raw.replace(/("orderId"\s*:\s*)(-?\d+)(?=\s*[,}\]])/g, '$1"$2"');
}

const envelopeSchema = z.object({ success: z.boolean(), data: z.unknown().optional() }).passthrough();

/** The CLI's own error text, verbatim: error.message / message / msg, else the whole JSON. */
function failureText(envelope: Record<string, unknown>): string {
  const error = envelope.error;
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message;
  if (typeof error === "string") return error;
  if (typeof envelope.message === "string") return envelope.message;
  if (typeof envelope.msg === "string") return envelope.msg;
  return JSON.stringify(envelope);
}

/** Runs `baw <args> --json`, requires `{ success: true }` and parses `data` with `schema`. */
export async function bawJson<T>(runner: BawRunner, args: readonly string[], schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const command = `baw ${args.join(" ")}`;
  const result = await runner([...args, "--json"]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(quoteOrderIds(result.stdout.trim()));
  } catch {
    throw new BawError(`${command} printed no JSON (exit ${result.code}): ${(result.stderr || result.stdout).trim().slice(0, 400)}`);
  }
  const envelope = envelopeSchema.safeParse(parsed);
  if (!envelope.success) throw new BawError(`${command} printed an unexpected JSON shape: ${result.stdout.trim().slice(0, 400)}`);
  if (!envelope.data.success) throw new BawError(`${command} failed: ${failureText(envelope.data)}`);
  return schema.parse(envelope.data.data);
}

const orderIdSchema = z.union([z.string(), z.number()]).transform((value) => String(value));

export async function cliCheck(runner: BawRunner, requiredVersion = REQUIRED_BAW_VERSION): Promise<{ currentCliVersion: string; needUpdateCli: boolean }> {
  return bawJson(runner, ["cli-check", "--required-version", requiredVersion], z.object({ currentCliVersion: z.string(), needUpdateCli: z.boolean() }));
}

/** `UNCONNECTED` (signed out), `CREATING` or `CONNECTED`. */
export async function walletStatus(runner: BawRunner): Promise<string> {
  return (await bawJson(runner, ["wallet", "status"], z.object({ status: z.string() }))).status;
}

/** The wallet's BSC (binanceChainId "56") address, lower-cased. */
export async function bscAddress(runner: BawRunner): Promise<`0x${string}`> {
  const data = await bawJson(runner, ["wallet", "address"], z.object({ addresses: z.array(z.object({ binanceChainId: z.string(), address: z.string() })) }));
  const bsc = data.addresses.find((entry) => entry.binanceChainId === "56");
  if (!bsc || !/^0x[0-9a-fA-F]{40}$/.test(bsc.address)) throw new BawError("baw wallet address returned no BSC (56) address");
  return bsc.address.toLowerCase() as `0x${string}`;
}

export const walletSettingsSchema = z
  .object({
    sessionExpireTime: z.string().nullish(),
    inactiveSignOutTime: z.string().nullish(),
    dailyLimit: z.number().nullish(),
    quotaLeft: z.number().nullish(),
    tradeAllTokens: z.boolean().nullish(),
    abnormalTxnHandling: z.string().nullish(),
  })
  .passthrough();
export type WalletSettings = z.infer<typeof walletSettingsSchema>;

export async function walletSettings(runner: BawRunner): Promise<WalletSettings> {
  return bawJson(runner, ["wallet", "settings"], walletSettingsSchema);
}

/** `LOCKED` while a tx is pending or a double-confirm waits in the Binance App; else `UNLOCKED`. */
export async function txLock(runner: BawRunner): Promise<string> {
  return (await bawJson(runner, ["wallet", "tx-lock", "--binanceChainId", "56"], z.object({ status: z.string() }))).status;
}

/** Submits a BSC market order and returns its orderId (submitted, not filled: poll getMarketOrder). */
export async function marketSwap(
  runner: BawRunner,
  params: { fromTokenQty: string; fromToken: string; toToken: string; slippage?: string; mev?: boolean },
): Promise<string> {
  const args = [
    "market-order",
    "swap",
    "--fromTokenQty",
    params.fromTokenQty,
    "--fromToken",
    params.fromToken,
    "--toToken",
    params.toToken,
    "--binanceChainId",
    "56",
    "--slippage",
    params.slippage ?? "auto",
    "--mev",
    String(params.mev ?? true),
  ];
  return (await bawJson(runner, args, z.object({ orderId: orderIdSchema }))).orderId;
}

export const marketOrderSchema = z
  .object({
    orderId: orderIdSchema,
    status: z.string(),
    txHash: z.string().nullish(),
    fromToken: z.string().nullish(),
    fromTokenQty: z.string().nullish(),
    toToken: z.string().nullish(),
    bookTime: z.string().nullish(),
  })
  .passthrough();
export type MarketOrder = z.infer<typeof marketOrderSchema>;

/** `baw market-order list --orderId <id>`: PENDING, FINISHED or FAILED (txHash may be null on FAILED). */
export async function getMarketOrder(runner: BawRunner, orderId: string): Promise<MarketOrder | null> {
  const data = await bawJson(runner, ["market-order", "list", "--orderId", orderId], z.object({ list: z.array(marketOrderSchema) }));
  return data.list.find((order) => order.orderId === orderId) ?? null;
}

/** "0.500000000000000000" and "0.5" are the same amount: drop leading/trailing zeros for comparison. */
function normalizeQty(qty: string): string {
  let value = qty.trim();
  if (value.includes(".")) value = value.replace(/0+$/, "").replace(/\.$/, "");
  value = value.replace(/^0+(?=\d)/, "");
  return value === "" ? "0" : value;
}

/**
 * Fallback when `--orderId <id>` misses (live: the swap returned an id the order list does not know):
 * lists recent BSC market orders for the pair and returns the newest one with the submitted amount.
 */
export async function findMarketOrder(
  runner: BawRunner,
  params: { fromToken: string; toToken: string; fromTokenQty: string; since: number; exclude?: ReadonlySet<string> },
): Promise<MarketOrder | null> {
  const args = [
    "market-order",
    "list",
    "--binanceChainId",
    "56",
    "--fromToken",
    params.fromToken,
    "--toToken",
    params.toToken,
    "--startTime",
    String(Math.max(0, Math.floor(params.since))),
    "--pageSize",
    "20",
  ];
  const data = await bawJson(runner, args, z.object({ list: z.array(marketOrderSchema) }));
  const qty = normalizeQty(params.fromTokenQty);
  const matches = data.list
    .map((order, index) => ({ order, index }))
    .filter(
      ({ order }) =>
        order.fromToken?.toLowerCase() === params.fromToken.toLowerCase() &&
        order.toToken?.toLowerCase() === params.toToken.toLowerCase() &&
        order.fromTokenQty != null &&
        normalizeQty(order.fromTokenQty) === qty &&
        !params.exclude?.has(order.orderId),
    );
  const time = (order: MarketOrder) => (order.bookTime ? Date.parse(order.bookTime) : Number.NaN);
  matches.sort((a, b) => {
    const ta = time(a.order);
    const tb = time(b.order);
    if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return tb - ta;
    return a.index - b.index;
  });
  return matches[0]?.order ?? null;
}
