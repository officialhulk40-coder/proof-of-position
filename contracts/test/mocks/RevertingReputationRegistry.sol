// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice A reputation registry that always reverts, to prove feedback failures never block CallRegistry.
contract RevertingReputationRegistry {
    function giveFeedback(uint256, int128, uint8, string calldata, string calldata, string calldata, string calldata, bytes32)
        external
        pure
    {
        revert("registry down");
    }
}
