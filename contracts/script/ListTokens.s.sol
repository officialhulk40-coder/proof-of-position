// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {CallRegistry} from "../src/CallRegistry.sol";
import {BalanceModel} from "../src/CallTypes.sol";

/// @notice Lists every token in script/data/tokens.json on the deployed CallRegistry, in batches.
/// The script makes no token calls, so its fork simulation stays well inside the ~1 minute of
/// state public BSC RPCs serve. Probe the tokens first with: node contracts/script/deployment.mjs probe-tokens
/// Run (human-gated, mainnet):
///   forge script script/ListTokens.s.sol:ListTokens --rpc-url <rpc> --broadcast
/// REGISTRY_ADDRESS and the owner key DEPLOYER_PK come from the environment; keys never appear in files.
contract ListTokens is Script {
    uint256 public constant BATCH = 100;

    struct Result {
        uint256 listedPlain;
        uint256 listedXStock;
        uint256 batches;
    }

    function run() external returns (Result memory result) {
        CallRegistry registry = CallRegistry(vm.envAddress("REGISTRY_ADDRESS"));
        (address[] memory plain, address[] memory xstock) = loadTokens();
        vm.startBroadcast(vm.envUint("DEPLOYER_PK"));
        result = list(registry, plain, xstock);
        vm.stopBroadcast();
        console2.log("listed PLAIN", result.listedPlain);
        console2.log("listed XSTOCK", result.listedXStock);
        console2.log("batches", result.batches);
    }

    function loadTokens() public view returns (address[] memory plain, address[] memory xstock) {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/script/data/tokens.json"));
        plain = vm.parseJsonAddressArray(json, ".plain");
        xstock = vm.parseJsonAddressArray(json, ".xstock");
    }

    /// @notice Calls setTokens in batches of BATCH: every PLAIN address first, then every XSTOCK address.
    function list(CallRegistry registry, address[] memory plain, address[] memory xstock)
        public
        returns (Result memory result)
    {
        uint256 total = plain.length + xstock.length;
        for (uint256 start = 0; start < total; start += BATCH) {
            uint256 size = total - start < BATCH ? total - start : BATCH;
            address[] memory tokens = new address[](size);
            BalanceModel[] memory models = new BalanceModel[](size);
            for (uint256 j = 0; j < size; ++j) {
                uint256 k = start + j;
                if (k < plain.length) {
                    tokens[j] = plain[k];
                    models[j] = BalanceModel.PLAIN;
                    ++result.listedPlain;
                } else {
                    tokens[j] = xstock[k - plain.length];
                    models[j] = BalanceModel.XSTOCK;
                    ++result.listedXStock;
                }
            }
            registry.setTokens(tokens, models);
            ++result.batches;
        }
    }
}
