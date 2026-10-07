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
