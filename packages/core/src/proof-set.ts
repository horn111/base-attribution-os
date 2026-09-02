import {
  createAttributionReplayReport,
  type AttributionReplayCandidate,
  type AttributionReplayReport,
  type AttributionReplayTransaction,
} from "./replay.js";
import { hexByteLength, isHex, type Hex } from "./hex.js";
import { validateBuilderCodes } from "./validate.js";

export const ATTRIBUTION_PROOF_SET_SCHEMA_VERSION = 1 as const;
export const ATTRIBUTION_PROOF_SET_SCHEMA_URL =
  "https://raw.githubusercontent.com/horn111/base-attribution-os/main/proof-set.schema.json";
export const MAX_ATTRIBUTION_PROOF_SET_REPORTS = 100;
export const MAX_ATTRIBUTION_PROOF_SET_TRANSACTIONS = 10_000;

export interface AttributionProofSetNetworkSummary {
  chainId: number;
  network: string;
  reports: number;
  transactions: number;
}

export interface AttributionProofSetSummary {
  reports: number;
  networks: AttributionProofSetNetworkSummary[];
  total: number;
  attributed: number;
  missing: number;
  wrongCode: number;
  invalid: number;
  unavailable: number;
  verified: number;
  unverified: number;
  coverage: number;
}

export interface AttributionProofSet {
  $schema: string;
  schemaVersion: typeof ATTRIBUTION_PROOF_SET_SCHEMA_VERSION;
  title: string;
  builderCode: string;
  generatedAt: string;
  ok: boolean;
  reports: AttributionReplayReport[];
  summary: AttributionProofSetSummary;
}

export interface CreateAttributionProofSetOptions {
  title: string;
  builderCode: string;
}

interface UniqueTransaction {
  chainId: number;
  transaction: AttributionReplayTransaction;
}

const PROOF_SET_KEYS = new Set([
  "$schema",
  "schemaVersion",
  "title",
  "builderCode",
  "generatedAt",
  "ok",
  "reports",
  "summary",
]);
const REPORT_KEYS = new Set([
  "ok",
  "builderCode",
  "chainId",
  "network",
  "generatedAt",
  "total",
  "attributed",
  "missing",
  "wrongCode",
  "invalid",
  "unavailable",
  "verified",
  "unverified",
  "coverage",
  "transactions",
]);
const TRANSACTION_KEYS = new Set([
  "hash",
  "calldata",
  "verified",
  "blockNumber",
  "timestamp",
  "source",
  "error",
  "status",
  "codes",
  "schemaId",
  "explorerUrl",
]);

export function createAttributionProofSet(
  reports: AttributionReplayReport[],
  options: CreateAttributionProofSetOptions,
): AttributionProofSet {
  const title = normalizeTitle(options.title);
  assertBuilderCode(options.builderCode);

  if (!Array.isArray(reports) || reports.length === 0) {
    throw new Error("Attribution Proof Set requires at least one replay report.");
  }
  if (reports.length > MAX_ATTRIBUTION_PROOF_SET_REPORTS) {
    throw new Error(
      `Attribution Proof Set supports at most ${MAX_ATTRIBUTION_PROOF_SET_REPORTS} replay reports.`,
    );
  }

  const normalizedReports = reports
    .map((report, index) => normalizeReport(report, options.builderCode, index))
    .sort(compareReports);
  const uniqueTransactions = collectUniqueTransactions(normalizedReports);

  if (uniqueTransactions.length > MAX_ATTRIBUTION_PROOF_SET_TRANSACTIONS) {
    throw new Error(
      `Attribution Proof Set supports at most ${MAX_ATTRIBUTION_PROOF_SET_TRANSACTIONS} unique transactions.`,
    );
  }

  const summary = summarize(normalizedReports, uniqueTransactions);
  const generatedAt = normalizedReports.reduce(
    (latest, report) => (report.generatedAt > latest ? report.generatedAt : latest),
    normalizedReports[0].generatedAt,
  );

  return {
    $schema: ATTRIBUTION_PROOF_SET_SCHEMA_URL,
    schemaVersion: ATTRIBUTION_PROOF_SET_SCHEMA_VERSION,
    title,
    builderCode: options.builderCode,
    generatedAt,
    ok:
      summary.total > 0 &&
      summary.attributed === summary.total &&
      summary.verified === summary.total,
    reports: normalizedReports,
    summary,
  };
}

