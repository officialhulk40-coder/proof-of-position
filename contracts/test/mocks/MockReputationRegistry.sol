// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockIdentityRegistry} from "./MockIdentityRegistry.sol";

/// @notice ERC-8004 ReputationRegistry v2.0.0 giveFeedback rules, recording every accepted entry.
contract MockReputationRegistry {
    struct Entry {
        uint256 agentId;
        address client;
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
    }

    MockIdentityRegistry public immutable identity;
    Entry[] internal _entries;

    constructor(MockIdentityRegistry identity_) {
        identity = identity_;
    }

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        require(valueDecimals <= 18, "too many decimals");
        require(!identity.isAuthorizedOrOwner(msg.sender, agentId), "Self-feedback not allowed");
        _entries.push(Entry(agentId, msg.sender, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash));
    }

    function count() external view returns (uint256) {
        return _entries.length;
    }

    function entry(uint256 index) external view returns (Entry memory) {
        return _entries[index];
    }
}
