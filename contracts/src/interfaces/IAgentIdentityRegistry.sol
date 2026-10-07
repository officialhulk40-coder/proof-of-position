// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice ERC-8004 IdentityRegistry v2.0.0 subset (BSC mainnet 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432).
interface IAgentIdentityRegistry {
    /// @dev Returns address(0) for unknown agent ids (no revert).
    function getAgentWallet(uint256 agentId) external view returns (address);
}
