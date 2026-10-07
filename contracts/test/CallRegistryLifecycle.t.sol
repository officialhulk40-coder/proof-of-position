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
