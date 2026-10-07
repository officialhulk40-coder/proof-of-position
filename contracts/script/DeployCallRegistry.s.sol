// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {CallRegistry} from "../src/CallRegistry.sol";

/// @notice Deploys CallRegistry on BSC mainnet, wired to the ERC-8004 v2.0.0 registries.
/// Run (human-gated, mainnet):
///   forge script script/DeployCallRegistry.s.sol:DeployCallRegistry --rpc-url <rpc> --broadcast
/// The broadcaster key comes from the DEPLOYER_PK environment variable and becomes the owner.
contract DeployCallRegistry is Script {
    address public constant IDENTITY_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
    address public constant REPUTATION_REGISTRY = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63;

    function run() external returns (CallRegistry registry) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);
        registry = deploy(deployer);
        vm.stopBroadcast();
        console2.log("CallRegistry deployed at", address(registry));
        console2.log("owner", deployer);
    }

    function deploy(address initialOwner) public returns (CallRegistry) {
        return new CallRegistry(IDENTITY_REGISTRY, REPUTATION_REGISTRY, initialOwner);
    }
}
