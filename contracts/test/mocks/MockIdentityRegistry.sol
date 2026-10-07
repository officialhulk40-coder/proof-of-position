// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice ERC-8004 IdentityRegistry v2.0.0 behaviour that CallRegistry depends on.
contract MockIdentityRegistry {
    mapping(uint256 => address) public ownerOfAgent;
    mapping(uint256 => address) internal _wallets;

    function setAgent(uint256 agentId, address owner_, address wallet) external {
        ownerOfAgent[agentId] = owner_;
        _wallets[agentId] = wallet;
    }

    /// @dev Unknown ids return address(0), exactly like the deployed registry.
    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _wallets[agentId];
    }

    /// @dev Reverts for unknown ids (the deployed registry reverts ERC721NonexistentToken).
    function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool) {
        address agentOwner = ownerOfAgent[agentId];
        require(agentOwner != address(0), "ERC721NonexistentToken");
        return spender == agentOwner;
    }
}
