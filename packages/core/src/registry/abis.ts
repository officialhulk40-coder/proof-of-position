import { parseAbi } from "viem";

export const ERC20_ABI = parseAbi([
  "function balanceOf(address holder) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

/** ERC-8004 ReputationRegistry v2.0.0 (BSC mainnet), read side. */
export const REPUTATION_REGISTRY_ABI = parseAbi([
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex) view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)",
  "function getLastIndex(uint256 agentId, address clientAddress) view returns (uint64)",
]);

/** ERC-8004 IdentityRegistry v2.0.0 (BSC mainnet). */
export const IDENTITY_REGISTRY_ABI = parseAbi([
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function ownerOf(uint256 agentId) view returns (address)",
  "function tokenURI(uint256 agentId) view returns (string)",
  "function register(string agentURI) returns (uint256 agentId)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);
