// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Plain ERC-20 balance book (stands in for Ondo tokens and the raw side of bStocks).
contract MockPlainToken {
    string public symbol;
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;

    constructor(string memory symbol_) {
        symbol = symbol_;
    }

    function setBalance(address holder, uint256 amount) external {
        balanceOf[holder] = amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
