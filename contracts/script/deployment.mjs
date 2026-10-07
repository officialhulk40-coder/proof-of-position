#!/usr/bin/env node
// CallRegistry deployment record + live on-chain check (BSC mainnet).
//   node contracts/script/deployment.mjs record          writes deployments/bsc-mainnet.json from forge's broadcast log
//   node contracts/script/deployment.mjs check           verifies the recorded registry on chain
//   node contracts/script/deployment.mjs check --tokens  also verifies the token list on six sample tokens
//   node contracts/script/deployment.mjs probe-tokens    read-only: every token in script/data/tokens.json answers its balance getter
// RPC: first entry of BSC_RPC_URLS, else https://bsc-dataseed.bnbchain.org
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
export const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
export const DEFAULT_RPC_URL = "https://bsc-dataseed.bnbchain.org";

// 4-byte selectors (keccak256 of the signature), computed with viem toFunctionSelector.
export const SELECTORS = {
  identityRegistry: "0x134e18f4",
  reputationRegistry: "0xc8db44e3",
  owner: "0x8da5cb5b",
  callCount: "0x4b28f9a2",
  tokenModel: "0xe1542ba6",
};

// Read-only balance getters probed per model (PLAIN: balanceOf, XSTOCK: sharesOf).
export const PROBE_SELECTORS = { balanceOf: "0x70a08231", sharesOf: "0xf5eb42dc" };
export const PROBE_HOLDER = "0x000000000000000000000000000000000000dead";

