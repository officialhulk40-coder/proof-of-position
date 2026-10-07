# Contracts Implementation Plan

**Goal:** Build, test, deploy and seed the single `CallRegistry` contract — "No position, no call." — on BSC mainnet.
**Architecture:** One immutable Solidity contract reads each caller's live balance of a listed tokenized stock (raw `balanceOf` for bStocks/Ondo, non-rebasing `sharesOf` for xStocks) to gate posts and compute HOLDING / TRIMMED / EXITED / CLOSED badges; anyone can make an exit permanent, and agent calls write ERC-8004 integrity feedback with the registry as the client. Tests run against mocks that mirror the ABIs verified on mainnet; deployment and token listing are human-gated.
**Tech Stack:** Solidity 0.8.28 (pinned), Foundry 1.8.5 (`forge`/`cast`/`anvil`), forge-std 1.16.0 via soldeer, Node ≥ 22.12 (wrapper script + `node:test`)
**Source spec:** docs/superpowers/specs/2026-10-06-proof-of-position-design.md

Execution notes (apply to every task in this plan):

- Run every command from the repository root. Each `Run:` line is one command that works unchanged in PowerShell and Git Bash.
- `node contracts/run-forge.mjs <forge args>` runs `forge` inside `contracts/` and first restores forge-std from `contracts/soldeer.lock` into the git-ignored `contracts/dependencies/` when it is missing. Never call `forge install`; never commit `contracts/dependencies/`, `contracts/out/`, `contracts/cache/` or `contracts/broadcast/`.
- When a step says "Replace the entire contents of", overwrite the file with exactly the block shown.
- Tasks marked **(HUMAN-GATED)** deploy or broadcast with a private key. Executors never run them; the user (or the gate-concierge with the user's per-gate consent) performs the steps. Keys are read only from environment variables (`DEPLOYER_PK`, `ETHERSCAN_API_KEY`); never write a key into any file, command history file or log.
- Cross-plan dependencies are written `Task <subsystem>:<N>`.

---

### Task 1: Scaffold the Foundry project, shared types and interfaces

**Files:**
- Create: `contracts/foundry.toml`
- Create: `contracts/remappings.txt`
- Create: `contracts/soldeer.lock`
- Create: `contracts/.gitignore`
- Create: `contracts/run-forge.mjs`
- Create: `contracts/src/CallTypes.sol`
- Create: `contracts/src/interfaces/IBalanceToken.sol`
- Create: `contracts/src/interfaces/IXStockShares.sol`
- Create: `contracts/src/interfaces/IAgentIdentityRegistry.sol`
- Create: `contracts/src/interfaces/IAgentReputationRegistry.sol`
- Test: `contracts/test/Scaffold.t.sol`

**Effort:** low
**Model tier:** fast
**Provides:** `node contracts/run-forge.mjs <forge args>`, `enum BalanceModel { UNLISTED, PLAIN, XSTOCK }`, `enum Status { HOLDING, TRIMMED, EXITED, CLOSED }`, `struct Call { address caller; address token; BalanceModel model; bool hasAgent; bool heldThrough; Status exitStatus; uint64 postedBlock; uint64 postedAt; uint64 closedBlock; uint64 exitBlock; uint256 agentId; uint256 declaredAmount; uint256 declaredBase; string note; }`, `interface IBalanceToken { function balanceOf(address holder) external view returns (uint256); }`, `interface IXStockShares { function sharesOf(address holder) external view returns (uint256); function getSharesByUnderlyingAmount(uint256 underlyingAmount) external view returns (uint256); }`, `interface IAgentIdentityRegistry { function getAgentWallet(uint256 agentId) external view returns (address); }`, `interface IAgentReputationRegistry { function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string calldata tag1, string calldata tag2, string calldata endpoint, string calldata feedbackURI, bytes32 feedbackHash) external; }`

- [ ] **Step 1: Write the failing test**

Create `contracts/test/Scaffold.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {BalanceModel, Status, Call} from "../src/CallTypes.sol";

contract ScaffoldTest is Test {
    function test_enumOrdinalsMatchTheSpec() public pure {
        assertEq(uint8(BalanceModel.UNLISTED), 0);
        assertEq(uint8(BalanceModel.PLAIN), 1);
        assertEq(uint8(BalanceModel.XSTOCK), 2);
        assertEq(uint8(Status.HOLDING), 0);
        assertEq(uint8(Status.TRIMMED), 1);
        assertEq(uint8(Status.EXITED), 2);
        assertEq(uint8(Status.CLOSED), 3);
    }

    function test_callStructDefaultsAreZero() public pure {
        Call memory c;
        assertEq(c.caller, address(0));
        assertEq(uint8(c.exitStatus), uint8(Status.HOLDING));
        assertEq(c.exitBlock, 0);
        assertEq(bytes(c.note).length, 0);
    }
}
```

- [ ] **Step 2: Create the Foundry configuration**

Create `contracts/foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
test = "test"
script = "script"
libs = ["dependencies"]
solc_version = "0.8.28"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200
via_ir = true
fs_permissions = [{ access = "read", path = "./script/data" }]

[fuzz]
runs = 256

[invariant]
runs = 64
depth = 32
fail_on_revert = false

[soldeer]
remappings_generate = false
remappings_regenerate = false
remappings_version = false
remappings_location = "txt"
recursive_deps = false

[dependencies]
forge-std = "1.16.0"
```

Create `contracts/remappings.txt`:

```text
forge-std/=dependencies/forge-std-1.16.0/src/
```

Create `contracts/soldeer.lock` (pins forge-std 1.16.0 by checksum):

```toml
version = 2

[[dependencies]]
name = "forge-std"
version = "1.16.0"
url = "https://soldeer-revisions.s3.amazonaws.com/forge-std/1_16_0_27-04-2026_06:23:43_forge-std-1.16.zip"
checksum = "3ebe6ca2011b1a11b0f3d4c2a53f58e4d149dc0c58a4052a39405391cd2ae8ce"
integrity = "c433748f09889d3e2b3090303f4bc03700b363bd952e22b1801db00cfac7b809"
```

Create `contracts/.gitignore`:

```text
# Foundry build output and caches
out/
cache/
# soldeer-installed dependencies (restored by run-forge.mjs from soldeer.lock)
dependencies/
# forge script broadcast logs stay local; deployments/bsc-mainnet.json is the committed record
broadcast/
```

Create `contracts/run-forge.mjs`:

```js
#!/usr/bin/env node
// Runs `forge <args>` inside contracts/, first restoring soldeer dependencies
// from soldeer.lock when they are missing (dependencies/ is git-ignored).
// Usage (from the repo root): node contracts/run-forge.mjs test --match-contract CallRegistryPostTest
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// realpathSync.native expands Windows 8.3 short names (e.g. ASUSTU~1); soldeer panics with
// "path should be a child of root" when the working directory is a short-name path.
const contractsDir = realpathSync.native(dirname(fileURLToPath(import.meta.url)));
const forgeStdDir = join(contractsDir, "dependencies", "forge-std-1.16.0");

function run(args) {
  const result = spawnSync("forge", args, { cwd: contractsDir, stdio: "inherit" });
  if (result.error) {
    console.error(`run-forge: could not start forge: ${result.error.message}`);
    process.exit(1);
  }
  return result.status ?? 1;
}

if (!existsSync(forgeStdDir)) {
  const status = run(["soldeer", "install"]);
  if (status !== 0) process.exit(status);
}

process.exit(run(process.argv.slice(2)));
```

- [ ] **Step 3: Run to confirm it fails**

Run: `node contracts/run-forge.mjs test --match-contract ScaffoldTest`
Expected: FAIL — the wrapper installs forge-std (first run only), then the compiler stops with `Error (6275): Source "src/CallTypes.sol" not found`

- [ ] **Step 4: Create the shared types and interfaces**

Create `contracts/src/CallTypes.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice How CallRegistry measures a holder's position in a listed token.
/// PLAIN: raw balanceOf (bStocks, Ondo). XSTOCK: non-rebasing sharesOf (xStocks).
enum BalanceModel {
    UNLISTED,
    PLAIN,
    XSTOCK
}

/// @notice A call's badge. HOLDING/TRIMMED/EXITED are live reads of the caller's balance; CLOSED is final.
enum Status {
    HOLDING,
    TRIMMED,
    EXITED,
    CLOSED
}

/// @notice One public LONG call. Field order is part of the ABI consumed by @pop/core.
struct Call {
    address caller;
    address token;
    BalanceModel model;
    bool hasAgent;
    bool heldThrough;
    Status exitStatus;
    uint64 postedBlock;
    uint64 postedAt;
    uint64 closedBlock;
    uint64 exitBlock;
    uint256 agentId;
    uint256 declaredAmount;
    uint256 declaredBase;
    string note;
}
```

Create `contracts/src/interfaces/IBalanceToken.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The only ERC-20 surface CallRegistry reads: the holder's raw balance.
interface IBalanceToken {
    function balanceOf(address holder) external view returns (uint256);
}
```

Create `contracts/src/interfaces/IXStockShares.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Rebasing xStocks (Backed) share accounting, verified on BSC mainnet (AAPLx, 2026-10-06).
/// balanceOf(holder) == sharesOf(holder) * multiplier / 1e18; sharesOf never rebases.
interface IXStockShares {
    function sharesOf(address holder) external view returns (uint256);
    function getSharesByUnderlyingAmount(uint256 underlyingAmount) external view returns (uint256);
}
```

Create `contracts/src/interfaces/IAgentIdentityRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice ERC-8004 IdentityRegistry v2.0.0 subset (BSC mainnet 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432).
interface IAgentIdentityRegistry {
    /// @dev Returns address(0) for unknown agent ids (no revert).
    function getAgentWallet(uint256 agentId) external view returns (address);
}
```

Create `contracts/src/interfaces/IAgentReputationRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice ERC-8004 ReputationRegistry v2.0.0 subset (BSC mainnet 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63).
/// @dev Reverts "Self-feedback not allowed" when msg.sender is the agent's owner or approved operator.
interface IAgentReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;
}
```

- [ ] **Step 5: Run to confirm it passes (gate)**

Run: `node contracts/run-forge.mjs test --match-contract ScaffoldTest`
Expected: PASS — `Suite result: ok. 2 passed; 0 failed`

- [ ] **Step 6: Commit (kernel-performed — no agent runs this)**

Message: `chore(contracts): scaffold foundry project, shared types and ERC-8004 interfaces`

---

### Task 2: ABI-faithful mocks for tokens and ERC-8004 registries

**Files:**
- Create: `contracts/test/mocks/MockPlainToken.sol`
- Create: `contracts/test/mocks/MockBStock.sol`
- Create: `contracts/test/mocks/MockXStock.sol`
- Create: `contracts/test/mocks/MockIdentityRegistry.sol`
- Create: `contracts/test/mocks/MockReputationRegistry.sol`
- Create: `contracts/test/mocks/RevertingReputationRegistry.sol`
- Test: `contracts/test/Mocks.t.sol`

**Depends on:** Task 1
**Effort:** low
**Provides:** `contract MockPlainToken(string symbol_) { setBalance(address holder, uint256 amount); transfer(address to, uint256 amount); balanceOf(address) }`, `contract MockBStock(string symbol_) is MockPlainToken { setUiMultiplier(uint256 multiplier); balanceOfUI(address holder) }`, `contract MockXStock(string symbol_) { setMultiplier(uint256 newMultiplier); setShares(address holder, uint256 shares); sharesOf(address); balanceOf(address holder); getSharesByUnderlyingAmount(uint256); getUnderlyingAmountByShares(uint256) }`, `contract MockIdentityRegistry { setAgent(uint256 agentId, address owner_, address wallet); getAgentWallet(uint256 agentId); isAuthorizedOrOwner(address spender, uint256 agentId) }`, `contract MockReputationRegistry(MockIdentityRegistry identity_) { giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32); count(); entry(uint256 index) returns (Entry) }`, `contract RevertingReputationRegistry { giveFeedback(...) always reverts "registry down" }`
**Requires:** `node contracts/run-forge.mjs <forge args>`

- [ ] **Step 1: Write the failing test**

Create `contracts/test/Mocks.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockPlainToken} from "./mocks/MockPlainToken.sol";
import {MockBStock} from "./mocks/MockBStock.sol";
import {MockXStock} from "./mocks/MockXStock.sol";
import {MockIdentityRegistry} from "./mocks/MockIdentityRegistry.sol";
import {MockReputationRegistry} from "./mocks/MockReputationRegistry.sol";
import {RevertingReputationRegistry} from "./mocks/RevertingReputationRegistry.sol";

contract MocksTest is Test {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    function test_plainTokenTransferMovesBalance() public {
        MockPlainToken token = new MockPlainToken("NVDAon");
        token.setBalance(ALICE, 5e18);
        vm.prank(ALICE);
        token.transfer(BOB, 2e18);
        assertEq(token.balanceOf(ALICE), 3e18);
        assertEq(token.balanceOf(BOB), 2e18);
    }

    function test_bStockUiMultiplierDoesNotChangeRawBalance() public {
        MockBStock token = new MockBStock("NVDAB");
        token.setBalance(ALICE, 1e18);
        token.setUiMultiplier(1_000_778_223_752_807_865);
        assertEq(token.balanceOf(ALICE), 1e18);
        assertEq(token.balanceOfUI(ALICE), 1_000_778_223_752_807_865);
    }

    function test_xStockBalanceRebasesButSharesDoNot() public {
        MockXStock token = new MockXStock("AAPLx");
        token.setMultiplier(1_003_269_012_539_818_700);
        token.setShares(ALICE, 1e18);
        assertEq(token.sharesOf(ALICE), 1e18);
        assertEq(token.balanceOf(ALICE), 1_003_269_012_539_818_700);
        token.setMultiplier(2e18);
        assertEq(token.sharesOf(ALICE), 1e18);
        assertEq(token.balanceOf(ALICE), 2e18);
        assertEq(token.getSharesByUnderlyingAmount(4e18), 2e18);
    }

    function test_identityReturnsZeroWalletForUnknownAgent() public {
        MockIdentityRegistry identity = new MockIdentityRegistry();
        assertEq(identity.getAgentWallet(42), address(0));
        identity.setAgent(42, ALICE, BOB);
        assertEq(identity.getAgentWallet(42), BOB);
        assertTrue(identity.isAuthorizedOrOwner(ALICE, 42));
        assertFalse(identity.isAuthorizedOrOwner(BOB, 42));
    }

    function test_reputationRejectsSelfFeedbackAndRecordsOthers() public {
        MockIdentityRegistry identity = new MockIdentityRegistry();
        identity.setAgent(7, ALICE, ALICE);
        MockReputationRegistry reputation = new MockReputationRegistry(identity);

        vm.prank(ALICE);
        vm.expectRevert(bytes("Self-feedback not allowed"));
        reputation.giveFeedback(7, 100, 0, "integrity", "held", "", "", bytes32(uint256(1)));

        vm.prank(BOB);
        reputation.giveFeedback(7, 100, 0, "integrity", "held", "", "", bytes32(uint256(1)));
        assertEq(reputation.count(), 1);
        MockReputationRegistry.Entry memory e = reputation.entry(0);
        assertEq(e.client, BOB);
        assertEq(e.value, 100);
        assertEq(e.tag2, "held");
        assertEq(e.feedbackHash, bytes32(uint256(1)));
    }

    function test_revertingRegistryAlwaysReverts() public {
        RevertingReputationRegistry reputation = new RevertingReputationRegistry();
        vm.expectRevert(bytes("registry down"));
        reputation.giveFeedback(1, 0, 0, "integrity", "exited", "", "", bytes32(0));
    }
}
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node contracts/run-forge.mjs test --match-contract MocksTest`
Expected: FAIL — `Error (6275): Source "test/mocks/MockPlainToken.sol" not found`

- [ ] **Step 3: Create the mocks**

These mirror the behaviour verified on BSC mainnet on 2026-10-06: bStock raw `balanceOf` never rebases (`uiMultiplier` is display-only); xStocks `balanceOf = sharesOf × multiplier / 1e18` with `sharesOf` fixed; ERC-8004 v2.0.0 `getAgentWallet` returns `address(0)` for unknown ids and `giveFeedback` rejects the agent's owner ("Self-feedback not allowed").

Create `contracts/test/mocks/MockPlainToken.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Plain ERC-20 balance book (stands in for Ondo tokens and the raw side of bStocks).
contract MockPlainToken {
    string public symbol;
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;

    constructor(string memory symbol_) {
        symbol = symbol_;
    }

    function setBalance(address holder, uint256 amount) external {
        balanceOf[holder] = amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
```

Create `contracts/test/mocks/MockBStock.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockPlainToken} from "./MockPlainToken.sol";

/// @notice bStock shape: raw balanceOf never rebases; uiMultiplier only scales the display amount.
contract MockBStock is MockPlainToken {
    uint256 public uiMultiplier = 1e18;

    constructor(string memory symbol_) MockPlainToken(symbol_) {}

    function setUiMultiplier(uint256 multiplier) external {
        uiMultiplier = multiplier;
    }

    function balanceOfUI(address holder) external view returns (uint256) {
        return balanceOf[holder] * uiMultiplier / 1e18;
    }
}
```

Create `contracts/test/mocks/MockXStock.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Rebasing xStock shape (Backed): balanceOf = sharesOf * multiplier / 1e18, both rounding down.
contract MockXStock {
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public multiplier = 1e18;
    mapping(address => uint256) public sharesOf;

    constructor(string memory symbol_) {
        symbol = symbol_;
    }

    function setMultiplier(uint256 newMultiplier) external {
        multiplier = newMultiplier;
    }

    function setShares(address holder, uint256 shares) external {
        sharesOf[holder] = shares;
    }

    function balanceOf(address holder) external view returns (uint256) {
        return sharesOf[holder] * multiplier / 1e18;
    }

    function getSharesByUnderlyingAmount(uint256 underlyingAmount) external view returns (uint256) {
        return underlyingAmount * 1e18 / multiplier;
    }

    function getUnderlyingAmountByShares(uint256 shares) external view returns (uint256) {
        return shares * multiplier / 1e18;
    }
}
```

Create `contracts/test/mocks/MockIdentityRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice ERC-8004 IdentityRegistry v2.0.0 behaviour that CallRegistry depends on.
contract MockIdentityRegistry {
    mapping(uint256 => address) public ownerOfAgent;
    mapping(uint256 => address) internal _wallets;

    function setAgent(uint256 agentId, address owner_, address wallet) external {
        ownerOfAgent[agentId] = owner_;
        _wallets[agentId] = wallet;
    }

    /// @dev Unknown ids return address(0), exactly like the deployed registry.
    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _wallets[agentId];
    }

    /// @dev Reverts for unknown ids (the deployed registry reverts ERC721NonexistentToken).
    function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool) {
        address agentOwner = ownerOfAgent[agentId];
        require(agentOwner != address(0), "ERC721NonexistentToken");
        return spender == agentOwner;
    }
}
```

Create `contracts/test/mocks/MockReputationRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockIdentityRegistry} from "./MockIdentityRegistry.sol";

/// @notice ERC-8004 ReputationRegistry v2.0.0 giveFeedback rules, recording every accepted entry.
contract MockReputationRegistry {
    struct Entry {
        uint256 agentId;
        address client;
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
    }

    MockIdentityRegistry public immutable identity;
    Entry[] internal _entries;

    constructor(MockIdentityRegistry identity_) {
        identity = identity_;
    }

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        require(valueDecimals <= 18, "too many decimals");
        require(!identity.isAuthorizedOrOwner(msg.sender, agentId), "Self-feedback not allowed");
        _entries.push(Entry(agentId, msg.sender, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash));
    }

    function count() external view returns (uint256) {
        return _entries.length;
    }

    function entry(uint256 index) external view returns (Entry memory) {
        return _entries[index];
    }
}
```

Create `contracts/test/mocks/RevertingReputationRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice A reputation registry that always reverts, to prove feedback failures never block CallRegistry.
contract RevertingReputationRegistry {
    function giveFeedback(uint256, int128, uint8, string calldata, string calldata, string calldata, string calldata, bytes32)
        external
        pure
    {
        revert("registry down");
    }
}
```

- [ ] **Step 4: Run to confirm it passes (gate)**

Run: `node contracts/run-forge.mjs test --match-contract MocksTest`
Expected: PASS — `Suite result: ok. 6 passed; 0 failed`

- [ ] **Step 5: Commit (kernel-performed — no agent runs this)**

Message: `test(contracts): add ABI-faithful token and ERC-8004 registry mocks`

---

### Task 3: CallRegistry core — ownership and the token list

**Files:**
- Create: `contracts/src/CallRegistry.sol`
- Create: `contracts/test/utils/RegistryFixture.sol`
- Test: `contracts/test/CallRegistryAdmin.t.sol`

**Depends on:** Task 1, Task 2
**Effort:** high
**Model tier:** top
**Provides:** `contract CallRegistry(address identityRegistry_, address reputationRegistry_, address initialOwner)`, `CallRegistry.setTokens(address[] calldata tokens, BalanceModel[] calldata models)`, `CallRegistry.transferOwnership(address newOwner)`, `CallRegistry.tokenModel(address token) returns (BalanceModel)`, `abstract contract RegistryFixture is Test`
**Requires:** `node contracts/run-forge.mjs <forge args>`, `enum BalanceModel { UNLISTED, PLAIN, XSTOCK }`, `enum Status { HOLDING, TRIMMED, EXITED, CLOSED }`, `struct Call { address caller; address token; BalanceModel model; bool hasAgent; bool heldThrough; Status exitStatus; uint64 postedBlock; uint64 postedAt; uint64 closedBlock; uint64 exitBlock; uint256 agentId; uint256 declaredAmount; uint256 declaredBase; string note; }`, `interface IBalanceToken { function balanceOf(address holder) external view returns (uint256); }`, `interface IXStockShares { function sharesOf(address holder) external view returns (uint256); function getSharesByUnderlyingAmount(uint256 underlyingAmount) external view returns (uint256); }`, `interface IAgentIdentityRegistry { function getAgentWallet(uint256 agentId) external view returns (address); }`, `interface IAgentReputationRegistry { function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string calldata tag1, string calldata tag2, string calldata endpoint, string calldata feedbackURI, bytes32 feedbackHash) external; }`, `contract MockPlainToken(string symbol_) { setBalance(address holder, uint256 amount); transfer(address to, uint256 amount); balanceOf(address) }`, `contract MockBStock(string symbol_) is MockPlainToken { setUiMultiplier(uint256 multiplier); balanceOfUI(address holder) }`, `contract MockXStock(string symbol_) { setMultiplier(uint256 newMultiplier); setShares(address holder, uint256 shares); sharesOf(address); balanceOf(address holder); getSharesByUnderlyingAmount(uint256); getUnderlyingAmountByShares(uint256) }`, `contract MockIdentityRegistry { setAgent(uint256 agentId, address owner_, address wallet); getAgentWallet(uint256 agentId); isAuthorizedOrOwner(address spender, uint256 agentId) }`, `contract MockReputationRegistry(MockIdentityRegistry identity_) { giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32); count(); entry(uint256 index) returns (Entry) }`

The upstream signatures this task builds on, as they exist in the repo after Tasks 1–2:

```solidity
// contracts/src/CallTypes.sol
enum BalanceModel { UNLISTED, PLAIN, XSTOCK }
enum Status { HOLDING, TRIMMED, EXITED, CLOSED }
struct Call { address caller; address token; BalanceModel model; bool hasAgent; bool heldThrough; Status exitStatus; uint64 postedBlock; uint64 postedAt; uint64 closedBlock; uint64 exitBlock; uint256 agentId; uint256 declaredAmount; uint256 declaredBase; string note; }
// contracts/src/interfaces/*.sol
interface IBalanceToken { function balanceOf(address holder) external view returns (uint256); }
interface IXStockShares { function sharesOf(address holder) external view returns (uint256); function getSharesByUnderlyingAmount(uint256 underlyingAmount) external view returns (uint256); }
interface IAgentIdentityRegistry { function getAgentWallet(uint256 agentId) external view returns (address); }
interface IAgentReputationRegistry { function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string calldata tag1, string calldata tag2, string calldata endpoint, string calldata feedbackURI, bytes32 feedbackHash) external; }
// contracts/test/mocks/*.sol — MockPlainToken, MockBStock, MockXStock, MockIdentityRegistry, MockReputationRegistry (see Task 2)
```

- [ ] **Step 1: Write the shared fixture and the failing test**

Create `contracts/test/utils/RegistryFixture.sol` (shared by every later CallRegistry suite):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CallRegistry} from "../../src/CallRegistry.sol";
import {BalanceModel} from "../../src/CallTypes.sol";
import {MockPlainToken} from "../mocks/MockPlainToken.sol";
import {MockBStock} from "../mocks/MockBStock.sol";
import {MockXStock} from "../mocks/MockXStock.sol";
import {MockIdentityRegistry} from "../mocks/MockIdentityRegistry.sol";
import {MockReputationRegistry} from "../mocks/MockReputationRegistry.sol";

