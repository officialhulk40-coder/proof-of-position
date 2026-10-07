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
