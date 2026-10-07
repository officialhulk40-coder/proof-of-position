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
