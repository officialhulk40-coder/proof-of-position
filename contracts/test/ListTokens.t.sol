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
