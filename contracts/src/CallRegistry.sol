// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BalanceModel, Status, Call} from "./CallTypes.sol";
import {IBalanceToken} from "./interfaces/IBalanceToken.sol";
import {IXStockShares} from "./interfaces/IXStockShares.sol";
import {IAgentIdentityRegistry} from "./interfaces/IAgentIdentityRegistry.sol";
import {IAgentReputationRegistry} from "./interfaces/IAgentReputationRegistry.sol";

/// @title CallRegistry — "No position, no call."
/// @notice Public LONG calls on tokenized stocks, each backed by the caller's live on-chain balance.
/// The registry never holds or moves tokens; its owner can only edit the token list.
contract CallRegistry {
    uint256 public constant MAX_NOTE_BYTES = 280;
    uint256 public constant FEEDBACK_GAS = 400_000;
    uint256 public constant FEEDBACK_GAS_RESERVE = 40_000;
    string public constant INTEGRITY_TAG = "integrity";
    int128 public constant HELD_VALUE = 100;
    int128 public constant TRIMMED_VALUE = 50;
    int128 public constant EXITED_VALUE = 0;

    address public immutable identityRegistry;
    address public immutable reputationRegistry;
    address public owner;

    mapping(address token => BalanceModel model) public tokenModel;

    Call[] private _calls;
    mapping(address caller => mapping(address token => uint256 callIdPlusOne)) private _openCallPlusOne;

    event TokenListed(address indexed token, BalanceModel model);
    event CallPosted(
        uint256 indexed callId,
        address indexed caller,
        address indexed token,
        uint256 declaredAmount,
        uint256 agentId,
        bool hasAgent,
        string note
    );
    event ExitRecorded(uint256 indexed callId, Status status, uint256 baseBalance, address recordedBy);
    event CallClosed(uint256 indexed callId, bool heldThrough);
    event FeedbackWritten(uint256 indexed callId, uint256 indexed agentId, int128 value, string tag2);
    event FeedbackFailed(uint256 indexed callId, uint256 indexed agentId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error LengthMismatch();
    error TokenNotListed(address token);
    error ZeroAmount();
    error NoteTooLong(uint256 length);
    error CallAlreadyOpen(uint256 callId);
    error NotAgentWallet(uint256 agentId);
    error UnknownCall(uint256 callId);
    error NotCaller(uint256 callId);
    error CallNotOpen(uint256 callId);
    error StillHolding(uint256 callId);
    error ExitAlreadyRecorded(uint256 callId);
    error InsufficientGas();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address identityRegistry_, address reputationRegistry_, address initialOwner) {
        if (identityRegistry_ == address(0) || reputationRegistry_ == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        identityRegistry = identityRegistry_;
        reputationRegistry = reputationRegistry_;
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    // ───────────────────────────── owner: token list ─────────────────────────────

    /// @notice List (PLAIN / XSTOCK) or delist (UNLISTED) tokens. Owner-only; no external calls, so a
    /// listing batch costs the same whatever the tokens are. A wrongly listed token cannot be posted
    /// against (its balance read reverts inside post), and the owner can delist it.
    function setTokens(address[] calldata tokens, BalanceModel[] calldata models) external onlyOwner {
        if (tokens.length != models.length) revert LengthMismatch();
        for (uint256 i = 0; i < tokens.length; ++i) {
            address token = tokens[i];
            if (token == address(0)) revert ZeroAddress();
            tokenModel[token] = models[i];
            emit TokenListed(token, models[i]);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