/// @notice Shared setup: a registry wired to mock ERC-8004 registries, four listed tokens,
/// one unlisted token, and agent #7 whose wallet is AGENT_WALLET.
abstract contract RegistryFixture is Test {
    uint256 internal constant AGENT_ID = 7;

    CallRegistry internal registry;
    MockIdentityRegistry internal identity;
    MockReputationRegistry internal reputation;

    MockBStock internal nvdab;
    MockBStock internal tslab;
    MockPlainToken internal nvdaon;
    MockXStock internal aaplx;
    MockPlainToken internal unlisted;

    address internal owner;
    address internal caller;
    address internal stranger;
    address internal agentWallet;
    address internal agentOwner;

    function setUp() public virtual {
        owner = makeAddr("owner");
        caller = makeAddr("caller");
        stranger = makeAddr("stranger");
        agentWallet = makeAddr("agentWallet");
        agentOwner = makeAddr("agentOwner");

        identity = new MockIdentityRegistry();
        reputation = new MockReputationRegistry(identity);
        registry = new CallRegistry(address(identity), address(reputation), owner);

        nvdab = new MockBStock("NVDAB");
        tslab = new MockBStock("TSLAB");
        nvdaon = new MockPlainToken("NVDAon");
        aaplx = new MockXStock("AAPLx");
        unlisted = new MockPlainToken("FAKE");

        address[] memory tokens = new address[](4);
        BalanceModel[] memory models = new BalanceModel[](4);
        tokens[0] = address(nvdab);
        models[0] = BalanceModel.PLAIN;
        tokens[1] = address(tslab);
        models[1] = BalanceModel.PLAIN;
        tokens[2] = address(nvdaon);
        models[2] = BalanceModel.PLAIN;
        tokens[3] = address(aaplx);
        models[3] = BalanceModel.XSTOCK;
        vm.prank(owner);
        registry.setTokens(tokens, models);

        identity.setAgent(AGENT_ID, agentOwner, agentWallet);
    }
}
```

Create `contracts/test/CallRegistryAdmin.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CallRegistry} from "../src/CallRegistry.sol";
import {BalanceModel} from "../src/CallTypes.sol";
import {RegistryFixture} from "./utils/RegistryFixture.sol";
import {MockPlainToken} from "./mocks/MockPlainToken.sol";
import {MockXStock} from "./mocks/MockXStock.sol";

