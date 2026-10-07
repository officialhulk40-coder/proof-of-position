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
