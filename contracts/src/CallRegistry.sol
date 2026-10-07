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

    // ───────────────────────────── posting ─────────────────────────────

    /// @notice Post a LONG call. Reverts "No position, no call." unless the caller holds `amount` right now.
    function post(address token, uint256 amount, string calldata note) external returns (uint256 callId) {
        return _post(token, amount, false, 0, note);
    }

    /// @notice Post as an ERC-8004 agent; msg.sender must be the agent's registered wallet.
    function postAsAgent(address token, uint256 amount, uint256 agentId, string calldata note)
        external
        returns (uint256 callId)
    {
        if (IAgentIdentityRegistry(identityRegistry).getAgentWallet(agentId) != msg.sender) {
            revert NotAgentWallet(agentId);
        }
        return _post(token, amount, true, agentId, note);
    }

    function _post(address token, uint256 amount, bool hasAgent, uint256 agentId, string calldata note)
        internal
        returns (uint256 callId)
    {
        BalanceModel model = tokenModel[token];
        if (model == BalanceModel.UNLISTED) revert TokenNotListed(token);
        if (amount == 0) revert ZeroAmount();
        uint256 noteLength = bytes(note).length;
        if (noteLength > MAX_NOTE_BYTES) revert NoteTooLong(noteLength);
        uint256 openPlusOne = _openCallPlusOne[msg.sender][token];
        if (openPlusOne != 0) revert CallAlreadyOpen(openPlusOne - 1);

        require(IBalanceToken(token).balanceOf(msg.sender) >= amount, "No position, no call.");

        uint256 declaredBase = amount;
        if (model == BalanceModel.XSTOCK) {
            declaredBase = IXStockShares(token).getSharesByUnderlyingAmount(amount);
            if (declaredBase == 0) revert ZeroAmount();
        }

        callId = _calls.length;
        _calls.push(
            Call({
                caller: msg.sender,
                token: token,
                model: model,
                hasAgent: hasAgent,
                heldThrough: false,
                exitStatus: Status.HOLDING,
                postedBlock: uint64(block.number),
                postedAt: uint64(block.timestamp),
                closedBlock: 0,
                exitBlock: 0,
                agentId: agentId,
                declaredAmount: amount,
                declaredBase: declaredBase,
                note: note
            })
        );
        _openCallPlusOne[msg.sender][token] = callId + 1;
        emit CallPosted(callId, msg.sender, token, amount, agentId, hasAgent, note);
    }

    // ───────────────────────────── views ─────────────────────────────

    function callCount() external view returns (uint256) {
        return _calls.length;
    }

    function getCall(uint256 callId) external view returns (Call memory) {
        return _existing(callId);
    }

    /// @notice HOLDING / TRIMMED / EXITED from the caller's current balance, ignoring closure.
    function liveStatus(uint256 callId) external view returns (Status status) {
        (status,) = _live(_existing(callId));
    }

    /// @notice CLOSED once closed, otherwise the live status.
    function statusOf(uint256 callId) external view returns (Status) {
        return _statusOf(_existing(callId));
    }

    /// @notice A page of calls with their statuses; clamps to callCount().
    function getCalls(uint256 start, uint256 count) external view returns (Call[] memory calls, Status[] memory statuses) {
        uint256 total = _calls.length;
        if (start >= total) return (new Call[](0), new Status[](0));
        uint256 n = total - start;
        if (count < n) n = count;
        calls = new Call[](n);
        statuses = new Status[](n);
        for (uint256 i = 0; i < n; ++i) {
            Call storage c = _calls[start + i];
            calls[i] = c;
            statuses[i] = _statusOf(c);
        }
    }

    function openCallOf(address caller, address token) external view returns (bool open, uint256 callId) {
        uint256 plusOne = _openCallPlusOne[caller][token];
        if (plusOne == 0) return (false, 0);
        return (true, plusOne - 1);
    }

    function _existing(uint256 callId) internal view returns (Call storage) {
        if (callId >= _calls.length) revert UnknownCall(callId);
        return _calls[callId];
    }

    function _statusOf(Call storage c) internal view returns (Status status) {
        if (c.closedBlock != 0) return Status.CLOSED;
        (status,) = _live(c);
    }

    function _live(Call storage c) internal view returns (Status status, uint256 base) {
        base = c.model == BalanceModel.XSTOCK
            ? IXStockShares(c.token).sharesOf(c.caller)
            : IBalanceToken(c.token).balanceOf(c.caller);
        if (base >= c.declaredBase) status = Status.HOLDING;
        else if (base == 0) status = Status.EXITED;
        else status = Status.TRIMMED;
    }
}
