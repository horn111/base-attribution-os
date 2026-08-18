import { promises as fs } from "node:fs";
import path from "node:path";
import {
  analyzeProject,
  loadBaoConfig,
  reportToSarif,
  writeBaseline,
  type AttributionReport,
  type ScanProfile,
} from "@base-attribution-os/scanner";
import { CliError, type CommandResult } from "../output.js";

export interface DoctorOptions {
  path: string;
  builderCodes?: string[];
  config?: string;
  profile?: ScanProfile | string;
  changedSince?: string;
  baseline?: string;
  writeBaseline?: string;
  output?: string;
  format?: "human" | "json" | "sarif" | string;
}

export async function doctorCommand(options: DoctorOptions): Promise<CommandResult> {
  const root = path.resolve(options.path);
  const loaded = await loadBaoConfig(root, options.config);
  const config = loaded?.config;
  const builderCodes = options.builderCodes?.length ? options.builderCodes : config?.builderCodes;

  if (!builderCodes?.length) {
    throw new CliError(
      "No Builder Code configured. Run bao init --builder-code bc_... or pass --builder-code.",
    );
  }

  const report = await analyzeProject({
    root,
    builderCodes,
    profile: options.profile ?? config?.profile,
    include: config?.include,
    exclude: config?.exclude,
    rules: config?.rules,
    baseline: options.baseline ?? config?.baseline,
    changedSince: options.changedSince,
  });

  if (options.writeBaseline) {
    await writeBaseline(report, options.writeBaseline);
  }

  if (options.format === "sarif") {
    const sarif = reportToSarif(report);
    if (options.output) {
      await fs.writeFile(path.resolve(root, options.output), `${JSON.stringify(sarif, null, 2)}\n`);
    }
    return {
      ok: report.ok,
      message: options.output
        ? `SARIF report written to ${options.output}.`
        : "Attribution Doctor SARIF report.",
      data: sarif,
    };
  }

  return {
    ok: report.ok,
    message: formatDoctorReport(report),
    data: report,
  };
}

export function formatDoctorReport(report: AttributionReport): string {
  const lines = [
    "Base Attribution Doctor",
    "",
    `Frameworks: ${report.frameworks.length ? report.frameworks.join(", ") : "not detected"}`,
    `Coverage: ${report.summary.protected}/${report.summary.total} paths protected (${report.summary.coverage}%)`,
    "",
  ];

  if (report.transactionPaths.length === 0) {
    lines.push("No transaction paths found.");
    return lines.join("\n");
  }

  for (const entry of report.transactionPaths) {
    const icon = entry.status === "protected" ? "+" : entry.baseline ? "~" : "!";
    const rule = entry.ruleId ? ` ${entry.ruleId}` : "";
    lines.push(
      `${icon} ${entry.family.padEnd(8)} ${entry.file}:${entry.line} ${entry.marker} [${entry.status}]${rule}`,
    );
    if (entry.suggestion && entry.status !== "protected") {
      lines.push(`  ${entry.suggestion}`);
    }
  }

  lines.push(
    "",
    `Errors: ${report.summary.errors}  Warnings: ${report.summary.warnings}  Baseline: ${report.summary.baseline}`,
  );
  return lines.join("\n");
}