contract CallRegistryAdminTest is RegistryFixture {
    event TokenListed(address indexed token, BalanceModel model);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function test_constructorStoresRegistriesAndOwner() public view {
        assertEq(registry.identityRegistry(), address(identity));
        assertEq(registry.reputationRegistry(), address(reputation));
        assertEq(registry.owner(), owner);
        assertEq(registry.MAX_NOTE_BYTES(), 280);
        assertEq(registry.FEEDBACK_GAS(), 400_000);
    }

    function test_constructorRejectsZeroAddresses() public {
        vm.expectRevert(CallRegistry.ZeroAddress.selector);
        new CallRegistry(address(0), address(reputation), owner);
        vm.expectRevert(CallRegistry.ZeroAddress.selector);
        new CallRegistry(address(identity), address(0), owner);
        vm.expectRevert(CallRegistry.ZeroAddress.selector);
        new CallRegistry(address(identity), address(reputation), address(0));
    }

    function test_fixtureListedTokensWithTheirModels() public view {
        assertEq(uint8(registry.tokenModel(address(nvdab))), uint8(BalanceModel.PLAIN));
        assertEq(uint8(registry.tokenModel(address(nvdaon))), uint8(BalanceModel.PLAIN));
        assertEq(uint8(registry.tokenModel(address(aaplx))), uint8(BalanceModel.XSTOCK));
        assertEq(uint8(registry.tokenModel(address(unlisted))), uint8(BalanceModel.UNLISTED));
    }

    function test_setTokensEmitsTokenListed() public {
        MockPlainToken fresh = new MockPlainToken("SPYB");
        address[] memory tokens = new address[](1);
        BalanceModel[] memory models = new BalanceModel[](1);
        tokens[0] = address(fresh);
        models[0] = BalanceModel.PLAIN;
        vm.expectEmit(true, false, false, true, address(registry));
        emit TokenListed(address(fresh), BalanceModel.PLAIN);
        vm.prank(owner);
        registry.setTokens(tokens, models);
        assertEq(uint8(registry.tokenModel(address(fresh))), uint8(BalanceModel.PLAIN));
    }

    function test_setTokensCanDelist() public {
        address[] memory tokens = new address[](1);
        BalanceModel[] memory models = new BalanceModel[](1);
        tokens[0] = address(nvdab);
        models[0] = BalanceModel.UNLISTED;
        vm.prank(owner);
        registry.setTokens(tokens, models);
        assertEq(uint8(registry.tokenModel(address(nvdab))), uint8(BalanceModel.UNLISTED));
    }

    function test_setTokensOnlyOwner() public {
        address[] memory tokens = new address[](0);
        BalanceModel[] memory models = new BalanceModel[](0);
        vm.prank(stranger);
        vm.expectRevert(CallRegistry.NotOwner.selector);
        registry.setTokens(tokens, models);
    }

    function test_setTokensRejectsLengthMismatch() public {
        address[] memory tokens = new address[](2);
        BalanceModel[] memory models = new BalanceModel[](1);
        vm.prank(owner);
        vm.expectRevert(CallRegistry.LengthMismatch.selector);
        registry.setTokens(tokens, models);
    }

    function test_setTokensRejectsZeroAddress() public {
        address[] memory tokens = new address[](1);
        BalanceModel[] memory models = new BalanceModel[](1);
        models[0] = BalanceModel.PLAIN;
        vm.prank(owner);
        vm.expectRevert(CallRegistry.ZeroAddress.selector);
        registry.setTokens(tokens, models);
    }

    function test_setTokensAcceptsXStock() public {
        MockXStock fresh = new MockXStock("NVDAx");
        address[] memory tokens = new address[](1);
        BalanceModel[] memory models = new BalanceModel[](1);
        tokens[0] = address(fresh);
        models[0] = BalanceModel.XSTOCK;
        vm.prank(owner);
        registry.setTokens(tokens, models);
        assertEq(uint8(registry.tokenModel(address(fresh))), uint8(BalanceModel.XSTOCK));
    }

    function test_transferOwnership() public {
        vm.expectEmit(true, true, false, false, address(registry));
        emit OwnershipTransferred(owner, stranger);
        vm.prank(owner);
        registry.transferOwnership(stranger);
        assertEq(registry.owner(), stranger);

        vm.prank(owner);
        vm.expectRevert(CallRegistry.NotOwner.selector);
        registry.transferOwnership(owner);
    }

    function test_transferOwnershipRejectsZero() public {
        vm.prank(owner);
        vm.expectRevert(CallRegistry.ZeroAddress.selector);
        registry.transferOwnership(address(0));
    }
}
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node contracts/run-forge.mjs test --match-contract CallRegistryAdminTest`
Expected: FAIL — `Error (6275): Source "src/CallRegistry.sol" not found`

- [ ] **Step 3: Minimal implementation**

Create `contracts/src/CallRegistry.sol`. All events and custom errors are declared now so later tasks only add functions; the only revert string the contract will ever use is the posting gate `"No position, no call."` (Task 4).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BalanceModel, Status, Call} from "./CallTypes.sol";
import {IBalanceToken} from "./interfaces/IBalanceToken.sol";
import {IXStockShares} from "./interfaces/IXStockShares.sol";
import {IAgentIdentityRegistry} from "./interfaces/IAgentIdentityRegistry.sol";
import {IAgentReputationRegistry} from "./interfaces/IAgentReputationRegistry.sol";

/// @title CallRegistry — "No position, no call."
/// @notice Public LONG calls on tokenized stocks, each backed by the caller's live on-chain balance.
/// The registry never holds or moves tokens; its owner can only edit the token list.
contract CallRegistry {
    uint256 public constant MAX_NOTE_BYTES = 280;
    uint256 public constant FEEDBACK_GAS = 400_000;
    uint256 public constant FEEDBACK_GAS_RESERVE = 40_000;
    string public constant INTEGRITY_TAG = "integrity";
    int128 public constant HELD_VALUE = 100;
    int128 public constant TRIMMED_VALUE = 50;
    int128 public constant EXITED_VALUE = 0;

    address public immutable identityRegistry;
    address public immutable reputationRegistry;
    address public owner;

    mapping(address token => BalanceModel model) public tokenModel;

    Call[] private _calls;
    mapping(address caller => mapping(address token => uint256 callIdPlusOne)) private _openCallPlusOne;

    event TokenListed(address indexed token, BalanceModel model);
    event CallPosted(
        uint256 indexed callId,
        address indexed caller,
        address indexed token,
        uint256 declaredAmount,
        uint256 agentId,
        bool hasAgent,
        string note
    );
    event ExitRecorded(uint256 indexed callId, Status status, uint256 baseBalance, address recordedBy);
    event CallClosed(uint256 indexed callId, bool heldThrough);
    event FeedbackWritten(uint256 indexed callId, uint256 indexed agentId, int128 value, string tag2);
    event FeedbackFailed(uint256 indexed callId, uint256 indexed agentId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error LengthMismatch();
    error TokenNotListed(address token);
    error ZeroAmount();
    error NoteTooLong(uint256 length);
    error CallAlreadyOpen(uint256 callId);
    error NotAgentWallet(uint256 agentId);
    error UnknownCall(uint256 callId);
    error NotCaller(uint256 callId);
    error CallNotOpen(uint256 callId);
    error StillHolding(uint256 callId);
    error ExitAlreadyRecorded(uint256 callId);
    error InsufficientGas();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address identityRegistry_, address reputationRegistry_, address initialOwner) {
        if (identityRegistry_ == address(0) || reputationRegistry_ == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        identityRegistry = identityRegistry_;
        reputationRegistry = reputationRegistry_;
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    // ───────────────────────────── owner: token list ─────────────────────────────

    /// @notice List (PLAIN / XSTOCK) or delist (UNLISTED) tokens. Owner-only; no external calls, so a
    /// listing batch costs the same whatever the tokens are. A wrongly listed token cannot be posted
    /// against (its balance read reverts inside post), and the owner can delist it.
    function setTokens(address[] calldata tokens, BalanceModel[] calldata models) external onlyOwner {
        if (tokens.length != models.length) revert LengthMismatch();
        for (uint256 i = 0; i < tokens.length; ++i) {
            address token = tokens[i];
            if (token == address(0)) revert ZeroAddress();
            tokenModel[token] = models[i];
            emit TokenListed(token, models[i]);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
```

- [ ] **Step 4: Run to confirm it passes (gate)**

Run: `node contracts/run-forge.mjs test --match-contract CallRegistryAdminTest`
Expected: PASS — `Suite result: ok. 11 passed; 0 failed`

- [ ] **Step 5: Commit (kernel-performed — no agent runs this)**

Message: `feat(contracts): CallRegistry ownership and owner-curated token list`

---

### Task 4: Posting — "No position, no call."

**Files:**
- Modify: `contracts/src/CallRegistry.sol`
- Test: `contracts/test/CallRegistryPost.t.sol`

**Depends on:** Task 3
**Effort:** high
**Model tier:** top
**Provides:** `CallRegistry.post(address token, uint256 amount, string calldata note) returns (uint256 callId)`, `CallRegistry.postAsAgent(address token, uint256 amount, uint256 agentId, string calldata note) returns (uint256 callId)`, `CallRegistry.callCount() returns (uint256)`, `CallRegistry.getCall(uint256 callId) returns (Call memory)`, `CallRegistry.openCallOf(address caller, address token) returns (bool open, uint256 callId)`
**Requires:** `contract CallRegistry(address identityRegistry_, address reputationRegistry_, address initialOwner)`, `CallRegistry.setTokens(address[] calldata tokens, BalanceModel[] calldata models)`, `abstract contract RegistryFixture is Test`

Upstream (already in the repo): `contracts/src/CallRegistry.sol` from Task 3 (constructor, `setTokens`, `transferOwnership`, all events and errors) and `contracts/test/utils/RegistryFixture.sol` (registry wired to mock ERC-8004 registries; listed tokens `nvdab`, `tslab` (MockBStock, PLAIN), `nvdaon` (MockPlainToken, PLAIN), `aaplx` (MockXStock, XSTOCK); `unlisted`; agent `AGENT_ID = 7` with wallet `agentWallet` and owner `agentOwner`).

- [ ] **Step 1: Write the failing test**

Create `contracts/test/CallRegistryPost.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CallRegistry} from "../src/CallRegistry.sol";
import {BalanceModel, Status, Call} from "../src/CallTypes.sol";
import {RegistryFixture} from "./utils/RegistryFixture.sol";

contract CallRegistryPostTest is RegistryFixture {
    event CallPosted(
        uint256 indexed callId,
        address indexed caller,
        address indexed token,
        uint256 declaredAmount,
        uint256 agentId,
        bool hasAgent,
        string note
    );

    function test_postRecordsTheCall() public {
        nvdab.setBalance(caller, 3e16);
        vm.roll(1_000);
        vm.warp(1_760_000_000);
        vm.expectEmit(true, true, true, true, address(registry));
        emit CallPosted(0, caller, address(nvdab), 2e16, 0, false, "AI capex cycle intact");
        vm.prank(caller);
        uint256 callId = registry.post(address(nvdab), 2e16, "AI capex cycle intact");

        assertEq(callId, 0);
        assertEq(registry.callCount(), 1);
        Call memory c = registry.getCall(0);
        assertEq(c.caller, caller);
        assertEq(c.token, address(nvdab));
        assertEq(uint8(c.model), uint8(BalanceModel.PLAIN));
        assertFalse(c.hasAgent);
        assertFalse(c.heldThrough);
        assertEq(uint8(c.exitStatus), uint8(Status.HOLDING));
        assertEq(c.postedBlock, 1_000);
        assertEq(c.postedAt, 1_760_000_000);
        assertEq(c.closedBlock, 0);
        assertEq(c.exitBlock, 0);
        assertEq(c.agentId, 0);
        assertEq(c.declaredAmount, 2e16);
        assertEq(c.declaredBase, 2e16);
        assertEq(c.note, "AI capex cycle intact");

        (bool open, uint256 openId) = registry.openCallOf(caller, address(nvdab));
        assertTrue(open);
        assertEq(openId, 0);
    }

    function test_postWithoutThePositionRevertsNoPositionNoCall() public {
        vm.prank(caller);
        vm.expectRevert(bytes("No position, no call."));
        registry.post(address(tslab), 1e16, "LONG TESLA");
    }

    function test_postMoreThanHeldReverts() public {
        nvdab.setBalance(caller, 1e16);
        vm.prank(caller);
        vm.expectRevert(bytes("No position, no call."));
        registry.post(address(nvdab), 1e16 + 1, "");
    }

    function test_postExactBalanceSucceeds() public {
        nvdab.setBalance(caller, 1e16);
        vm.prank(caller);
        registry.post(address(nvdab), 1e16, "");
        assertEq(registry.callCount(), 1);
    }

    function test_postUnlistedTokenReverts() public {
        unlisted.setBalance(caller, 1e18);
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.TokenNotListed.selector, address(unlisted)));
        registry.post(address(unlisted), 1e18, "");
    }

    function test_postZeroAmountReverts() public {
        nvdab.setBalance(caller, 1e18);
        vm.prank(caller);
        vm.expectRevert(CallRegistry.ZeroAmount.selector);
        registry.post(address(nvdab), 0, "");
    }

    function test_postNoteTooLongReverts() public {
        nvdab.setBalance(caller, 1e18);
        bytes memory longNote = new bytes(281);
        for (uint256 i = 0; i < longNote.length; ++i) {
            longNote[i] = "a";
        }
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.NoteTooLong.selector, 281));
        registry.post(address(nvdab), 1e18, string(longNote));
    }

    function test_postNoteAtLimitSucceeds() public {
        nvdab.setBalance(caller, 1e18);
        bytes memory note = new bytes(280);
        for (uint256 i = 0; i < note.length; ++i) {
            note[i] = "b";
        }
        vm.prank(caller);
        registry.post(address(nvdab), 1e18, string(note));
        assertEq(bytes(registry.getCall(0).note).length, 280);
    }

    function test_secondOpenCallOnSameTokenReverts() public {
        nvdab.setBalance(caller, 1e18);
        vm.startPrank(caller);
        registry.post(address(nvdab), 5e17, "first");
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.CallAlreadyOpen.selector, 0));
        registry.post(address(nvdab), 5e17, "second");
        vm.stopPrank();
    }

    function test_openCallsOnDifferentTokensAreIndependent() public {
        nvdab.setBalance(caller, 1e18);
        tslab.setBalance(caller, 1e18);
        vm.startPrank(caller);
        uint256 a = registry.post(address(nvdab), 1e18, "");
        uint256 b = registry.post(address(tslab), 1e18, "");
        vm.stopPrank();
        assertEq(a, 0);
        assertEq(b, 1);
        (bool openB, uint256 idB) = registry.openCallOf(caller, address(tslab));
        assertTrue(openB);
        assertEq(idB, 1);
        (bool openOther,) = registry.openCallOf(stranger, address(nvdab));
        assertFalse(openOther);
    }

    function test_postAsAgentRecordsTheAgent() public {
        nvdab.setBalance(agentWallet, 1e18);
        vm.expectEmit(true, true, true, true, address(registry));
        emit CallPosted(0, agentWallet, address(nvdab), 1e18, AGENT_ID, true, "agent thesis");
        vm.prank(agentWallet);
        uint256 callId = registry.postAsAgent(address(nvdab), 1e18, AGENT_ID, "agent thesis");
        Call memory c = registry.getCall(callId);
        assertTrue(c.hasAgent);
        assertEq(c.agentId, AGENT_ID);
        assertEq(c.caller, agentWallet);
    }

    function test_postAsAgentFromAnotherWalletReverts() public {
        nvdab.setBalance(agentOwner, 1e18);
        vm.prank(agentOwner);
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.NotAgentWallet.selector, AGENT_ID));
        registry.postAsAgent(address(nvdab), 1e18, AGENT_ID, "");
    }

    function test_postAsUnknownAgentReverts() public {
        nvdab.setBalance(caller, 1e18);
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.NotAgentWallet.selector, 999));
        registry.postAsAgent(address(nvdab), 1e18, 999, "");
    }

    function test_postAsAgentStillNeedsThePosition() public {
        vm.prank(agentWallet);
        vm.expectRevert(bytes("No position, no call."));
        registry.postAsAgent(address(tslab), 1e16, AGENT_ID, "");
    }

    function test_xStockDeclaredBaseIsInShares() public {
        aaplx.setMultiplier(2e18);
        aaplx.setShares(caller, 1e18);
        assertEq(aaplx.balanceOf(caller), 2e18);
        vm.prank(caller);
        uint256 callId = registry.post(address(aaplx), 2e18, "");
        Call memory c = registry.getCall(callId);
        assertEq(uint8(c.model), uint8(BalanceModel.XSTOCK));
        assertEq(c.declaredAmount, 2e18);
        assertEq(c.declaredBase, 1e18);
    }

    function test_xStockAmountThatRoundsToZeroSharesReverts() public {
        aaplx.setMultiplier(2e18);
        aaplx.setShares(caller, 1e18);
        vm.prank(caller);
        vm.expectRevert(CallRegistry.ZeroAmount.selector);
        registry.post(address(aaplx), 1, "");
    }

    function test_getCallUnknownIdReverts() public {
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.UnknownCall.selector, 0));
        registry.getCall(0);
    }

    function test_delistingStopsNewPostsOnly() public {
        nvdab.setBalance(caller, 1e18);
        vm.prank(caller);
        registry.post(address(nvdab), 1e18, "");

        address[] memory tokens = new address[](1);
        BalanceModel[] memory models = new BalanceModel[](1);
        tokens[0] = address(nvdab);
        models[0] = BalanceModel.UNLISTED;
        vm.prank(owner);
        registry.setTokens(tokens, models);

        assertEq(uint8(registry.getCall(0).model), uint8(BalanceModel.PLAIN));
        tslab.setBalance(stranger, 1e18);
        nvdab.setBalance(stranger, 1e18);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.TokenNotListed.selector, address(nvdab)));
        registry.post(address(nvdab), 1e18, "");
    }

    function testFuzz_postSucceedsIffBalanceCoversAmount(uint256 balance, uint256 amount) public {
        balance = bound(balance, 0, 1e30);
        amount = bound(amount, 1, 1e30);
        nvdab.setBalance(caller, balance);
        vm.prank(caller);
        if (balance >= amount) {
            registry.post(address(nvdab), amount, "");
            assertEq(registry.callCount(), 1);
        } else {
            vm.expectRevert(bytes("No position, no call."));
            registry.post(address(nvdab), amount, "");
        }
    }
}
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node contracts/run-forge.mjs test --match-contract CallRegistryPostTest`
Expected: FAIL — `Error (9582): Member "post" not found or not visible after argument-dependent lookup in contract CallRegistry.`

