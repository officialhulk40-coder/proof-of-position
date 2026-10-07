// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice ERC-8004 ReputationRegistry v2.0.0 subset (BSC mainnet 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63).
/// @dev Reverts "Self-feedback not allowed" when msg.sender is the agent's owner or approved operator.
interface IAgentReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;
}
