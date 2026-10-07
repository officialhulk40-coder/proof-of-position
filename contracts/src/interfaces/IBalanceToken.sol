// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The only ERC-20 surface CallRegistry reads: the holder's raw balance.
interface IBalanceToken {
    function balanceOf(address holder) external view returns (uint256);
}
