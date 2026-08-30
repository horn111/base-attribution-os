export const SCAN_PROFILES = ["local", "ci", "strict"] as const;
export type ScanProfile = (typeof SCAN_PROFILES)[number];

export const TRANSACTION_FAMILIES = [
  "agent",
  "ethers",
  "privy",
  "rpc",
  "viem",
  "wagmi",
  "wallet",
  "x402",
] as const;
export type TransactionFamily = (typeof TRANSACTION_FAMILIES)[number];

export type AttributionStatus = "protected" | "missing" | "wrong-code" | "unresolved";
export type FindingSeverity = "error" | "warning" | "off";
export type Confidence = "high" | "medium" | "low";
export type RuleId = "BAO001" | "BAO002" | "BAO003" | "BAO004" | "BAO005" | "BAO006";

export interface AttributionEvidence {
  kind: "builder-code" | "config" | "helper" | "suffix";
  detail: string;
  file: string;
  line: number;
}

export interface TransactionPath {
  file: string;
  line: number;
  column: number;
  family: TransactionFamily;
  marker: string;
  status: AttributionStatus;
  ruleId?: RuleId;
  message: string;
  suggestion?: string;
  evidence: AttributionEvidence[];
  confidence: Confidence;
  severity: FindingSeverity;
  fingerprint: string;
  baseline: boolean;
}

export interface AttributionSummary {
  total: number;
  protected: number;
  missing: number;
  wrongCode: number;
  unresolved: number;
  errors: number;
  warnings: number;
  baseline: number;
  coverage: number;
}

export interface AttributionReport {
  ok: boolean;
  root: string;
  profile: ScanProfile;
  frameworks: string[];
  checkedFiles: number;
  transactionPaths: TransactionPath[];
  summary: AttributionSummary;
}

export interface BaoRuleConfig {
  "missing-attribution"?: FindingSeverity;
  "wrong-builder-code"?: FindingSeverity;
  "dynamic-attribution"?: FindingSeverity;
  "ambiguous-path"?: FindingSeverity;
}

export interface BaoWorkspaceConfig {
  roots?: string[];
  tsconfig?: string[];
}

export interface BaoConfig {
  $schema?: string;
  builderCodes: string[];
  profile?: ScanProfile;
  include?: string[];
  exclude?: string[];
  rules?: BaoRuleConfig;
  baseline?: string;
  workspace?: BaoWorkspaceConfig;
}

export interface AnalyzeProjectOptions {
  root: string;
  builderCodes: string[];
  profile?: ScanProfile | string;
  include?: string[];
  exclude?: string[];
  rules?: BaoRuleConfig;
  baseline?: string;
  changedSince?: string;
  files?: string[];
  workspace?: BaoWorkspaceConfig;
}

export interface BaoBaseline {
  version: 1;
  generatedAt: string;
  findings: string[];
}
