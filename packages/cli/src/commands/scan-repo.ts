import path from "node:path";
import {
  analyzeProject,
  loadBaoConfig,
  normalizeProfile,
  type ScanProfile,
  type TransactionFamily,
} from "@base-attribution-os/scanner";
import type { CommandResult } from "../output.js";

export interface ScanRepoOptions {
  path: string;
  builderCode?: string;
  builderCodes?: string[];
  config?: string;
  changedSince?: string;
  failOnMissing?: boolean;
  paths?: string[];
  profile?: ScanProfile | string;
}

export interface ScanFinding {
  file: string;
  reason: "missing-attribution" | "wrong-builder-code";
  marker: string;
  family: TransactionFamily;
  line: number;
}

export interface ScanRepoResult {
  ok: boolean;
  root: string;
  profile: ScanProfile;
  checkedFiles: number;
  candidateFiles: number;
  findings: ScanFinding[];
}

export async function scanRepo(options: ScanRepoOptions): Promise<ScanRepoResult> {
  const root = path.resolve(options.path);
  const loaded = await loadBaoConfig(root, options.config);
  const config = loaded?.config;
  const builderCodes = options.builderCodes?.length
    ? options.builderCodes
    : options.builderCode
      ? [options.builderCode]
      : config?.builderCodes;
  if (!builderCodes?.length) {
    throw new Error("No Builder Code configured. Pass --builder-code or commit bao.config.json.");
  }
  const profile = normalizeProfile(options.profile ?? config?.profile);
  const report = await analyzeProject({
    root,
    builderCodes,
    profile,
    include: options.paths?.length ? options.paths : config?.include,
    exclude: config?.exclude,
    rules: config?.rules,
    baseline: config?.baseline,
    changedSince: options.changedSince,
    workspace: config?.workspace,
  });
  const failingPaths = report.transactionPaths.filter(
    (entry) =>
      entry.status === "missing" ||
      entry.status === "wrong-code" ||
      (entry.status === "unresolved" && profile === "strict"),
  );
  const findings: ScanFinding[] = failingPaths.map((entry) => ({
    file: entry.file,
    reason: entry.status === "wrong-code" ? "wrong-builder-code" : "missing-attribution",
    marker: entry.marker,
    family: entry.family,
    line: entry.line,
  }));
  const failOnMissing = options.failOnMissing ?? profile !== "local";

  return {
    ok: findings.length === 0 || !failOnMissing,
    root,
    profile,
    checkedFiles: report.checkedFiles,
    candidateFiles: new Set(report.transactionPaths.map((entry) => entry.file)).size,
    findings,
  };
}

export async function scanRepoCommand(options: ScanRepoOptions): Promise<CommandResult> {
  const result = await scanRepo(options);

  return {
    ok: result.ok,
    message: result.ok
      ? `Attribution scan OK: ${result.candidateFiles} candidate file(s).`
      : `Attribution scan failed: ${result.findings.length} finding(s).`,
    data: result,
  };
}

export { normalizeProfile as normalizeScanProfile } from "@base-attribution-os/scanner";
export type { ScanProfile } from "@base-attribution-os/scanner";
