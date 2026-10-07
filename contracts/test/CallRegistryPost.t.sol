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
