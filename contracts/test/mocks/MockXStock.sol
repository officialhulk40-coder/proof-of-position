// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Rebasing xStock shape (Backed): balanceOf = sharesOf * multiplier / 1e18, both rounding down.
contract MockXStock {
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public multiplier = 1e18;
    mapping(address => uint256) public sharesOf;

    constructor(string memory symbol_) {
        symbol = symbol_;
    }

    function setMultiplier(uint256 newMultiplier) external {
        multiplier = newMultiplier;
    }

    function setShares(address holder, uint256 shares) external {
        sharesOf[holder] = shares;
    }

    function balanceOf(address holder) external view returns (uint256) {
        return sharesOf[holder] * multiplier / 1e18;
    }

    function getSharesByUnderlyingAmount(uint256 underlyingAmount) external view returns (uint256) {
        return underlyingAmount * 1e18 / multiplier;
    }

    function getUnderlyingAmountByShares(uint256 shares) external view returns (uint256) {
        return shares * multiplier / 1e18;
    }
}