- [ ] **Step 3: Minimal implementation**

Replace the entire contents of `contracts/src/CallRegistry.sol` with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BalanceModel, Status, Call} from "./CallTypes.sol";
import {IBalanceToken} from "./interfaces/IBalanceToken.sol";
import {IXStockShares} from "./interfaces/IXStockShares.sol";
import {IAgentIdentityRegistry} from "./interfaces/IAgentIdentityRegistry.sol";
import {IAgentReputationRegistry} from "./interfaces/IAgentReputationRegistry.sol";

/// @title CallRegistry — "No position, no call."
/// @notice Public LONG calls on tokenized stocks, each backed by the caller's live on-chain balance.
/// The registry never holds or moves tokens; its owner can only edit the token list.
contract CallRegistry {
    uint256 public constant MAX_NOTE_BYTES = 280;
    uint256 public constant FEEDBACK_GAS = 400_000;
    uint256 public constant FEEDBACK_GAS_RESERVE = 40_000;
    string public constant INTEGRITY_TAG = "integrity";
    int128 public constant HELD_VALUE = 100;
    int128 public constant TRIMMED_VALUE = 50;
    int128 public constant EXITED_VALUE = 0;

    address public immutable identityRegistry;
    address public immutable reputationRegistry;
    address public owner;

    mapping(address token => BalanceModel model) public tokenModel;

    Call[] private _calls;
    mapping(address caller => mapping(address token => uint256 callIdPlusOne)) private _openCallPlusOne;

    event TokenListed(address indexed token, BalanceModel model);
    event CallPosted(
        uint256 indexed callId,
        address indexed caller,
        address indexed token,
        uint256 declaredAmount,
        uint256 agentId,
        bool hasAgent,
        string note
    );
    event ExitRecorded(uint256 indexed callId, Status status, uint256 baseBalance, address recordedBy);
    event CallClosed(uint256 indexed callId, bool heldThrough);
    event FeedbackWritten(uint256 indexed callId, uint256 indexed agentId, int128 value, string tag2);
    event FeedbackFailed(uint256 indexed callId, uint256 indexed agentId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error LengthMismatch();
    error TokenNotListed(address token);
    error ZeroAmount();
    error NoteTooLong(uint256 length);
    error CallAlreadyOpen(uint256 callId);
    error NotAgentWallet(uint256 agentId);
    error UnknownCall(uint256 callId);
    error NotCaller(uint256 callId);
    error CallNotOpen(uint256 callId);
    error StillHolding(uint256 callId);
    error ExitAlreadyRecorded(uint256 callId);
    error InsufficientGas();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address identityRegistry_, address reputationRegistry_, address initialOwner) {
        if (identityRegistry_ == address(0) || reputationRegistry_ == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        identityRegistry = identityRegistry_;
        reputationRegistry = reputationRegistry_;
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    // ───────────────────────────── owner: token list ─────────────────────────────

    /// @notice List (PLAIN / XSTOCK) or delist (UNLISTED) tokens. Owner-only; no external calls, so a
    /// listing batch costs the same whatever the tokens are. A wrongly listed token cannot be posted
    /// against (its balance read reverts inside post), and the owner can delist it.
    function setTokens(address[] calldata tokens, BalanceModel[] calldata models) external onlyOwner {
        if (tokens.length != models.length) revert LengthMismatch();
        for (uint256 i = 0; i < tokens.length; ++i) {
            address token = tokens[i];
            if (token == address(0)) revert ZeroAddress();
            tokenModel[token] = models[i];
            emit TokenListed(token, models[i]);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ───────────────────────────── posting ─────────────────────────────

    /// @notice Post a LONG call. Reverts "No position, no call." unless the caller holds `amount` right now.
    function post(address token, uint256 amount, string calldata note) external returns (uint256 callId) {
        return _post(token, amount, false, 0, note);
    }

    /// @notice Post as an ERC-8004 agent; msg.sender must be the agent's registered wallet.
    function postAsAgent(address token, uint256 amount, uint256 agentId, string calldata note)
        external
        returns (uint256 callId)
    {
        if (IAgentIdentityRegistry(identityRegistry).getAgentWallet(agentId) != msg.sender) {
            revert NotAgentWallet(agentId);
        }
        return _post(token, amount, true, agentId, note);
    }

    function _post(address token, uint256 amount, bool hasAgent, uint256 agentId, string calldata note)
        internal
        returns (uint256 callId)
    {
        BalanceModel model = tokenModel[token];
        if (model == BalanceModel.UNLISTED) revert TokenNotListed(token);
        if (amount == 0) revert ZeroAmount();
        uint256 noteLength = bytes(note).length;
        if (noteLength > MAX_NOTE_BYTES) revert NoteTooLong(noteLength);
        uint256 openPlusOne = _openCallPlusOne[msg.sender][token];
        if (openPlusOne != 0) revert CallAlreadyOpen(openPlusOne - 1);

        require(IBalanceToken(token).balanceOf(msg.sender) >= amount, "No position, no call.");

        uint256 declaredBase = amount;
        if (model == BalanceModel.XSTOCK) {
            declaredBase = IXStockShares(token).getSharesByUnderlyingAmount(amount);
            if (declaredBase == 0) revert ZeroAmount();
        }

        callId = _calls.length;
        _calls.push(
            Call({
                caller: msg.sender,
                token: token,
                model: model,
                hasAgent: hasAgent,
                heldThrough: false,
                exitStatus: Status.HOLDING,
                postedBlock: uint64(block.number),
                postedAt: uint64(block.timestamp),
                closedBlock: 0,
                exitBlock: 0,
                agentId: agentId,
                declaredAmount: amount,
                declaredBase: declaredBase,
                note: note
            })
        );
        _openCallPlusOne[msg.sender][token] = callId + 1;
        emit CallPosted(callId, msg.sender, token, amount, agentId, hasAgent, note);
    }


    // ───────────────────────────── views ─────────────────────────────

    function callCount() external view returns (uint256) {
        return _calls.length;
    }

    function getCall(uint256 callId) external view returns (Call memory) {
        return _existing(callId);
    }

    function openCallOf(address caller, address token) external view returns (bool open, uint256 callId) {
        uint256 plusOne = _openCallPlusOne[caller][token];
        if (plusOne == 0) return (false, 0);
        return (true, plusOne - 1);
    }

    function _existing(uint256 callId) internal view returns (Call storage) {
        if (callId >= _calls.length) revert UnknownCall(callId);
        return _calls[callId];
    }
}
```

- [ ] **Step 4: Run to confirm it passes (gate)**

Run: `node contracts/run-forge.mjs test --match-contract CallRegistryPostTest`
Expected: PASS — `Suite result: ok. 19 passed; 0 failed`

- [ ] **Step 5: Commit (kernel-performed — no agent runs this)**

Message: `feat(contracts): post and postAsAgent gated by the caller's live balance`

---

### Task 5: Live badges — statusOf, liveStatus and paged getCalls

**Files:**
- Modify: `contracts/src/CallRegistry.sol`
- Test: `contracts/test/CallRegistryStatus.t.sol`

**Depends on:** Task 4
**Effort:** high
**Model tier:** top
**Provides:** `CallRegistry.liveStatus(uint256 callId) returns (Status)`, `CallRegistry.statusOf(uint256 callId) returns (Status)`, `CallRegistry.getCalls(uint256 start, uint256 count) returns (Call[] memory calls, Status[] memory statuses)`
**Requires:** `CallRegistry.post(address token, uint256 amount, string calldata note) returns (uint256 callId)`, `CallRegistry.getCall(uint256 callId) returns (Call memory)`, `abstract contract RegistryFixture is Test`

Upstream (already in the repo): `contracts/src/CallRegistry.sol` from Task 4 (adds `post`, `postAsAgent`, `callCount`, `getCall`, `openCallOf`, `_existing`).

- [ ] **Step 1: Write the failing test**

Create `contracts/test/CallRegistryStatus.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CallRegistry} from "../src/CallRegistry.sol";
import {Status, Call} from "../src/CallTypes.sol";
import {RegistryFixture} from "./utils/RegistryFixture.sol";

contract CallRegistryStatusTest is RegistryFixture {
    function _postNvdab(uint256 held, uint256 declared) internal returns (uint256 callId) {
        nvdab.setBalance(caller, held);
        vm.prank(caller);
        callId = registry.post(address(nvdab), declared, "");
    }

    function test_holdingWhileBalanceCoversDeclared() public {
        uint256 id = _postNvdab(2e16, 2e16);
        assertEq(uint8(registry.liveStatus(id)), uint8(Status.HOLDING));
        assertEq(uint8(registry.statusOf(id)), uint8(Status.HOLDING));
        nvdab.setBalance(caller, 5e16);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.HOLDING));
    }

    function test_trimmedWhenBalanceDropsBelowDeclared() public {
        uint256 id = _postNvdab(2e16, 2e16);
        nvdab.setBalance(caller, 1e16);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.TRIMMED));
    }

    function test_exitedWhenBalanceIsZero() public {
        uint256 id = _postNvdab(2e16, 2e16);
        vm.prank(caller);
        nvdab.transfer(stranger, 2e16);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.EXITED));
    }

    function test_statusFlipsBackOnRebuyWithoutARecordedExit() public {
        uint256 id = _postNvdab(2e16, 2e16);
        nvdab.setBalance(caller, 0);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.EXITED));
        nvdab.setBalance(caller, 2e16);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.HOLDING));
        assertEq(registry.getCall(id).exitBlock, 0);
    }

    function test_bStockUiMultiplierNeverChangesTheBadge() public {
        uint256 id = _postNvdab(2e16, 2e16);
        nvdab.setUiMultiplier(5e17);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.HOLDING));
        nvdab.setUiMultiplier(3e18);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.HOLDING));
    }

    function testFuzz_xStockRebaseNeverChangesTheBadge(uint256 shares, uint256 startMultiplier, uint256 newMultiplier)
        public
    {
        shares = bound(shares, 1e12, 1e24);
        startMultiplier = bound(startMultiplier, 1e17, 1e19);
        newMultiplier = bound(newMultiplier, 1e17, 1e19);
        aaplx.setMultiplier(startMultiplier);
        aaplx.setShares(caller, shares);
        uint256 balance = aaplx.balanceOf(caller);
        vm.assume(aaplx.getSharesByUnderlyingAmount(balance) > 0);
        vm.prank(caller);
        uint256 id = registry.post(address(aaplx), balance, "");
        assertEq(uint8(registry.statusOf(id)), uint8(Status.HOLDING));
        aaplx.setMultiplier(newMultiplier);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.HOLDING));
    }

    function test_xStockSellingSharesTrimsAndExits() public {
        aaplx.setShares(caller, 4e18);
        vm.prank(caller);
        uint256 id = registry.post(address(aaplx), 4e18, "");
        aaplx.setShares(caller, 1e18);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.TRIMMED));
        aaplx.setShares(caller, 0);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.EXITED));
    }

    function testFuzz_liveStatusMatchesBalance(uint256 declared, uint256 current) public {
        declared = bound(declared, 1, 1e30);
        current = bound(current, 0, 1e30);
        uint256 id = _postNvdab(declared, declared);
        nvdab.setBalance(caller, current);
        Status expected =
            current >= declared ? Status.HOLDING : (current == 0 ? Status.EXITED : Status.TRIMMED);
        assertEq(uint8(registry.liveStatus(id)), uint8(expected));
    }

    function test_getCallsReturnsPagesWithStatuses() public {
        nvdab.setBalance(caller, 1e18);
        tslab.setBalance(caller, 1e18);
        nvdaon.setBalance(stranger, 1e18);
        vm.prank(caller);
        registry.post(address(nvdab), 1e18, "a");
        vm.prank(caller);
        registry.post(address(tslab), 1e18, "b");
        vm.prank(stranger);
        registry.post(address(nvdaon), 1e18, "c");
        tslab.setBalance(caller, 0);

        (Call[] memory calls, Status[] memory statuses) = registry.getCalls(0, 10);
        assertEq(calls.length, 3);
        assertEq(statuses.length, 3);
        assertEq(calls[0].note, "a");
        assertEq(calls[2].caller, stranger);
        assertEq(uint8(statuses[0]), uint8(Status.HOLDING));
        assertEq(uint8(statuses[1]), uint8(Status.EXITED));
        assertEq(uint8(statuses[2]), uint8(Status.HOLDING));

        (Call[] memory page,) = registry.getCalls(1, 1);
        assertEq(page.length, 1);
        assertEq(page[0].note, "b");

        (Call[] memory tail,) = registry.getCalls(2, type(uint256).max);
        assertEq(tail.length, 1);
        assertEq(tail[0].note, "c");

        (Call[] memory none, Status[] memory noStatuses) = registry.getCalls(3, 5);
        assertEq(none.length, 0);
        assertEq(noStatuses.length, 0);
    }

    function test_statusViewsRevertForUnknownCall() public {
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.UnknownCall.selector, 5));
        registry.statusOf(5);
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.UnknownCall.selector, 5));
        registry.liveStatus(5);
    }
}
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node contracts/run-forge.mjs test --match-contract CallRegistryStatusTest`
Expected: FAIL — `Error (9582): Member "liveStatus" not found or not visible after argument-dependent lookup in contract CallRegistry.`

- [ ] **Step 3: Minimal implementation**

Replace the entire contents of `contracts/src/CallRegistry.sol` with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BalanceModel, Status, Call} from "./CallTypes.sol";
import {IBalanceToken} from "./interfaces/IBalanceToken.sol";
import {IXStockShares} from "./interfaces/IXStockShares.sol";
import {IAgentIdentityRegistry} from "./interfaces/IAgentIdentityRegistry.sol";
import {IAgentReputationRegistry} from "./interfaces/IAgentReputationRegistry.sol";

/// @title CallRegistry — "No position, no call."
/// @notice Public LONG calls on tokenized stocks, each backed by the caller's live on-chain balance.
/// The registry never holds or moves tokens; its owner can only edit the token list.
contract CallRegistry {
    uint256 public constant MAX_NOTE_BYTES = 280;
    uint256 public constant FEEDBACK_GAS = 400_000;
    uint256 public constant FEEDBACK_GAS_RESERVE = 40_000;
    string public constant INTEGRITY_TAG = "integrity";
    int128 public constant HELD_VALUE = 100;
    int128 public constant TRIMMED_VALUE = 50;
    int128 public constant EXITED_VALUE = 0;

    address public immutable identityRegistry;
    address public immutable reputationRegistry;
    address public owner;

    mapping(address token => BalanceModel model) public tokenModel;

    Call[] private _calls;
    mapping(address caller => mapping(address token => uint256 callIdPlusOne)) private _openCallPlusOne;

    event TokenListed(address indexed token, BalanceModel model);
    event CallPosted(
        uint256 indexed callId,
        address indexed caller,
        address indexed token,
        uint256 declaredAmount,
        uint256 agentId,
        bool hasAgent,
        string note
    );
    event ExitRecorded(uint256 indexed callId, Status status, uint256 baseBalance, address recordedBy);
    event CallClosed(uint256 indexed callId, bool heldThrough);
    event FeedbackWritten(uint256 indexed callId, uint256 indexed agentId, int128 value, string tag2);
    event FeedbackFailed(uint256 indexed callId, uint256 indexed agentId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error LengthMismatch();
    error TokenNotListed(address token);
    error ZeroAmount();
    error NoteTooLong(uint256 length);
    error CallAlreadyOpen(uint256 callId);
    error NotAgentWallet(uint256 agentId);
    error UnknownCall(uint256 callId);
    error NotCaller(uint256 callId);
    error CallNotOpen(uint256 callId);
    error StillHolding(uint256 callId);
    error ExitAlreadyRecorded(uint256 callId);
    error InsufficientGas();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address identityRegistry_, address reputationRegistry_, address initialOwner) {
        if (identityRegistry_ == address(0) || reputationRegistry_ == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        identityRegistry = identityRegistry_;
        reputationRegistry = reputationRegistry_;
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    // ───────────────────────────── owner: token list ─────────────────────────────

    /// @notice List (PLAIN / XSTOCK) or delist (UNLISTED) tokens. Owner-only; no external calls, so a
    /// listing batch costs the same whatever the tokens are. A wrongly listed token cannot be posted
    /// against (its balance read reverts inside post), and the owner can delist it.
    function setTokens(address[] calldata tokens, BalanceModel[] calldata models) external onlyOwner {
        if (tokens.length != models.length) revert LengthMismatch();
        for (uint256 i = 0; i < tokens.length; ++i) {
            address token = tokens[i];
            if (token == address(0)) revert ZeroAddress();
            tokenModel[token] = models[i];
            emit TokenListed(token, models[i]);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ───────────────────────────── posting ─────────────────────────────

    /// @notice Post a LONG call. Reverts "No position, no call." unless the caller holds `amount` right now.
    function post(address token, uint256 amount, string calldata note) external returns (uint256 callId) {
        return _post(token, amount, false, 0, note);
    }

    /// @notice Post as an ERC-8004 agent; msg.sender must be the agent's registered wallet.
    function postAsAgent(address token, uint256 amount, uint256 agentId, string calldata note)
        external
        returns (uint256 callId)
    {
        if (IAgentIdentityRegistry(identityRegistry).getAgentWallet(agentId) != msg.sender) {
            revert NotAgentWallet(agentId);
        }
        return _post(token, amount, true, agentId, note);
    }

    function _post(address token, uint256 amount, bool hasAgent, uint256 agentId, string calldata note)
        internal
        returns (uint256 callId)
    {
        BalanceModel model = tokenModel[token];
        if (model == BalanceModel.UNLISTED) revert TokenNotListed(token);
        if (amount == 0) revert ZeroAmount();
        uint256 noteLength = bytes(note).length;
        if (noteLength > MAX_NOTE_BYTES) revert NoteTooLong(noteLength);
        uint256 openPlusOne = _openCallPlusOne[msg.sender][token];
        if (openPlusOne != 0) revert CallAlreadyOpen(openPlusOne - 1);

        require(IBalanceToken(token).balanceOf(msg.sender) >= amount, "No position, no call.");

        uint256 declaredBase = amount;
        if (model == BalanceModel.XSTOCK) {
            declaredBase = IXStockShares(token).getSharesByUnderlyingAmount(amount);
            if (declaredBase == 0) revert ZeroAmount();
        }

        callId = _calls.length;
        _calls.push(
            Call({
                caller: msg.sender,
                token: token,
                model: model,
                hasAgent: hasAgent,
                heldThrough: false,
                exitStatus: Status.HOLDING,
                postedBlock: uint64(block.number),
                postedAt: uint64(block.timestamp),
                closedBlock: 0,
                exitBlock: 0,
                agentId: agentId,
                declaredAmount: amount,
                declaredBase: declaredBase,
                note: note
            })
        );
        _openCallPlusOne[msg.sender][token] = callId + 1;
        emit CallPosted(callId, msg.sender, token, amount, agentId, hasAgent, note);
    }

    // ───────────────────────────── views ─────────────────────────────

    function callCount() external view returns (uint256) {
        return _calls.length;
    }

    function getCall(uint256 callId) external view returns (Call memory) {
        return _existing(callId);
    }

    /// @notice HOLDING / TRIMMED / EXITED from the caller's current balance, ignoring closure.
    function liveStatus(uint256 callId) external view returns (Status status) {
        (status,) = _live(_existing(callId));
    }

    /// @notice CLOSED once closed, otherwise the live status.
    function statusOf(uint256 callId) external view returns (Status) {
        return _statusOf(_existing(callId));
    }

    /// @notice A page of calls with their statuses; clamps to callCount().
    function getCalls(uint256 start, uint256 count) external view returns (Call[] memory calls, Status[] memory statuses) {
        uint256 total = _calls.length;
        if (start >= total) return (new Call[](0), new Status[](0));
        uint256 n = total - start;
        if (count < n) n = count;
        calls = new Call[](n);
        statuses = new Status[](n);
        for (uint256 i = 0; i < n; ++i) {
            Call storage c = _calls[start + i];
            calls[i] = c;
            statuses[i] = _statusOf(c);
        }
    }

    function openCallOf(address caller, address token) external view returns (bool open, uint256 callId) {
        uint256 plusOne = _openCallPlusOne[caller][token];
        if (plusOne == 0) return (false, 0);
        return (true, plusOne - 1);
    }

    function _existing(uint256 callId) internal view returns (Call storage) {
        if (callId >= _calls.length) revert UnknownCall(callId);
        return _calls[callId];
    }

    function _statusOf(Call storage c) internal view returns (Status status) {
        if (c.closedBlock != 0) return Status.CLOSED;
        (status,) = _live(c);
    }

    function _live(Call storage c) internal view returns (Status status, uint256 base) {
        base = c.model == BalanceModel.XSTOCK
            ? IXStockShares(c.token).sharesOf(c.caller)
            : IBalanceToken(c.token).balanceOf(c.caller);
        if (base >= c.declaredBase) status = Status.HOLDING;
        else if (base == 0) status = Status.EXITED;
        else status = Status.TRIMMED;
    }
}
```

- [ ] **Step 4: Run to confirm it passes (gate)**

Run: `node contracts/run-forge.mjs test --match-contract CallRegistryStatusTest`
Expected: PASS — `Suite result: ok. 10 passed; 0 failed`

- [ ] **Step 5: Commit (kernel-performed — no agent runs this)**

Message: `feat(contracts): live HOLDING/TRIMMED/EXITED badges and paged getCalls`

---

### Task 6: Lifecycle — sticky recordExit, honest close and registry-written ERC-8004 feedback

**Files:**
- Modify: `contracts/src/CallRegistry.sol`
- Test: `contracts/test/CallRegistryLifecycle.t.sol`

**Depends on:** Task 5
**Effort:** xhigh
**Model tier:** top
**Provides:** `CallRegistry.recordExit(uint256 callId)`, `CallRegistry.close(uint256 callId)`, `event ExitRecorded(uint256 indexed callId, Status status, uint256 baseBalance, address recordedBy)`, `event CallClosed(uint256 indexed callId, bool heldThrough)`, `event FeedbackWritten(uint256 indexed callId, uint256 indexed agentId, int128 value, string tag2)`, `event FeedbackFailed(uint256 indexed callId, uint256 indexed agentId)`, `contracts/out/CallRegistry.sol/CallRegistry.json (forge artifact holding the final CallRegistry ABI)`
**Requires:** `CallRegistry.statusOf(uint256 callId) returns (Status)`, `CallRegistry.liveStatus(uint256 callId) returns (Status)`, `CallRegistry.postAsAgent(address token, uint256 amount, uint256 agentId, string calldata note) returns (uint256 callId)`, `CallRegistry.openCallOf(address caller, address token) returns (bool open, uint256 callId)`, `abstract contract RegistryFixture is Test`

Upstream (already in the repo): `contracts/src/CallRegistry.sol` from Task 5. Semantics this task adds (spec §5.1–§5.3): `recordExit` is permissionless, only while open, not yet recorded and not HOLDING; `close` is caller-only, records the exit itself when the caller is no longer HOLDING, and sets `heldThrough`; agent calls get at most one `giveFeedback` (EXITED 0, TRIMMED 50, held 100, tag1 `"integrity"`, `feedbackHash = bytes32(callId)`), written after all state changes, inside `try/catch` with a 400,000 gas cap and a gas floor so nobody can starve it on purpose.

- [ ] **Step 1: Write the failing test**

Create `contracts/test/CallRegistryLifecycle.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CallRegistry} from "../src/CallRegistry.sol";
import {Status, Call} from "../src/CallTypes.sol";
import {RegistryFixture} from "./utils/RegistryFixture.sol";
import {MockReputationRegistry} from "./mocks/MockReputationRegistry.sol";
import {MockBStock} from "./mocks/MockBStock.sol";
import {RevertingReputationRegistry} from "./mocks/RevertingReputationRegistry.sol";
import {BalanceModel} from "../src/CallTypes.sol";

/// @notice Lends tokens to a borrower and takes them back in the same transaction.
contract FlashLender {
    function borrowPostReturn(MockBStock token, CallRegistry registry, uint256 amount)
        external
        returns (uint256 callId)
    {
        token.setBalance(address(this), amount);
        callId = registry.post(address(token), amount, "borrowed");
        token.setBalance(address(this), 0);
    }
}

contract CallRegistryLifecycleTest is RegistryFixture {
    event ExitRecorded(uint256 indexed callId, Status status, uint256 baseBalance, address recordedBy);
    event CallClosed(uint256 indexed callId, bool heldThrough);
    event FeedbackWritten(uint256 indexed callId, uint256 indexed agentId, int128 value, string tag2);
    event FeedbackFailed(uint256 indexed callId, uint256 indexed agentId);

    function _postAsCaller(uint256 amount) internal returns (uint256 callId) {
        nvdab.setBalance(caller, amount);
        vm.prank(caller);
        callId = registry.post(address(nvdab), amount, "");
    }

    function _postAsAgent(uint256 amount) internal returns (uint256 callId) {
        nvdab.setBalance(agentWallet, amount);
        vm.prank(agentWallet);
        callId = registry.postAsAgent(address(nvdab), amount, AGENT_ID, "agent call");
    }

    // ───────────── recordExit ─────────────

    function test_recordExitAfterTheDumpIsSticky() public {
        uint256 id = _postAsCaller(2e16);
        vm.roll(block.number + 5);
        nvdab.setBalance(caller, 0);

        vm.expectEmit(true, false, false, true, address(registry));
        emit ExitRecorded(id, Status.EXITED, 0, stranger);
        vm.prank(stranger);
        registry.recordExit(id);

        Call memory c = registry.getCall(id);
        assertEq(c.exitBlock, block.number);
        assertEq(uint8(c.exitStatus), uint8(Status.EXITED));

        nvdab.setBalance(caller, 2e16);
        assertEq(uint8(registry.liveStatus(id)), uint8(Status.HOLDING));
        assertEq(registry.getCall(id).exitBlock, block.number);
        assertEq(uint8(registry.getCall(id).exitStatus), uint8(Status.EXITED));
    }

    function test_recordExitTrimmed() public {
        uint256 id = _postAsCaller(2e16);
        nvdab.setBalance(caller, 1e16);
        vm.prank(stranger);
        registry.recordExit(id);
        assertEq(uint8(registry.getCall(id).exitStatus), uint8(Status.TRIMMED));
    }

    function test_recordExitWhileHoldingReverts() public {
        uint256 id = _postAsCaller(2e16);
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.StillHolding.selector, id));
        registry.recordExit(id);
    }

    function test_recordExitTwiceReverts() public {
        uint256 id = _postAsCaller(2e16);
        nvdab.setBalance(caller, 0);
        registry.recordExit(id);
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.ExitAlreadyRecorded.selector, id));
        registry.recordExit(id);
    }

    function test_recordExitOnClosedCallReverts() public {
        uint256 id = _postAsCaller(2e16);
        vm.prank(caller);
        registry.close(id);
        nvdab.setBalance(caller, 0);
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.CallNotOpen.selector, id));
        registry.recordExit(id);
    }

    function test_recordExitUnknownCallReverts() public {
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.UnknownCall.selector, 3));
        registry.recordExit(3);
    }

    function test_flashBorrowedPositionIsExitedOnTheNextRead() public {
        FlashLender lender = new FlashLender();
        uint256 id = lender.borrowPostReturn(nvdab, registry, 1e18);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.EXITED));
        registry.recordExit(id);
        assertEq(uint8(registry.getCall(id).exitStatus), uint8(Status.EXITED));
    }

    // ───────────── close ─────────────

    function test_closeWhileHoldingIsHeldThrough() public {
        uint256 id = _postAsCaller(2e16);
        vm.roll(block.number + 10);
        vm.expectEmit(true, false, false, true, address(registry));
        emit CallClosed(id, true);
        vm.prank(caller);
        registry.close(id);

        Call memory c = registry.getCall(id);
        assertTrue(c.heldThrough);
        assertEq(c.closedBlock, block.number);
        assertEq(c.exitBlock, 0);
        assertEq(uint8(registry.statusOf(id)), uint8(Status.CLOSED));
        (bool open,) = registry.openCallOf(caller, address(nvdab));
        assertFalse(open);
    }

    function test_closeAfterDumpRecordsTheExit() public {
        uint256 id = _postAsCaller(2e16);
        nvdab.setBalance(caller, 0);
        vm.expectEmit(true, false, false, true, address(registry));
        emit ExitRecorded(id, Status.EXITED, 0, caller);
        vm.prank(caller);
        registry.close(id);
        Call memory c = registry.getCall(id);
        assertFalse(c.heldThrough);
        assertEq(c.exitBlock, block.number);
        assertEq(uint8(c.exitStatus), uint8(Status.EXITED));
    }

    function test_closeAfterRebuyIsNotHeldThrough() public {
        uint256 id = _postAsCaller(2e16);
        nvdab.setBalance(caller, 0);
        registry.recordExit(id);
        nvdab.setBalance(caller, 2e16);
        vm.prank(caller);
        registry.close(id);
        assertFalse(registry.getCall(id).heldThrough);
    }

    function test_onlyTheCallerCanClose() public {
        uint256 id = _postAsCaller(2e16);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.NotCaller.selector, id));
        registry.close(id);
    }

    function test_closeTwiceReverts() public {
        uint256 id = _postAsCaller(2e16);
        vm.startPrank(caller);
        registry.close(id);
        vm.expectRevert(abi.encodeWithSelector(CallRegistry.CallNotOpen.selector, id));
        registry.close(id);
        vm.stopPrank();
    }

    function test_canPostAgainAfterClosing() public {
        uint256 first = _postAsCaller(2e16);
        vm.startPrank(caller);
        registry.close(first);
        uint256 second = registry.post(address(nvdab), 2e16, "again");
        vm.stopPrank();
        assertEq(second, first + 1);
        (bool open, uint256 openId) = registry.openCallOf(caller, address(nvdab));
        assertTrue(open);
        assertEq(openId, second);
    }

    // ───────────── reputation ─────────────

    function test_agentHeldThroughWrites100() public {
        uint256 id = _postAsAgent(1e18);
        vm.expectEmit(true, true, false, true, address(registry));
        emit FeedbackWritten(id, AGENT_ID, 100, "held");
        vm.prank(agentWallet);
        registry.close(id);

        assertEq(reputation.count(), 1);
        MockReputationRegistry.Entry memory e = reputation.entry(0);
        assertEq(e.agentId, AGENT_ID);
        assertEq(e.client, address(registry));
        assertEq(e.value, 100);
        assertEq(e.valueDecimals, 0);
        assertEq(e.tag1, "integrity");
        assertEq(e.tag2, "held");
        assertEq(e.endpoint, "");
        assertEq(e.feedbackURI, "");
        assertEq(e.feedbackHash, bytes32(id));
    }

    function test_agentExitWrites0Once() public {
        uint256 id = _postAsAgent(1e18);
        nvdab.setBalance(agentWallet, 0);
        vm.expectEmit(true, true, false, true, address(registry));
        emit FeedbackWritten(id, AGENT_ID, 0, "exited");
        vm.prank(stranger);
        registry.recordExit(id);
        assertEq(reputation.count(), 1);
        assertEq(reputation.entry(0).tag2, "exited");

        vm.prank(agentWallet);
        registry.close(id);
        assertEq(reputation.count(), 1);
    }

    function test_agentTrimWrites50() public {
        uint256 id = _postAsAgent(1e18);
        nvdab.setBalance(agentWallet, 4e17);
        registry.recordExit(id);
        assertEq(reputation.entry(0).value, 50);
        assertEq(reputation.entry(0).tag2, "trimmed");
    }

    function test_agentCloseAfterDumpWrites0() public {
        uint256 id = _postAsAgent(1e18);
        nvdab.setBalance(agentWallet, 0);
        vm.prank(agentWallet);
        registry.close(id);
        assertEq(reputation.count(), 1);
        assertEq(reputation.entry(0).value, 0);
        assertEq(reputation.entry(0).tag2, "exited");
    }

    function test_humanCallsWriteNoFeedback() public {
        uint256 id = _postAsCaller(2e16);
        nvdab.setBalance(caller, 0);
        registry.recordExit(id);
        vm.prank(caller);
        registry.close(id);
        assertEq(reputation.count(), 0);
    }

    function test_feedbackFailureNeverBlocksClose() public {
        RevertingReputationRegistry down = new RevertingReputationRegistry();
        CallRegistry local = new CallRegistry(address(identity), address(down), owner);
        address[] memory tokens = new address[](1);
        BalanceModel[] memory models = new BalanceModel[](1);
        tokens[0] = address(nvdab);
        models[0] = BalanceModel.PLAIN;
        vm.prank(owner);
        local.setTokens(tokens, models);

        nvdab.setBalance(agentWallet, 1e18);
        vm.prank(agentWallet);
        uint256 id = local.postAsAgent(address(nvdab), 1e18, AGENT_ID, "");
        vm.expectEmit(true, true, false, false, address(local));
        emit FeedbackFailed(id, AGENT_ID);
        vm.prank(agentWallet);
        local.close(id);
        assertEq(uint8(local.statusOf(id)), uint8(Status.CLOSED));
        assertTrue(local.getCall(id).heldThrough);
    }

    function test_starvingTheFeedbackCallReverts() public {
        uint256 id = _postAsAgent(1e18);
        nvdab.setBalance(agentWallet, 0);
        vm.expectRevert(CallRegistry.InsufficientGas.selector);
        registry.recordExit{gas: 200_000}(id);
        assertEq(registry.getCall(id).exitBlock, 0);
        registry.recordExit(id);
        assertEq(reputation.count(), 1);
    }
}
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node contracts/run-forge.mjs test --match-contract CallRegistryLifecycleTest`
Expected: FAIL — `Error (9582): Member "recordExit" not found or not visible after argument-dependent lookup in contract CallRegistry.`

- [ ] **Step 3: Minimal implementation**

Replace the entire contents of `contracts/src/CallRegistry.sol` with the final contract:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BalanceModel, Status, Call} from "./CallTypes.sol";
import {IBalanceToken} from "./interfaces/IBalanceToken.sol";
import {IXStockShares} from "./interfaces/IXStockShares.sol";
import {IAgentIdentityRegistry} from "./interfaces/IAgentIdentityRegistry.sol";
import {IAgentReputationRegistry} from "./interfaces/IAgentReputationRegistry.sol";

/// @title CallRegistry — "No position, no call."
/// @notice Public LONG calls on tokenized stocks, each backed by the caller's live on-chain balance.
/// The registry never holds or moves tokens; its owner can only edit the token list.
contract CallRegistry {
    uint256 public constant MAX_NOTE_BYTES = 280;
    uint256 public constant FEEDBACK_GAS = 400_000;
    uint256 public constant FEEDBACK_GAS_RESERVE = 40_000;
    string public constant INTEGRITY_TAG = "integrity";
    int128 public constant HELD_VALUE = 100;
    int128 public constant TRIMMED_VALUE = 50;
    int128 public constant EXITED_VALUE = 0;

    address public immutable identityRegistry;
    address public immutable reputationRegistry;
    address public owner;

    mapping(address token => BalanceModel model) public tokenModel;

    Call[] private _calls;
    mapping(address caller => mapping(address token => uint256 callIdPlusOne)) private _openCallPlusOne;

    event TokenListed(address indexed token, BalanceModel model);
    event CallPosted(
        uint256 indexed callId,
        address indexed caller,
        address indexed token,
        uint256 declaredAmount,
        uint256 agentId,
        bool hasAgent,
        string note
    );
    event ExitRecorded(uint256 indexed callId, Status status, uint256 baseBalance, address recordedBy);
    event CallClosed(uint256 indexed callId, bool heldThrough);
    event FeedbackWritten(uint256 indexed callId, uint256 indexed agentId, int128 value, string tag2);
    event FeedbackFailed(uint256 indexed callId, uint256 indexed agentId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error LengthMismatch();
    error TokenNotListed(address token);
    error ZeroAmount();
    error NoteTooLong(uint256 length);
    error CallAlreadyOpen(uint256 callId);
    error NotAgentWallet(uint256 agentId);
    error UnknownCall(uint256 callId);
    error NotCaller(uint256 callId);
    error CallNotOpen(uint256 callId);
    error StillHolding(uint256 callId);
    error ExitAlreadyRecorded(uint256 callId);
    error InsufficientGas();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address identityRegistry_, address reputationRegistry_, address initialOwner) {
        if (identityRegistry_ == address(0) || reputationRegistry_ == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        identityRegistry = identityRegistry_;
        reputationRegistry = reputationRegistry_;
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    // ───────────────────────────── owner: token list ─────────────────────────────

    /// @notice List (PLAIN / XSTOCK) or delist (UNLISTED) tokens. Owner-only; no external calls, so a
    /// listing batch costs the same whatever the tokens are. A wrongly listed token cannot be posted
    /// against (its balance read reverts inside post), and the owner can delist it.
    function setTokens(address[] calldata tokens, BalanceModel[] calldata models) external onlyOwner {
        if (tokens.length != models.length) revert LengthMismatch();
        for (uint256 i = 0; i < tokens.length; ++i) {
            address token = tokens[i];
            if (token == address(0)) revert ZeroAddress();
            tokenModel[token] = models[i];
            emit TokenListed(token, models[i]);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ───────────────────────────── posting ─────────────────────────────

    /// @notice Post a LONG call. Reverts "No position, no call." unless the caller holds `amount` right now.
    function post(address token, uint256 amount, string calldata note) external returns (uint256 callId) {
        return _post(token, amount, false, 0, note);
    }

    /// @notice Post as an ERC-8004 agent; msg.sender must be the agent's registered wallet.
    function postAsAgent(address token, uint256 amount, uint256 agentId, string calldata note)
        external
        returns (uint256 callId)
    {
        if (IAgentIdentityRegistry(identityRegistry).getAgentWallet(agentId) != msg.sender) {
            revert NotAgentWallet(agentId);
        }
        return _post(token, amount, true, agentId, note);
    }

    function _post(address token, uint256 amount, bool hasAgent, uint256 agentId, string calldata note)
        internal
        returns (uint256 callId)
    {
        BalanceModel model = tokenModel[token];
        if (model == BalanceModel.UNLISTED) revert TokenNotListed(token);
        if (amount == 0) revert ZeroAmount();
        uint256 noteLength = bytes(note).length;
        if (noteLength > MAX_NOTE_BYTES) revert NoteTooLong(noteLength);
        uint256 openPlusOne = _openCallPlusOne[msg.sender][token];
        if (openPlusOne != 0) revert CallAlreadyOpen(openPlusOne - 1);

        require(IBalanceToken(token).balanceOf(msg.sender) >= amount, "No position, no call.");

        uint256 declaredBase = amount;
        if (model == BalanceModel.XSTOCK) {
            declaredBase = IXStockShares(token).getSharesByUnderlyingAmount(amount);
            if (declaredBase == 0) revert ZeroAmount();
        }

        callId = _calls.length;
        _calls.push(
            Call({
                caller: msg.sender,
                token: token,
                model: model,
                hasAgent: hasAgent,
                heldThrough: false,
                exitStatus: Status.HOLDING,
                postedBlock: uint64(block.number),
                postedAt: uint64(block.timestamp),
                closedBlock: 0,
                exitBlock: 0,
                agentId: agentId,
                declaredAmount: amount,
                declaredBase: declaredBase,
                note: note
            })
        );
        _openCallPlusOne[msg.sender][token] = callId + 1;
        emit CallPosted(callId, msg.sender, token, amount, agentId, hasAgent, note);
    }

    // ───────────────────────────── lifecycle ─────────────────────────────

    /// @notice Anyone may make an exit permanent while the call is open and no longer HOLDING.
    function recordExit(uint256 callId) external {
        Call storage c = _existing(callId);
        if (c.closedBlock != 0) revert CallNotOpen(callId);
        if (c.exitBlock != 0) revert ExitAlreadyRecorded(callId);
        (Status live, uint256 base) = _live(c);
        if (live == Status.HOLDING) revert StillHolding(callId);
        _markExit(callId, c, live, base);
        if (c.hasAgent) _writeExitFeedback(callId, c.agentId, live);
    }

    /// @notice The caller ends a call. heldThrough is true only if no exit was ever recorded
    /// and the caller is still HOLDING; otherwise the exit is recorded now (if it was not already).
    function close(uint256 callId) external {
        Call storage c = _existing(callId);
        if (c.caller != msg.sender) revert NotCaller(callId);
        if (c.closedBlock != 0) revert CallNotOpen(callId);
        (Status live, uint256 base) = _live(c);
        bool exitWasRecorded = c.exitBlock != 0;
        bool held = !exitWasRecorded && live == Status.HOLDING;
        bool recordsExitNow = !exitWasRecorded && live != Status.HOLDING;
        if (recordsExitNow) _markExit(callId, c, live, base);
        c.heldThrough = held;
        c.closedBlock = uint64(block.number);
        _openCallPlusOne[c.caller][c.token] = 0;
        emit CallClosed(callId, held);
        if (c.hasAgent) {
            if (recordsExitNow) {
                _writeExitFeedback(callId, c.agentId, live);
            } else if (held) {
                _writeFeedback(callId, c.agentId, HELD_VALUE, "held");
            }
        }
    }

    function _markExit(uint256 callId, Call storage c, Status live, uint256 base) internal {
        c.exitBlock = uint64(block.number);
        c.exitStatus = live;
        emit ExitRecorded(callId, live, base, msg.sender);
    }

    function _writeExitFeedback(uint256 callId, uint256 agentId, Status live) internal {
        if (live == Status.EXITED) {
            _writeFeedback(callId, agentId, EXITED_VALUE, "exited");
        } else {
            _writeFeedback(callId, agentId, TRIMMED_VALUE, "trimmed");
        }
    }

    /// @dev State is final before this external call. The gas floor stops anyone from starving the
    /// feedback call on purpose; a registry-side revert is caught and reported, never propagated.
    function _writeFeedback(uint256 callId, uint256 agentId, int128 value, string memory tag2) internal {
        if (gasleft() < FEEDBACK_GAS + FEEDBACK_GAS_RESERVE) revert InsufficientGas();
        try IAgentReputationRegistry(reputationRegistry).giveFeedback{gas: FEEDBACK_GAS}(
            agentId, value, 0, INTEGRITY_TAG, tag2, "", "", bytes32(callId)
        ) {
            emit FeedbackWritten(callId, agentId, value, tag2);
        } catch {
            emit FeedbackFailed(callId, agentId);
        }
    }

    // ───────────────────────────── views ─────────────────────────────

    function callCount() external view returns (uint256) {
        return _calls.length;
    }

    function getCall(uint256 callId) external view returns (Call memory) {
        return _existing(callId);
    }

    /// @notice HOLDING / TRIMMED / EXITED from the caller's current balance, ignoring closure.
    function liveStatus(uint256 callId) external view returns (Status status) {
        (status,) = _live(_existing(callId));
    }

    /// @notice CLOSED once closed, otherwise the live status.
    function statusOf(uint256 callId) external view returns (Status) {
        return _statusOf(_existing(callId));
    }

    /// @notice A page of calls with their statuses; clamps to callCount().
    function getCalls(uint256 start, uint256 count) external view returns (Call[] memory calls, Status[] memory statuses) {
        uint256 total = _calls.length;
        if (start >= total) return (new Call[](0), new Status[](0));
        uint256 n = total - start;
        if (count < n) n = count;
        calls = new Call[](n);
        statuses = new Status[](n);
        for (uint256 i = 0; i < n; ++i) {
            Call storage c = _calls[start + i];
            calls[i] = c;
            statuses[i] = _statusOf(c);
        }
    }

    function openCallOf(address caller, address token) external view returns (bool open, uint256 callId) {
        uint256 plusOne = _openCallPlusOne[caller][token];
        if (plusOne == 0) return (false, 0);
        return (true, plusOne - 1);
    }

    function _existing(uint256 callId) internal view returns (Call storage) {
        if (callId >= _calls.length) revert UnknownCall(callId);
        return _calls[callId];
    }

    function _statusOf(Call storage c) internal view returns (Status status) {
        if (c.closedBlock != 0) return Status.CLOSED;
        (status,) = _live(c);
    }

    function _live(Call storage c) internal view returns (Status status, uint256 base) {
        base = c.model == BalanceModel.XSTOCK
            ? IXStockShares(c.token).sharesOf(c.caller)
            : IBalanceToken(c.token).balanceOf(c.caller);
        if (base >= c.declaredBase) status = Status.HOLDING;
        else if (base == 0) status = Status.EXITED;
        else status = Status.TRIMMED;
    }
}
```

