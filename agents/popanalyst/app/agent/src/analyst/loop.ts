import { createBscPublicClient, createEventRecorder, createTelemetryRecorder, createW3wClient, walletProviderSigner, type TxSigner } from "@pop/core";
import { getWallet } from "@bnbagent/studio-runtime/wallet";
import { generateText } from "ai";
import { buildModel } from "../model.js";
import { buyWithX402 } from "../x402Buyer.js";
import { loadAnalystConfig, loopBlocker } from "./config.js";
import { runCycle, type CycleDeps } from "./cycle.js";
import { researchToken } from "./research.js";
import { writeThesis } from "./thesis.js";

export interface LoopHandle {
  stop(): void;
}

export interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  clearInterval: (handle: unknown) => void;
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

/** First run after `firstDelayMs`, then every `intervalMs`; a cycle still running makes the next one a no-op. Never throws. */
export function scheduleCycles(run: () => Promise<unknown>, options: { intervalMs: number; firstDelayMs: number; log: (line: string) => void; timers?: Timers }): LoopHandle {
  const timers = options.timers ?? realTimers;
  let running = false;
  const tick = async () => {
    if (running) {
      options.log("previous cycle still running; skipping this one");
      return;
    }
    running = true;
    try {
      await run();
    } catch (error) {
      options.log(`cycle failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      running = false;
    }
  };
  const first = timers.setTimeout(() => void tick(), options.firstDelayMs);
  const every = timers.setInterval(() => void tick(), options.intervalMs);
  return {
    stop() {
      timers.clearTimeout(first);
      timers.clearInterval(every);
    },
  };
}

/** The agent's own wallet (`getWallet()`, unlocked with WALLET_PASSWORD) as a pipeline signer. The key never leaves it. */
export function studioSigner(): TxSigner {
  const wallet = getWallet();
  if (!wallet.address) throw new Error("the agent wallet has no address: run `bag wallet new` first");
  return walletProviderSigner({ address: wallet.address as `0x${string}`, signTransaction: (tx) => wallet.signTransaction(tx) });
}

/**
 * Called once from unifiedMain.ts main(). Starts the research → thesis → buy → post loop when
 * ANALYST_ENABLED=true and the registry, agent id and API keys are set; otherwise logs why and returns null.
 */
export function startAnalystLoop(env: Record<string, string | undefined> = process.env, log: (line: string) => void = (line) => console.log(`[analyst] ${line}`)): LoopHandle | null {
  try {
    const config = loadAnalystConfig(env);
    const blocker = loopBlocker(config);
    if (blocker !== null || config.registry === null || config.agentId === null || config.w3w === null) {
      log(`loop not started: ${blocker ?? "incomplete config"}`);
      return null;
    }
    const onTiming = config.telemetryFile ? createTelemetryRecorder({ filePath: config.telemetryFile, service: "analyst" }) : undefined;
    const w3w = createW3wClient({ apiKey: config.w3w.apiKey, apiSecret: config.w3w.apiSecret, onTiming });
    let model: ReturnType<typeof buildModel> | undefined;
    const generate = async (prompt: string) => {
      model ??= buildModel();
      return (await generateText({ model, prompt })).text;
    };
    const deps: CycleDeps = {
      config: { ...config, registry: config.registry, agentId: config.agentId },
      w3w,
      client: createBscPublicClient(config.rpcUrls),
      signer: studioSigner(),
      research: (token) => researchToken({ w3w, buyWithX402 }, token),
      thesis: (research) => writeThesis(generate, research, config.holdHours),
      now: () => Date.now(),
      log,
      record: config.telemetryFile ? createEventRecorder({ filePath: config.telemetryFile, service: "analyst" }) : undefined,
    };
    log(`loop started: every ${config.intervalMinutes} min, ${config.buyUsdt} USDT per call, hold ${config.holdHours} h, watchlist ${config.watchlist.join(",")}`);
    return scheduleCycles(
      async () => {
        const result = await runCycle(deps);
        log(`cycle done: closed [${result.closed.join(",")}], posted ${result.posted ? `#${result.posted.callId} ${result.posted.symbol}` : "nothing"}${result.skipped.length > 0 ? `, skipped ${result.skipped.join("; ")}` : ""}`);
      },
      { intervalMs: config.intervalMinutes * 60_000, firstDelayMs: 15_000, log },
    );
  } catch (error) {
    log(`loop not started: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
