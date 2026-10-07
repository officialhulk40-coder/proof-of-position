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