- [ ] **Step 4: Run to confirm it passes (gate)**

Run: `node contracts/run-forge.mjs test --match-contract CallRegistryLifecycleTest`
Expected: PASS — `Suite result: ok. 20 passed; 0 failed`

- [ ] **Step 5: Commit (kernel-performed — no agent runs this)**

Message: `feat(contracts): sticky recordExit, honest close and registry-written ERC-8004 integrity feedback`

---

### Task 7: Invariant suite over random posts, transfers, rebases, exits and closes

**Files:**
- Test: `contracts/test/CallRegistryInvariant.t.sol`

**Depends on:** Task 6
**Effort:** high
**Model tier:** top
**Requires:** `CallRegistry.recordExit(uint256 callId)`, `CallRegistry.close(uint256 callId)`, `CallRegistry.getCalls(uint256 start, uint256 count) returns (Call[] memory calls, Status[] memory statuses)`

This task adds a property suite over the finished contract, so it passes on its first run; if it ever fails, the counterexample is a real contract bug — report `RESULT: BLOCKED` with the failing sequence instead of editing the contract.

- [ ] **Step 1: Write the invariant suite**

Create `contracts/test/CallRegistryInvariant.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CallRegistry} from "../src/CallRegistry.sol";
import {BalanceModel, Status, Call} from "../src/CallTypes.sol";
import {MockBStock} from "./mocks/MockBStock.sol";
import {MockXStock} from "./mocks/MockXStock.sol";
import {MockIdentityRegistry} from "./mocks/MockIdentityRegistry.sol";
import {MockReputationRegistry} from "./mocks/MockReputationRegistry.sol";

/// @notice Drives random posts, balance moves, rebases, recordExit and close calls.
contract RegistryHandler is Test {
    CallRegistry public immutable registry;
    MockBStock public immutable bstock;
    MockXStock public immutable xstock;
    address[] public actors;
    uint256 public agentCallsPosted;

    constructor(CallRegistry registry_, MockBStock bstock_, MockXStock xstock_, address[] memory actors_) {
        registry = registry_;
        bstock = bstock_;
        xstock = xstock_;
        actors = actors_;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function post(uint256 actorSeed, uint256 amount, bool useXStock) external {
        address actor = _actor(actorSeed);
        amount = bound(amount, 1e12, 1e21);
        if (useXStock) {
            xstock.setShares(actor, xstock.sharesOf(actor) + amount);
            uint256 balance = xstock.balanceOf(actor);
            vm.prank(actor);
            try registry.post(address(xstock), balance, "x") {} catch {}
        } else {
            bstock.setBalance(actor, bstock.balanceOf(actor) + amount);
            vm.prank(actor);
            if (actorSeed % 3 == 0) {
                try registry.postAsAgent(address(bstock), amount, 7, "agent") {
                    agentCallsPosted++;
                } catch {}
            } else {
                try registry.post(address(bstock), amount, "b") {} catch {}
            }
        }
    }

    function setBStockBalance(uint256 actorSeed, uint256 balance) external {
        bstock.setBalance(_actor(actorSeed), bound(balance, 0, 1e21));
    }

    function setXStockShares(uint256 actorSeed, uint256 shares) external {
        xstock.setShares(_actor(actorSeed), bound(shares, 0, 1e21));
    }

    function rebase(uint256 multiplier) external {
        xstock.setMultiplier(bound(multiplier, 5e17, 5e18));
    }

    function recordExit(uint256 callSeed) external {
        uint256 total = registry.callCount();
        if (total == 0) return;
        try registry.recordExit(callSeed % total) {} catch {}
    }

    function close(uint256 callSeed) external {
        uint256 total = registry.callCount();
        if (total == 0) return;
        uint256 id = callSeed % total;
        Call memory c = registry.getCall(id);
        vm.prank(c.caller);
        try registry.close(id) {} catch {}
    }
}

contract CallRegistryInvariantTest is Test {
    CallRegistry internal registry;
    MockBStock internal bstock;
    MockXStock internal xstock;
    MockReputationRegistry internal reputation;
    RegistryHandler internal handler;
    address[] internal actors;

    function setUp() public {
        MockIdentityRegistry identity = new MockIdentityRegistry();
        reputation = new MockReputationRegistry(identity);
        address owner = makeAddr("owner");
        registry = new CallRegistry(address(identity), address(reputation), owner);
        bstock = new MockBStock("NVDAB");
        xstock = new MockXStock("AAPLx");

        address[] memory tokens = new address[](2);
        BalanceModel[] memory models = new BalanceModel[](2);
        tokens[0] = address(bstock);
        models[0] = BalanceModel.PLAIN;
        tokens[1] = address(xstock);
        models[1] = BalanceModel.XSTOCK;
        vm.prank(owner);
        registry.setTokens(tokens, models);

        actors.push(makeAddr("agentWallet"));
        actors.push(makeAddr("alice"));
        actors.push(makeAddr("bob"));
        identity.setAgent(7, makeAddr("agentOwner"), actors[0]);

        handler = new RegistryHandler(registry, bstock, xstock, actors);
        targetContract(address(handler));
    }

    function invariant_statusAgreesWithBalances() public view {
        uint256 total = registry.callCount();
        for (uint256 id = 0; id < total; ++id) {
            Call memory c = registry.getCall(id);
            Status status = registry.statusOf(id);
            if (c.closedBlock != 0) {
                assertEq(uint8(status), uint8(Status.CLOSED));
                continue;
            }
            uint256 base = c.model == BalanceModel.XSTOCK ? xstock.sharesOf(c.caller) : bstock.balanceOf(c.caller);
            Status expected =
                base >= c.declaredBase ? Status.HOLDING : (base == 0 ? Status.EXITED : Status.TRIMMED);
            assertEq(uint8(status), uint8(expected));
        }
    }

    function invariant_atMostOneOpenCallPerCallerAndToken() public view {
        address[2] memory tokens = [address(bstock), address(xstock)];
        for (uint256 a = 0; a < actors.length; ++a) {
            for (uint256 t = 0; t < 2; ++t) {
                uint256 open = 0;
                uint256 total = registry.callCount();
                for (uint256 id = 0; id < total; ++id) {
                    Call memory c = registry.getCall(id);
                    if (c.caller == actors[a] && c.token == tokens[t] && c.closedBlock == 0) open++;
                }
                assertLe(open, 1);
                (bool isOpen,) = registry.openCallOf(actors[a], tokens[t]);
                assertEq(isOpen, open == 1);
            }
        }
    }

    function invariant_recordedExitsAreTrimmedOrExited() public view {
        uint256 total = registry.callCount();
        for (uint256 id = 0; id < total; ++id) {
            Call memory c = registry.getCall(id);
            if (c.exitBlock != 0) {
                assertTrue(c.exitStatus == Status.TRIMMED || c.exitStatus == Status.EXITED);
                assertFalse(c.heldThrough);
            } else {
                assertEq(uint8(c.exitStatus), uint8(Status.HOLDING));
            }
        }
    }

    function invariant_atMostOneFeedbackPerAgentCall() public view {
        uint256 total = registry.callCount();
        uint256 agentCalls = 0;
        for (uint256 id = 0; id < total; ++id) {
            if (registry.getCall(id).hasAgent) agentCalls++;
        }
        assertLe(reputation.count(), agentCalls);
        uint256 entries = reputation.count();
        for (uint256 i = 0; i < entries; ++i) {
            for (uint256 j = i + 1; j < entries; ++j) {
                assertTrue(reputation.entry(i).feedbackHash != reputation.entry(j).feedbackHash);
            }
        }
    }
}
```