// BalanceModel ordinals: 1 = PLAIN, 2 = XSTOCK.
export const SAMPLE_TOKENS = [
  { symbol: "NVDAB", address: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436", model: 1 },
  { symbol: "TSLAB", address: "0x5b1910eaad6450e50f816082aa078c41f10c292f", model: 1 },
  { symbol: "AAPLB", address: "0x431a3bee82e2ca41e49895cbece5bb0f76a89b7a", model: 1 },
  { symbol: "SPYB", address: "0x7138b48df7d98d7e3cc221bfe7192d0a178182d8", model: 1 },
  { symbol: "NVDAon", address: "0xa9ee28c80f960b889dfbd1902055218cba016f75", model: 1 },
  { symbol: "NVDAx", address: "0xc845b2894dbddd03858fd2d643b4ef725fe0849d", model: 2 },
];

const contractsDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(contractsDir, "..");
export const BROADCAST_PATH = join(contractsDir, "broadcast", "DeployCallRegistry.s.sol", "56", "run-latest.json");
export const DEPLOYMENT_PATH = join(repoRoot, "deployments", "bsc-mainnet.json");
export const TOKENS_PATH = join(contractsDir, "script", "data", "tokens.json");

/** Extracts the CallRegistry deployment from forge's run-latest.json. */
export function deploymentFromBroadcast(broadcast) {
  if (broadcast.chain !== 56) throw new Error(`expected chain 56, got ${broadcast.chain}`);
  const tx = broadcast.transactions.find((t) => t.transactionType === "CREATE" && t.contractName === "CallRegistry");
  if (!tx) throw new Error("no CallRegistry CREATE transaction in the broadcast log");
  const receipt = broadcast.receipts.find((r) => r.transactionHash === tx.hash);
  if (!receipt) throw new Error(`no receipt for ${tx.hash}`);
  if (receipt.status !== "0x1") throw new Error(`deploy transaction ${tx.hash} failed`);
  return {
    chainId: 56,
    callRegistry: tx.contractAddress.toLowerCase(),
    deployTx: tx.hash,
    deployBlock: Number(BigInt(receipt.blockNumber)),
    owner: tx.transaction.from.toLowerCase(),
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY,
  };
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A whole batch failed when the reply is not an array, or is a single error with id null (rate limit). */
function isBatchFailure(body) {
  if (!Array.isArray(body)) return true;
  return body.length === 1 && body[0]?.id === null && body[0]?.error !== undefined;
}

export function encodeAddressArg(address) {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

export function decodeAddressWord(hexWord) {
  return `0x${hexWord.slice(-40)}`.toLowerCase();
}

export async function ethCall(rpcUrl, to, data, fetchImpl = fetch) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  const body = await response.json();
  if (body.error) throw new Error(`eth_call ${data.slice(0, 10)} failed: ${body.error.message}`);
  return body.result;
}

/** Reads the deployed registry back from chain and compares it with the record. */
export async function checkDeployment(record, { rpcUrl = DEFAULT_RPC_URL, fetchImpl = fetch, tokens = false } = {}) {
  const problems = [];
  const read = (data) => ethCall(rpcUrl, record.callRegistry, data, fetchImpl);
  const identity = decodeAddressWord(await read(SELECTORS.identityRegistry));
  if (identity !== IDENTITY_REGISTRY.toLowerCase()) problems.push(`identityRegistry is ${identity}`);
  const reputation = decodeAddressWord(await read(SELECTORS.reputationRegistry));
  if (reputation !== REPUTATION_REGISTRY.toLowerCase()) problems.push(`reputationRegistry is ${reputation}`);
  const owner = decodeAddressWord(await read(SELECTORS.owner));
  if (owner !== record.owner.toLowerCase()) problems.push(`owner is ${owner}, record says ${record.owner}`);
  const callCount = BigInt(await read(SELECTORS.callCount));
  if (tokens) {
    for (const token of SAMPLE_TOKENS) {
      const model = Number(BigInt(await read(SELECTORS.tokenModel + encodeAddressArg(token.address))));
      if (model !== token.model) problems.push(`${token.symbol} tokenModel is ${model}, want ${token.model}`);
    }
  }
  return { ok: problems.length === 0, problems, callCount };
}

/**
 * Probes every token with JSON-RPC batches of batchSize eth_calls (public BSC RPCs reject batches of 50
 * with "method eth_call in batch triggered rate limit"; 20 is accepted). A token fails when its getter
 * returns no 32-byte word. A batch-level error is retried after a pause.
 */
export async function probeTokens(
  tokens,
  { rpcUrl = DEFAULT_RPC_URL, fetchImpl = fetch, batchSize = 20, pauseMs = 300, sleep = defaultSleep } = {},
) {
  const jobs = [
    ...tokens.plain.map((address) => ({ address, model: "PLAIN" })),
    ...tokens.xstock.map((address) => ({ address, model: "XSTOCK" })),
  ];
  const failed = [];
  for (let start = 0; start < jobs.length; start += batchSize) {
    const slice = jobs.slice(start, start + batchSize);
    const payload = slice.map((job, offset) => ({
      jsonrpc: "2.0",
      id: start + offset,
      method: "eth_call",
      params: [
        {
          to: job.address,
          data: (job.model === "XSTOCK" ? PROBE_SELECTORS.sharesOf : PROBE_SELECTORS.balanceOf) + encodeAddressArg(PROBE_HOLDER),
        },
        "latest",
      ],
    }));
    let body = null;
    for (let attempt = 0; attempt < 3 && isBatchFailure(body); attempt++) {
      if (attempt > 0) await sleep(1000 * attempt);
      const response = await fetchImpl(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      body = await response.json();
    }
    if (start + batchSize < jobs.length) await sleep(pauseMs);
    const replies = new Map((Array.isArray(body) ? body : []).map((reply) => [reply.id, reply]));
    slice.forEach((job, offset) => {
      const reply = replies.get(start + offset);
      if (!reply || reply.error || typeof reply.result !== "string" || reply.result.length < 66) {
        failed.push({ ...job, reason: reply?.error?.message ?? "no 32-byte result" });
      }
    });
  }
  return { probed: jobs.length, failed };
}

async function main(argv) {
  const command = argv[0];
  if (command === "record") {
    const record = deploymentFromBroadcast(JSON.parse(readFileSync(BROADCAST_PATH, "utf8")));
    mkdirSync(dirname(DEPLOYMENT_PATH), { recursive: true });
    writeFileSync(DEPLOYMENT_PATH, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`recorded CallRegistry ${record.callRegistry} (block ${record.deployBlock}) -> deployments/bsc-mainnet.json`);
    return 0;
  }
  if (command === "check") {
    const record = JSON.parse(readFileSync(DEPLOYMENT_PATH, "utf8"));
    const rpcUrl = (process.env.BSC_RPC_URLS ?? "").split(",")[0]?.trim() || DEFAULT_RPC_URL;
    const result = await checkDeployment(record, { rpcUrl, tokens: argv.includes("--tokens") });
    if (!result.ok) {
      console.log(`FAIL ${result.problems.join("; ")}`);
      return 1;
    }
    console.log(
      `PASS registry=${record.callRegistry} owner=${record.owner} callCount=${result.callCount}` +
        (argv.includes("--tokens") ? ` tokens=${SAMPLE_TOKENS.length}/6` : ""),
    );
    return 0;
  }
  if (command === "probe-tokens") {
    const rpcUrl = (process.env.BSC_RPC_URLS ?? "").split(",")[0]?.trim() || DEFAULT_RPC_URL;
    const result = await probeTokens(JSON.parse(readFileSync(TOKENS_PATH, "utf8")), { rpcUrl });
    for (const failure of result.failed) console.log(`failed ${failure.model} ${failure.address}: ${failure.reason}`);
    console.log(`${result.failed.length === 0 ? "PASS" : "FAIL"} probed=${result.probed} failed=${result.failed.length}`);
    return result.failed.length === 0 ? 0 : 1;
  }
  console.error("usage: node contracts/script/deployment.mjs record | check [--tokens] | probe-tokens");
  return 2;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`FAIL ${error.message}`);
      process.exit(1);
    },
  );
}
