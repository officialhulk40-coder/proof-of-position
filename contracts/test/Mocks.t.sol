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
