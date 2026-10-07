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