- [ ] **Step 2: Run the whole contract suite (regression check)**

Run: `node contracts/run-forge.mjs test`
Expected: every suite reports `0 failed`

- [ ] **Step 3: Run the invariant suite to confirm it passes (gate)**

Run: `node contracts/run-forge.mjs test --match-contract CallRegistryInvariantTest`
Expected: PASS — `Suite result: ok. 1 passed; 0 failed` (the invariant table reports `runs: 64, calls: 2048`)

- [ ] **Step 4: Commit (kernel-performed — no agent runs this)**

Message: `test(contracts): invariant suite for badge, single-open-call and feedback properties`

---

### Task 8: Token list data and the batched ListTokens script

**Files:**
- Create: `contracts/script/data/generate-tokens.mjs`
- Create: `contracts/script/data/tokens.json`
- Create: `contracts/script/ListTokens.s.sol`
- Test: `contracts/test/ListTokens.t.sol`

**Depends on:** Task 6
**Effort:** medium
**Provides:** `contracts/script/data/tokens.json { source, plain: address[547], xstock: address[128] }`, `ListTokens.list(CallRegistry registry, address[] memory plain, address[] memory xstock) returns (Result memory result)`, `ListTokens.loadTokens() returns (address[] memory plain, address[] memory xstock)`
**Requires:** `CallRegistry.setTokens(address[] calldata tokens, BalanceModel[] calldata models)`, `CallRegistry.tokenModel(address token) returns (BalanceModel)`

