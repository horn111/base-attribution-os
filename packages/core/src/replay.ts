import { decodeAttributionFromCalldata } from "./decode.js";
import { hasErc8021Marker, type Hex } from "./hex.js";
import { validateBuilderCodes } from "./validate.js";

export type AttributionReplayStatus =
  | "attributed"
  | "invalid-attribution"
  | "missing-attribution"
  | "unavailable"
  | "wrong-builder-code";

export interface AttributionReplayCandidate {
  hash: Hex;
  calldata?: Hex;
  verified?: boolean;
  blockNumber?: number | string;
  timestamp?: string;
  source?: string;
  error?: string;
}

export interface AttributionReplayTransaction extends AttributionReplayCandidate {
  status: AttributionReplayStatus;
  codes: string[];
  schemaId?: number;
  explorerUrl?: string;
}

export interface AttributionReplayReport {
  ok: boolean;
  builderCode: string;
  chainId: number;
  network: string;
  generatedAt: string;
  total: number;
  attributed: number;
  missing: number;
  wrongCode: number;
  invalid: number;
  unavailable: number;
  verified: number;
  unverified: number;
  coverage: number;
  transactions: AttributionReplayTransaction[];
}

export interface CreateAttributionReplayOptions {
  builderCode: string;
  chainId?: number;
  generatedAt?: string;
  explorerBaseUrl?: string;
}

const NETWORKS: Record<number, { name: string; explorerBaseUrl: string }> = {
  8453: { name: "Base mainnet", explorerBaseUrl: "https://basescan.org" },
  84532: { name: "Base Sepolia", explorerBaseUrl: "https://sepolia.basescan.org" },
};

export function createAttributionReplayReport(
  candidates: AttributionReplayCandidate[],
  options: CreateAttributionReplayOptions,
): AttributionReplayReport {
  const codeErrors = validateBuilderCodes([options.builderCode]);

  if (codeErrors.length > 0) {
    throw new Error(`Invalid Builder Code: ${codeErrors.join("; ")}`);
  }

  const chainId = options.chainId ?? 8453;
  const network = NETWORKS[chainId]?.name ?? `Chain ${chainId}`;
  const explorerBaseUrl = options.explorerBaseUrl ?? NETWORKS[chainId]?.explorerBaseUrl;
  const transactions = candidates.map((candidate) =>
    analyzeCandidate(candidate, options.builderCode, explorerBaseUrl),
  );
  const attributed = countStatus(transactions, "attributed");
  const missing = countStatus(transactions, "missing-attribution");
  const wrongCode = countStatus(transactions, "wrong-builder-code");
  const invalid = countStatus(transactions, "invalid-attribution");
  const unavailable = countStatus(transactions, "unavailable");
  const verified = transactions.filter((transaction) => transaction.verified).length;
  const total = transactions.length;

  return {
    ok: total > 0 && attributed === total && verified === total,
    builderCode: options.builderCode,
    chainId,
    network,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    total,
    attributed,
    missing,
    wrongCode,
    invalid,
    unavailable,
    verified,
    unverified: total - verified,
    coverage: total === 0 ? 0 : Math.round((attributed / total) * 100),
    transactions,
  };
}

function analyzeCandidate(
  candidate: AttributionReplayCandidate,
  builderCode: string,
  explorerBaseUrl?: string,
): AttributionReplayTransaction {
  const explorerUrl =
    explorerBaseUrl && candidate.verified
      ? `${explorerBaseUrl.replace(/\/$/, "")}/tx/${candidate.hash}`
      : undefined;

  if (candidate.error || candidate.calldata === undefined) {
    return {
      ...candidate,
      status: "unavailable",
      codes: [],
      explorerUrl,
      error: candidate.error ?? "transaction calldata is unavailable",
    };
  }

  let decoded;

  try {
    decoded = decodeAttributionFromCalldata(candidate.calldata);
  } catch (error) {
    return {
      ...candidate,
      status: "invalid-attribution",
      codes: [],
      explorerUrl,
      error: error instanceof Error ? error.message : "invalid transaction calldata",
    };
  }

  if (!decoded) {
    return {
      ...candidate,
      status: hasMarker(candidate.calldata) ? "invalid-attribution" : "missing-attribution",
      codes: [],
      explorerUrl,
    };
  }

  const decodedCodeErrors = validateBuilderCodes(decoded.codes);
  if (decodedCodeErrors.length > 0) {
    return {
      ...candidate,
      status: "invalid-attribution",
      codes: decoded.codes,
      schemaId: decoded.id,
      explorerUrl,
      error: decodedCodeErrors.join("; "),
    };
  }

  return {
    ...candidate,
    status: decoded.codes.includes(builderCode) ? "attributed" : "wrong-builder-code",
    codes: decoded.codes,
    schemaId: decoded.id,
    explorerUrl,
  };
}

function hasMarker(calldata: Hex): boolean {
  try {
    return hasErc8021Marker(calldata);
  } catch {
    return false;
  }
}

function countStatus(
  transactions: AttributionReplayTransaction[],
  status: AttributionReplayStatus,
): number {
  return transactions.filter((transaction) => transaction.status === status).length;
}
