import type { AttributionReplayStatus } from "@base-attribution-os/core";

export type DashboardTransaction = {
  hash: string;
  chainId: number;
  network: string;
  source: string;
  status: AttributionReplayStatus;
  verified: boolean;
  codes: string[];
  blockNumber?: number | string;
  timestamp?: string;
  explorerUrl?: string;
};

export type DashboardProject = {
  code: string;
  title: string;
  generatedAt: string;
  reports: number;
  transactions: DashboardTransaction[];
  audit?: SourceAudit;
};

export type SourceAudit = {
  generatedAt: string;
  profile: string;
  sourceRevision: string | null;
  workingTreeDirty: boolean | null;
  checkedFiles: number;
  summary: {
    total: number;
    protected: number;
    missing: number;
    wrongCode: number;
    unresolved: number;
    errors: number;
    coverage: number;
  };
  families: {
    family: string;
    total: number;
    protected: number;
    missing: number;
    wrongCode: number;
    unresolved: number;
  }[];
};

export function summarizeTransactions(transactions: DashboardTransaction[]) {
  const total = transactions.length;
  const verified = transactions.filter((tx) => tx.verified).length;
  const attributed = transactions.filter((tx) => tx.status === "attributed").length;
  const confirmed = transactions.filter((tx) => tx.verified && tx.status === "attributed").length;
  return {
    total,
    verified,
    attributed,
    confirmed,
    needsReview: total - confirmed,
    coverage: total === 0 ? null : (confirmed / total) * 100,
  };
}

export const statusLabels: Record<AttributionReplayStatus, string> = {
  attributed: "Code found",
  "missing-attribution": "Code missing",
  "wrong-builder-code": "Different code",
  "invalid-attribution": "Invalid attribution",
  unavailable: "Data unavailable",
};

export function formatBlock(value: number | string | undefined) {
  if (value === undefined) return "Not recorded";
  try {
    return BigInt(value).toLocaleString("en-US");
  } catch {
    return "Not recorded";
  }
}