export function parseAttributionProofSet(value: unknown): AttributionProofSet {
  const input = assertRecord(value, "Attribution Proof Set manifest");
  assertOnlyKeys(input, PROOF_SET_KEYS, "Attribution Proof Set manifest");

  if (input.$schema !== ATTRIBUTION_PROOF_SET_SCHEMA_URL) {
    throw new Error(`Unsupported Attribution Proof Set schema: ${String(input.$schema)}.`);
  }
  if (input.schemaVersion !== ATTRIBUTION_PROOF_SET_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported Attribution Proof Set schemaVersion: ${String(input.schemaVersion)}.`,
    );
  }
  if (!Array.isArray(input.reports)) {
    throw new Error("Attribution Proof Set reports must be an array.");
  }

  const canonical = createAttributionProofSet(input.reports as AttributionReplayReport[], {
    title: assertString(input.title, "Attribution Proof Set title"),
    builderCode: assertString(input.builderCode, "Attribution Proof Set Builder Code"),
  });

  if (!sameJson(input, canonical)) {
    throw new Error(
      "Attribution Proof Set derived fields do not match its replay reports. Regenerate the manifest with bao proof-set.",
    );
  }

  return canonical;
}

function normalizeReport(
  value: AttributionReplayReport,
  expectedBuilderCode: string,
  reportIndex: number,
): AttributionReplayReport {
  const report = assertRecord(value, `Replay report ${reportIndex + 1}`);
  assertOnlyKeys(report, REPORT_KEYS, `Replay report ${reportIndex + 1}`);

  if (report.builderCode !== expectedBuilderCode) {
    throw new Error(
      `Replay report ${reportIndex + 1} uses Builder Code ${String(report.builderCode)} instead of ${expectedBuilderCode}.`,
    );
  }
  const chainId = assertPositiveInteger(report.chainId, `Replay report ${reportIndex + 1} chainId`);
  const generatedAt = normalizeTimestamp(
    report.generatedAt,
    `Replay report ${reportIndex + 1} generatedAt`,
  );
  if (!Array.isArray(report.transactions) || report.transactions.length === 0) {
    throw new Error(`Replay report ${reportIndex + 1} must contain at least one transaction.`);
  }

  const candidates = report.transactions.map((transaction, transactionIndex) =>
    normalizeCandidate(transaction, reportIndex, transactionIndex),
  );
  const normalized = createAttributionReplayReport(candidates, {
    builderCode: expectedBuilderCode,
    chainId,
    generatedAt,
  });

  return {
    ...normalized,
    transactions: [...normalized.transactions].sort((left, right) =>
      left.hash.toLowerCase().localeCompare(right.hash.toLowerCase()),
    ),
  };
}

function normalizeCandidate(
  value: unknown,
  reportIndex: number,
  transactionIndex: number,
): AttributionReplayCandidate {
  const label = `Replay report ${reportIndex + 1} transaction ${transactionIndex + 1}`;
  const transaction = assertRecord(value, label);
  assertOnlyKeys(transaction, TRANSACTION_KEYS, label);
  const hash = assertTransactionHash(transaction.hash, `${label} hash`);
  const candidate: AttributionReplayCandidate = { hash };

  if (transaction.calldata !== undefined) {
    candidate.calldata = assertHex(transaction.calldata, `${label} calldata`);
  }
  if (transaction.verified !== undefined) {
    if (typeof transaction.verified !== "boolean") {
      throw new Error(`${label} verified must be a boolean.`);
    }
    candidate.verified = transaction.verified;
  }
  if (transaction.blockNumber !== undefined) {
    if (
      typeof transaction.blockNumber !== "string" &&
      typeof transaction.blockNumber !== "number"
    ) {
      throw new Error(`${label} blockNumber must be a string or number.`);
    }
    candidate.blockNumber = transaction.blockNumber;
  }
  if (transaction.timestamp !== undefined) {
    candidate.timestamp = normalizeTimestamp(transaction.timestamp, `${label} timestamp`);
  }
  for (const key of ["source", "error"] as const) {
    const field = transaction[key];
    if (field !== undefined) {
      candidate[key] = assertString(field, `${label} ${key}`);
    }
  }

  return candidate;
}

function collectUniqueTransactions(reports: AttributionReplayReport[]): UniqueTransaction[] {
  const unique = new Map<string, UniqueTransaction>();

  for (const report of reports) {
    for (const transaction of report.transactions) {
      const key = `${report.chainId}:${transaction.hash.toLowerCase()}`;
      const current = unique.get(key);

      if (!current) {
        unique.set(key, { chainId: report.chainId, transaction: { ...transaction } });
        continue;
      }

      if (!sameTransactionEvidence(current.transaction, transaction)) {
        throw new Error(
          `Conflicting proof evidence for transaction ${transaction.hash} on chain ${report.chainId}.`,
        );
      }

      if (transaction.verified && !current.transaction.verified) {
        current.transaction = { ...transaction, verified: true };
      }
    }
  }

  return [...unique.values()].sort(
    (left, right) =>
      left.chainId - right.chainId ||
      left.transaction.hash.toLowerCase().localeCompare(right.transaction.hash.toLowerCase()),
  );
}

function sameTransactionEvidence(
  left: AttributionReplayTransaction,
  right: AttributionReplayTransaction,
): boolean {
  return (
    left.calldata?.toLowerCase() === right.calldata?.toLowerCase() &&
    left.status === right.status &&
    left.schemaId === right.schemaId &&
    sameJson(left.codes, right.codes)
  );
}

function summarize(
  reports: AttributionReplayReport[],
  uniqueTransactions: UniqueTransaction[],
): AttributionProofSetSummary {
  const networkReports = new Map<number, { network: string; reports: number }>();
  for (const report of reports) {
    const current = networkReports.get(report.chainId);
    networkReports.set(report.chainId, {
      network: report.network,
      reports: (current?.reports ?? 0) + 1,
    });
  }

  const networkTransactions = new Map<number, number>();
  for (const entry of uniqueTransactions) {
    networkTransactions.set(entry.chainId, (networkTransactions.get(entry.chainId) ?? 0) + 1);
  }

  const total = uniqueTransactions.length;
  const countStatus = (status: AttributionReplayTransaction["status"]): number =>
    uniqueTransactions.filter(({ transaction }) => transaction.status === status).length;
  const attributed = countStatus("attributed");
  const verified = uniqueTransactions.filter(({ transaction }) => transaction.verified).length;

  return {
    reports: reports.length,
    networks: [...networkReports.entries()]
      .sort(([left], [right]) => left - right)
      .map(([chainId, entry]) => ({
        chainId,
        network: entry.network,
        reports: entry.reports,
        transactions: networkTransactions.get(chainId) ?? 0,
      })),
    total,
    attributed,
    missing: countStatus("missing-attribution"),
    wrongCode: countStatus("wrong-builder-code"),
    invalid: countStatus("invalid-attribution"),
    unavailable: countStatus("unavailable"),
    verified,
    unverified: total - verified,
    coverage: total === 0 ? 0 : Math.round((attributed / total) * 100),
  };
}

function compareReports(left: AttributionReplayReport, right: AttributionReplayReport): number {
  return (
    left.generatedAt.localeCompare(right.generatedAt) ||
    left.chainId - right.chainId ||
    (left.transactions[0]?.hash ?? "").localeCompare(right.transactions[0]?.hash ?? "") ||
    JSON.stringify(left).localeCompare(JSON.stringify(right))
  );
}

function normalizeTitle(value: unknown): string {
  const title = assertString(value, "Attribution Proof Set title").trim();
  if (title.length === 0 || title.length > 120) {
    throw new Error("Attribution Proof Set title must contain 1-120 characters.");
  }
  return title;
}

function assertBuilderCode(value: string): void {
  const errors = validateBuilderCodes([value]);
  if (errors.length > 0) {
    throw new Error(`Invalid Attribution Proof Set Builder Code: ${errors.join("; ")}`);
  }
}

function assertTransactionHash(value: unknown, label: string): Hex {
  const hash = assertHex(value, label);
  if (hexByteLength(hash) !== 32) {
    throw new Error(`${label} must contain 32 bytes.`);
  }
  return hash.toLowerCase() as Hex;
}

function assertHex(value: unknown, label: string): Hex {
  if (typeof value !== "string" || !isHex(value)) {
    throw new Error(`${label} must be an even-length 0x-prefixed hex string.`);
  }
  return value.toLowerCase() as Hex;
}

function normalizeTimestamp(value: unknown, label: string): string {
  const timestamp = assertString(value, label);
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`${label} must be a valid ISO-8601 timestamp.`);
  }
  return new Date(milliseconds).toISOString();
}

function assertPositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
  return value;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  return value;
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: Set<string>, label: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(`${label} contains unsupported field(s): ${unknown.join(", ")}.`);
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => sameJson(entry, right[index]))
    );
  }
  if (typeof left === "object" && left !== null && typeof right === "object" && right !== null) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();
    return (
      sameJson(leftKeys, rightKeys) &&
      leftKeys.every((key) => sameJson(leftRecord[key], rightRecord[key]))
    );
  }
  return false;
}
