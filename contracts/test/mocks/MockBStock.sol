// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockPlainToken} from "./MockPlainToken.sol";

/// @notice bStock shape: raw balanceOf never rebases; uiMultiplier only scales the display amount.
contract MockBStock is MockPlainToken {
    uint256 public uiMultiplier = 1e18;

    constructor(string memory symbol_) MockPlainToken(symbol_) {}

    function setUiMultiplier(uint256 multiplier) external {
        uiMultiplier = multiplier;
    }

    function balanceOfUI(address holder) external view returns (uint256) {
        return balanceOf[holder] * uiMultiplier / 1e18;
    }
}