The source of truth is the resource pack's registry `docs/resources/2026-10-05-bnb-hack-tokenized-stocks/data/bsc-tokenized-stocks-2026-10-05.csv` (675 rows). bStock (87) and Ondo (458) rows list as PLAIN; the 128 rebasing xStocks list as XSTOCK; the 2 wrapped xStocks `wPOPMTx` and `wTCENTx` (non-rebasing ERC-4626 wrappers with no `sharesOf`, verified on mainnet 2026-10-07) list as PLAIN. The script makes no token calls: listing simulations against public RPCs must finish within the ~1 minute of state those RPCs keep (a probing version timed out at 55 s), so token validation happens off-chain in Task 10's `probe-tokens`.

- [ ] **Step 1: Write the failing test**

Create `contracts/test/ListTokens.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CallRegistry} from "../src/CallRegistry.sol";
import {BalanceModel} from "../src/CallTypes.sol";
import {ListTokens} from "../script/ListTokens.s.sol";
import {MockIdentityRegistry} from "./mocks/MockIdentityRegistry.sol";
import {MockReputationRegistry} from "./mocks/MockReputationRegistry.sol";

contract ListTokensTest is Test {
    ListTokens internal script;
    CallRegistry internal registry;

    function setUp() public {
        script = new ListTokens();
        MockIdentityRegistry identity = new MockIdentityRegistry();
        MockReputationRegistry reputation = new MockReputationRegistry(identity);
        registry = new CallRegistry(address(identity), address(reputation), address(script));
    }

    function test_tokensJsonHoldsThePackRegistry() public view {
        (address[] memory plain, address[] memory xstock) = script.loadTokens();
        assertEq(plain.length, 547);
        assertEq(xstock.length, 128);
        bool sawNvdab;
        bool sawNvdax;
        for (uint256 i = 0; i < plain.length; ++i) {
            if (plain[i] == 0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436) sawNvdab = true;
        }
        for (uint256 i = 0; i < xstock.length; ++i) {
            if (xstock[i] == 0xc845b2894dBddd03858fd2D643B4eF725fE0849d) sawNvdax = true;
        }
        assertTrue(sawNvdab, "NVDAB missing");
        assertTrue(sawNvdax, "NVDAx missing");
    }

    function test_listsEveryTokenInBatchesOf100() public {
        (address[] memory plain, address[] memory xstock) = script.loadTokens();

        ListTokens.Result memory result = script.list(registry, plain, xstock);

        assertEq(result.listedPlain, 547);
        assertEq(result.listedXStock, 128);
        assertEq(result.batches, 7);
        assertEq(uint8(registry.tokenModel(plain[0])), uint8(BalanceModel.PLAIN));
        assertEq(uint8(registry.tokenModel(plain[plain.length - 1])), uint8(BalanceModel.PLAIN));
        assertEq(uint8(registry.tokenModel(xstock[0])), uint8(BalanceModel.XSTOCK));
        assertEq(uint8(registry.tokenModel(xstock[xstock.length - 1])), uint8(BalanceModel.XSTOCK));
    }

    function test_listOnlyWorksForTheOwner() public {
        CallRegistry foreign = new CallRegistry(address(1), address(2), makeAddr("someoneElse"));
        address[] memory plain = new address[](1);
        address[] memory xstock = new address[](0);
        plain[0] = address(0xBEEF);
        vm.expectRevert(CallRegistry.NotOwner.selector);
        script.list(foreign, plain, xstock);
    }
}
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node contracts/run-forge.mjs test --match-contract ListTokensTest`
Expected: FAIL — `Error (6275): Source "script/ListTokens.s.sol" not found`

- [ ] **Step 3: Generate the token list**

Create `contracts/script/data/generate-tokens.mjs`:

