// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Rebasing xStocks (Backed) share accounting, verified on BSC mainnet (AAPLx, 2026-10-06).
/// balanceOf(holder) == sharesOf(holder) * multiplier / 1e18; sharesOf never rebases.
interface IXStockShares {
    function sharesOf(address holder) external view returns (uint256);
    function getSharesByUnderlyingAmount(uint256 underlyingAmount) external view returns (uint256);
}
