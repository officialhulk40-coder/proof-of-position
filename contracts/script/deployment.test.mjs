// Run: node --test contracts/script/deployment.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IDENTITY_REGISTRY,
  PROBE_SELECTORS,
  REPUTATION_REGISTRY,
  SAMPLE_TOKENS,
  SELECTORS,
  checkDeployment,
  decodeAddressWord,
  deploymentFromBroadcast,
  encodeAddressArg,
  probeTokens,
} from "./deployment.mjs";

const REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
const OWNER = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const TX = "0xf1625120da4a5d2abc50a211bbdbcbd358255599546cea325c5b513950954cb9";

function broadcastFixture(overrides = {}) {
  return {
    transactions: [
      {
        hash: TX,
        transactionType: "CREATE",
        contractName: "CallRegistry",
        contractAddress: REGISTRY,
        transaction: { from: OWNER, chainId: "0x38" },
      },
    ],
    receipts: [{ status: "0x1", blockNumber: "0x7842390", contractAddress: REGISTRY, transactionHash: TX }],
    chain: 56,
    ...overrides,
  };
}

const word = (hex) => `0x${hex.replace(/^0x/, "").padStart(64, "0")}`;

function fakeRpc(answers) {
  return async (_url, init) => {
    const { params } = JSON.parse(init.body);
    const data = params[0].data;
    if (!(data in answers)) return { json: async () => ({ jsonrpc: "2.0", id: 1, error: { message: `unexpected ${data}` } }) };
    return { json: async () => ({ jsonrpc: "2.0", id: 1, result: answers[data] }) };
  };
}

function healthyAnswers({ tokenModels = true } = {}) {
  const answers = {
    [SELECTORS.identityRegistry]: word(IDENTITY_REGISTRY.toLowerCase()),
    [SELECTORS.reputationRegistry]: word(REPUTATION_REGISTRY.toLowerCase()),
    [SELECTORS.owner]: word(OWNER),
    [SELECTORS.callCount]: word("3"),
  };
  if (tokenModels) {
    for (const token of SAMPLE_TOKENS) {
      answers[SELECTORS.tokenModel + encodeAddressArg(token.address)] = word(token.model.toString(16));
    }
  }
  return answers;
}

test("deploymentFromBroadcast extracts the registry record", () => {
  const record = deploymentFromBroadcast(broadcastFixture());
  assert.deepEqual(record, {
    chainId: 56,
    callRegistry: REGISTRY,
    deployTx: TX,
    deployBlock: 126100368,
    owner: OWNER,
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY,
  });
});

test("deploymentFromBroadcast rejects a failed deploy and the wrong chain", () => {
  const failed = broadcastFixture();
  failed.receipts[0].status = "0x0";
  assert.throws(() => deploymentFromBroadcast(failed), /failed/);
  assert.throws(() => deploymentFromBroadcast(broadcastFixture({ chain: 97 })), /expected chain 56/);
});

test("address helpers round-trip", () => {
  assert.equal(encodeAddressArg("0xABC"), "abc".padStart(64, "0"));
  assert.equal(decodeAddressWord(word(OWNER)), OWNER);
});

test("checkDeployment passes on a healthy registry, tokens included", async () => {
  const record = deploymentFromBroadcast(broadcastFixture());
  const result = await checkDeployment(record, { rpcUrl: "http://rpc", fetchImpl: fakeRpc(healthyAnswers()), tokens: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
  assert.equal(result.callCount, 3n);
});

test("checkDeployment reports a wrong owner and an unlisted token", async () => {
  const record = deploymentFromBroadcast(broadcastFixture());
  const answers = healthyAnswers();
  answers[SELECTORS.owner] = word("0x000000000000000000000000000000000000dead");
  answers[SELECTORS.tokenModel + encodeAddressArg(SAMPLE_TOKENS[5].address)] = word("0");
  const result = await checkDeployment(record, { rpcUrl: "http://rpc", fetchImpl: fakeRpc(answers), tokens: true });
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 2);
  assert.match(result.problems[0], /owner is 0x000000000000000000000000000000000000dead/);
  assert.match(result.problems[1], /NVDAx tokenModel is 0, want 2/);
});

function fakeBatchRpc({ revertFor = new Set(), rateLimitFirst = false } = {}) {
  const calls = { batches: 0, sizes: [] };
  let limited = rateLimitFirst;
  const fetchImpl = async (_url, init) => {
    const payload = JSON.parse(init.body);
    calls.batches += 1;
    calls.sizes.push(payload.length);
    if (limited) {
      limited = false;
      return { json: async () => [{ jsonrpc: "2.0", id: null, error: { message: "method eth_call in batch triggered rate limit" } }] };
    }
    return {
      json: async () =>
        payload.map((request) =>
          revertFor.has(request.params[0].to)
            ? { jsonrpc: "2.0", id: request.id, error: { message: "execution reverted: 0x" } }
            : { jsonrpc: "2.0", id: request.id, result: word("0") },
        ),
    };
  };
  return { fetchImpl, calls };
}

const noSleep = async () => {};

test("probeTokens batches by 20 and uses sharesOf for XSTOCK", async () => {
  const plain = Array.from({ length: 25 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}`);
  const xstock = ["0x00000000000000000000000000000000000000aa"];
  const seen = [];
  const { fetchImpl, calls } = fakeBatchRpc();
  const spying = async (url, init) => {
    seen.push(...JSON.parse(init.body).map((request) => request.params[0].data.slice(0, 10)));
    return fetchImpl(url, init);
  };
  const result = await probeTokens({ plain, xstock }, { rpcUrl: "http://rpc", fetchImpl: spying, sleep: noSleep });
  assert.deepEqual(result, { probed: 26, failed: [] });
  assert.deepEqual(calls.sizes, [20, 6]);
  assert.equal(seen.filter((selector) => selector === PROBE_SELECTORS.balanceOf).length, 25);
  assert.equal(seen.filter((selector) => selector === PROBE_SELECTORS.sharesOf).length, 1);
});

test("probeTokens reports reverting tokens and retries a rate-limited batch", async () => {
  const bad = "0x00000000000000000000000000000000000000bb";
  const { fetchImpl, calls } = fakeBatchRpc({ revertFor: new Set([bad]), rateLimitFirst: true });
  const result = await probeTokens(
    { plain: ["0x00000000000000000000000000000000000000aa"], xstock: [bad] },
    { rpcUrl: "http://rpc", fetchImpl, sleep: noSleep },
  );
  assert.equal(calls.batches, 2);
  assert.equal(result.probed, 2);
  assert.deepEqual(result.failed, [{ address: bad, model: "XSTOCK", reason: "execution reverted: 0x" }]);
});