```js
#!/usr/bin/env node
// Generates contracts/script/data/tokens.json from the resource pack's BSC tokenized-stock registry.
// bStock and Ondo rows list as PLAIN (raw balanceOf). Rebasing xStocks list as XSTOCK (sharesOf).
// Wrapped xStocks (symbol "w…x", e.g. wPOPMTx, wTCENTx) are non-rebasing ERC-4626 wrappers with no
// sharesOf — verified on BSC mainnet 2026-10-07 — so they list as PLAIN.
// Usage (from the repo root): node contracts/script/data/generate-tokens.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const csvRelative = "docs/resources/2026-10-05-bnb-hack-tokenized-stocks/data/bsc-tokenized-stocks-2026-10-05.csv";
const csvPath = join(here, "..", "..", "..", ...csvRelative.split("/"));
const outPath = join(here, "tokens.json");

const lines = readFileSync(csvPath, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim() !== "");
const plain = [];
const xstock = [];
const seen = new Set();

for (const line of lines.slice(1)) {
  const fields = line.split(",");
  const system = fields[0];
  const symbol = fields[2];
  const address = (fields[4] ?? "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    throw new Error(`bad address for ${symbol}: ${fields[4]}`);
  }
  if (seen.has(address)) {
    throw new Error(`duplicate address ${address} (${symbol})`);
  }
  seen.add(address);
  if (system === "bStock" || system === "Ondo") {
    plain.push(address);
  } else if (system === "xStocks" && /^w.+x$/.test(symbol)) {
    plain.push(address);
  } else if (system === "xStocks") {
    xstock.push(address);
  } else {
    throw new Error(`unknown system "${system}" for ${symbol}`);
  }
}

writeFileSync(outPath, `${JSON.stringify({ source: csvRelative, plain, xstock }, null, 2)}\n`);
console.log(`tokens.json written: plain=${plain.length} xstock=${xstock.length}`);
```

Run: `node contracts/script/data/generate-tokens.mjs`
Expected: `tokens.json written: plain=547 xstock=128` (this creates `contracts/script/data/tokens.json`; commit the generated file as-is)

- [ ] **Step 4: Write the listing script**

Create `contracts/script/ListTokens.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {CallRegistry} from "../src/CallRegistry.sol";
import {BalanceModel} from "../src/CallTypes.sol";

/// @notice Lists every token in script/data/tokens.json on the deployed CallRegistry, in batches.
/// The script makes no token calls, so its fork simulation stays well inside the ~1 minute of
/// state public BSC RPCs serve. Probe the tokens first with: node contracts/script/deployment.mjs probe-tokens
/// Run (human-gated, mainnet):
///   forge script script/ListTokens.s.sol:ListTokens --rpc-url <rpc> --broadcast
/// REGISTRY_ADDRESS and the owner key DEPLOYER_PK come from the environment; keys never appear in files.
contract ListTokens is Script {
    uint256 public constant BATCH = 100;

    struct Result {
        uint256 listedPlain;
        uint256 listedXStock;
        uint256 batches;
    }

    function run() external returns (Result memory result) {
        CallRegistry registry = CallRegistry(vm.envAddress("REGISTRY_ADDRESS"));
        (address[] memory plain, address[] memory xstock) = loadTokens();
        vm.startBroadcast(vm.envUint("DEPLOYER_PK"));
        result = list(registry, plain, xstock);
        vm.stopBroadcast();
        console2.log("listed PLAIN", result.listedPlain);
        console2.log("listed XSTOCK", result.listedXStock);
        console2.log("batches", result.batches);
    }

    function loadTokens() public view returns (address[] memory plain, address[] memory xstock) {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/script/data/tokens.json"));
        plain = vm.parseJsonAddressArray(json, ".plain");
        xstock = vm.parseJsonAddressArray(json, ".xstock");
    }

    /// @notice Calls setTokens in batches of BATCH: every PLAIN address first, then every XSTOCK address.
    function list(CallRegistry registry, address[] memory plain, address[] memory xstock)
        public
        returns (Result memory result)
    {
        uint256 total = plain.length + xstock.length;
        for (uint256 start = 0; start < total; start += BATCH) {
            uint256 size = total - start < BATCH ? total - start : BATCH;
            address[] memory tokens = new address[](size);
            BalanceModel[] memory models = new BalanceModel[](size);
            for (uint256 j = 0; j < size; ++j) {
                uint256 k = start + j;
                if (k < plain.length) {
                    tokens[j] = plain[k];
                    models[j] = BalanceModel.PLAIN;
                    ++result.listedPlain;
                } else {
                    tokens[j] = xstock[k - plain.length];
                    models[j] = BalanceModel.XSTOCK;
                    ++result.listedXStock;
                }
            }
            registry.setTokens(tokens, models);
            ++result.batches;
        }
    }
}
```

- [ ] **Step 5: Run to confirm it passes (gate)**

Run: `node contracts/run-forge.mjs test --match-contract ListTokensTest`
Expected: PASS — `Suite result: ok. 3 passed; 0 failed`

- [ ] **Step 6: Commit (kernel-performed — no agent runs this)**

Message: `feat(contracts): pack token list and batched ListTokens script`

---

### Task 9: DeployCallRegistry script

**Files:**
- Create: `contracts/script/DeployCallRegistry.s.sol`
- Test: `contracts/test/DeployCallRegistry.t.sol`

**Depends on:** Task 6
**Effort:** low
**Provides:** `DeployCallRegistry.deploy(address initialOwner) returns (CallRegistry)`, `DeployCallRegistry.run() (broadcasts with the DEPLOYER_PK env key; owner = broadcaster)`
**Requires:** `contract CallRegistry(address identityRegistry_, address reputationRegistry_, address initialOwner)`

- [ ] **Step 1: Write the failing test**

Create `contracts/test/DeployCallRegistry.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CallRegistry} from "../src/CallRegistry.sol";
import {DeployCallRegistry} from "../script/DeployCallRegistry.s.sol";

contract DeployCallRegistryTest is Test {
    function test_deployWiresTheMainnetErc8004Registries() public {
        DeployCallRegistry script = new DeployCallRegistry();
        address owner = makeAddr("deployer");
        CallRegistry registry = script.deploy(owner);
        assertEq(registry.identityRegistry(), 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432);
        assertEq(registry.reputationRegistry(), 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63);
        assertEq(registry.owner(), owner);
        assertEq(registry.callCount(), 0);
    }
}
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node contracts/run-forge.mjs test --match-contract DeployCallRegistryTest`
Expected: FAIL — `Error (6275): Source "script/DeployCallRegistry.s.sol" not found`

- [ ] **Step 3: Minimal implementation**

Create `contracts/script/DeployCallRegistry.s.sol` (the ERC-8004 addresses are the v2.0.0 BSC mainnet registries, checksums verified):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {CallRegistry} from "../src/CallRegistry.sol";

/// @notice Deploys CallRegistry on BSC mainnet, wired to the ERC-8004 v2.0.0 registries.
/// Run (human-gated, mainnet):
///   forge script script/DeployCallRegistry.s.sol:DeployCallRegistry --rpc-url <rpc> --broadcast
/// The broadcaster key comes from the DEPLOYER_PK environment variable and becomes the owner.
contract DeployCallRegistry is Script {
    address public constant IDENTITY_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
    address public constant REPUTATION_REGISTRY = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63;

    function run() external returns (CallRegistry registry) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);
        registry = deploy(deployer);
        vm.stopBroadcast();
        console2.log("CallRegistry deployed at", address(registry));
        console2.log("owner", deployer);
    }

    function deploy(address initialOwner) public returns (CallRegistry) {
        return new CallRegistry(IDENTITY_REGISTRY, REPUTATION_REGISTRY, initialOwner);
    }
}
```

- [ ] **Step 4: Run to confirm it passes (gate)**

Run: `node contracts/run-forge.mjs test --match-contract DeployCallRegistryTest`
Expected: PASS — `Suite result: ok. 1 passed; 0 failed`

- [ ] **Step 5: Commit (kernel-performed — no agent runs this)**

Message: `feat(contracts): DeployCallRegistry script wired to the ERC-8004 mainnet registries`

---

### Task 10: Deployment record, on-chain check and token probe tool

**Files:**
- Create: `contracts/script/deployment.mjs`
- Test: `contracts/script/deployment.test.mjs`

**Depends on:** Task 9
**Effort:** medium
**Provides:** `node contracts/script/deployment.mjs record | check [--tokens] | probe-tokens`, `deploymentFromBroadcast(broadcast) -> { chainId, callRegistry, deployTx, deployBlock, owner, identityRegistry, reputationRegistry }`, `checkDeployment(record, { rpcUrl, fetchImpl, tokens }) -> Promise<{ ok, problems, callCount }>`, `probeTokens(tokens, { rpcUrl, fetchImpl, batchSize, pauseMs, sleep }) -> Promise<{ probed, failed }>`
**Requires:** `DeployCallRegistry.run() (broadcasts with the DEPLOYER_PK env key; owner = broadcaster)`

`record` reads forge's broadcast log `contracts/broadcast/DeployCallRegistry.s.sol/56/run-latest.json` (Foundry 1.8.5 shape: `transactions[].{hash, transactionType: "CREATE", contractName, contractAddress, transaction.from}`, `receipts[].{status, blockNumber, transactionHash}`, `chain`) and writes `deployments/bsc-mainnet.json`. `check` reads that record back from chain with plain `eth_call`s (selectors hard-coded and listed in the file). `probe-tokens` is read-only: it sends every token in `contracts/script/data/tokens.json` its model's balance getter (`balanceOf` for PLAIN, `sharesOf` for XSTOCK) in JSON-RPC batches of 20 — public BSC RPCs reject batches of 50 with `method eth_call in batch triggered rate limit`, replying `[{"id":null,"error":…}]`, which the tool retries.

- [ ] **Step 1: Write the failing test**

Create `contracts/script/deployment.test.mjs`:

```js
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
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node --test contracts/script/deployment.test.mjs`
Expected: FAIL — `Cannot find module` … `contracts/script/deployment.mjs`

- [ ] **Step 3: Minimal implementation**

Create `contracts/script/deployment.mjs`:

```js
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
```

- [ ] **Step 4: Run to confirm it passes (gate)**

Run: `node --test contracts/script/deployment.test.mjs`
Expected: PASS — `pass 7` and `fail 0`

- [ ] **Step 5: Commit (kernel-performed — no agent runs this)**

Message: `feat(contracts): deployment record, on-chain check and token probe tool`

---

### Task 11: (HUMAN-GATED) Deploy CallRegistry to BSC mainnet and record it

**Files:**
- Create: `deployments/bsc-mainnet.json`

**Depends on:** Task 7, Task 8, Task 10
**Effort:** medium
**Model tier:** top
**Provides:** `deployments/bsc-mainnet.json { chainId, callRegistry, deployTx, deployBlock, owner, identityRegistry, reputationRegistry }`
**Requires:** `DeployCallRegistry.run() (broadcasts with the DEPLOYER_PK env key; owner = broadcaster)`, `node contracts/script/deployment.mjs record | check [--tokens] | probe-tokens`

Performed by the user (or the gate-concierge with the user's explicit go for this gate). Preconditions: a fresh burner deployer wallet holding about 0.005 BNB; its key exported in the current terminal only as `DEPLOYER_PK` (never pasted into a file or chat). Source verification is optional and separate (Step 6); it needs an Etherscan v2 API key (covers BscScan) exported as `ETHERSCAN_API_KEY`, which forge reads from the environment.

- [ ] **Step 1: Re-run the whole contract suite on the final commit**

Run: `node contracts/run-forge.mjs test`
Expected: `0 failed` across every suite

- [ ] **Step 2: Dry-run against mainnet state (no broadcast)**

Run: `node contracts/run-forge.mjs script script/DeployCallRegistry.s.sol:DeployCallRegistry --rpc-url https://bsc-dataseed.bnbchain.org`
Expected: `CallRegistry deployed at 0x…` in the simulation logs and `SIMULATION COMPLETE`

- [ ] **Step 3: Broadcast the deployment (spends BNB — human only)**

Run: `node contracts/run-forge.mjs script script/DeployCallRegistry.s.sol:DeployCallRegistry --rpc-url https://bsc-dataseed.bnbchain.org --broadcast`
Expected: `ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.`

- [ ] **Step 4: Record the deployment**

Run: `node contracts/script/deployment.mjs record`
Expected: `recorded CallRegistry 0x… (block …) -> deployments/bsc-mainnet.json`

- [ ] **Step 5: Check it on chain (gate)**

Run: `node contracts/script/deployment.mjs check`
Expected: PASS — `PASS registry=0x… owner=0x… callCount=0`

- [ ] **Step 6: (Optional) Verify the source on BscScan**

With `ETHERSCAN_API_KEY` exported, run from `contracts/`: `forge verify-contract <callRegistry from deployments/bsc-mainnet.json> src/CallRegistry.sol:CallRegistry --chain 56 --guess-constructor-args --rpc-url https://bsc-dataseed.bnbchain.org --watch`
Expected: `Contract successfully verified` (retry later if the explorer API is slow; nothing depends on it)

- [ ] **Step 7: Commit (kernel-performed — no agent runs this)**

Message: `chore(deploy): record CallRegistry deployment on BSC mainnet`

---

### Task 12: (HUMAN-GATED) List the 675 pack tokens on the deployed registry

**Files:** (none — this task changes on-chain state only)

**Depends on:** Task 11
**Effort:** medium
**Model tier:** top
**Provides:** `CallRegistry token list live on BSC mainnet (547 PLAIN + 128 XSTOCK)`
**Requires:** `deployments/bsc-mainnet.json { chainId, callRegistry, deployTx, deployBlock, owner, identityRegistry, reputationRegistry }`, `ListTokens.list(CallRegistry registry, address[] memory plain, address[] memory xstock) returns (Result memory result)`, `node contracts/script/deployment.mjs record | check [--tokens] | probe-tokens`

Performed by the user (or the gate-concierge with the user's explicit go). Same `DEPLOYER_PK` terminal as Task 11 (it is the registry owner). Set `REGISTRY_ADDRESS` in that terminal to `callRegistry` from `deployments/bsc-mainnet.json`.

- [ ] **Step 1: Probe every token read-only (no key, no gas)**

Run: `node contracts/script/deployment.mjs probe-tokens`
Expected: `PASS probed=675 failed=0` (on 2026-10-07 it passed in about 20 s). If any token fails, stop and report it — do not list it.

- [ ] **Step 2: Dry-run the listing against mainnet state**

Run: `node contracts/run-forge.mjs script script/ListTokens.s.sol:ListTokens --rpc-url https://bsc-dataseed.bnbchain.org`
Expected: logs `listed PLAIN 547`, `listed XSTOCK 128`, `batches 7` and `SIMULATION COMPLETE` (finishes in seconds; a `missing trie node` error means the RPC dropped the fork block — re-run)

- [ ] **Step 3: Broadcast the listing (7 transactions, spends BNB — human only)**

Run: `node contracts/run-forge.mjs script script/ListTokens.s.sol:ListTokens --rpc-url https://bsc-dataseed.bnbchain.org --broadcast`
Expected: `ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.`

- [ ] **Step 4: Check the list on chain (gate)**

Run: `node contracts/script/deployment.mjs check --tokens`
Expected: PASS — `PASS registry=0x… owner=0x… callCount=0 tokens=6/6`

- [ ] **Step 5: Commit (kernel-performed — no agent runs this)**

No files change; nothing to commit (manifest `allow_empty: true`).
Message: `chore(deploy): list the pack tokens on CallRegistry`
