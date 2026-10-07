// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice How CallRegistry measures a holder's position in a listed token.
/// PLAIN: raw balanceOf (bStocks, Ondo). XSTOCK: non-rebasing sharesOf (xStocks).
enum BalanceModel {
    UNLISTED,
    PLAIN,
    XSTOCK
}

/// @notice A call's badge. HOLDING/TRIMMED/EXITED are live reads of the caller's balance; CLOSED is final.
enum Status {
    HOLDING,
    TRIMMED,
    EXITED,
    CLOSED
}

/// @notice One public LONG call. Field order is part of the ABI consumed by @pop/core.
struct Call {
    address caller;
    address token;
    BalanceModel model;
    bool hasAgent;
    bool heldThrough;
    Status exitStatus;
    uint64 postedBlock;
    uint64 postedAt;
    uint64 closedBlock;
    uint64 exitBlock;
    uint256 agentId;
    uint256 declaredAmount;
    uint256 declaredBase;
    string note;
}
