import { promises as fs } from "node:fs";
import path from "node:path";
import * as core from "@actions/core";
import {
  analyzeProject,
  loadBaoConfig,
  reportToSarif,
  type AttributionReport,
} from "@base-attribution-os/scanner";
import { resolveActionProfile, resolveFailOnMissing, resolveWorkspaceOutput } from "./options.js";

async function main(): Promise<void> {
  const repoPath = path.resolve(core.getInput("path") || ".");
  const configPath = core.getInput("config") || undefined;
  const loaded = await loadBaoConfig(repoPath, configPath);
  const config = loaded?.config;
  const builderCodes = splitInput(core.getInput("builder-code"));

  if (builderCodes.length === 0 && !config?.builderCodes.length) {
    throw new Error("Set builder-code or commit a bao.config.json file.");
  }

  const paths = splitInput(core.getInput("paths"));
  const profile = resolveActionProfile(core.getInput("profile"), config?.profile);
  const changedOnly = core.getBooleanInput("changed-only");
  const changedSince = changedOnly ? resolveBaseRef() : undefined;
  const baseline = core.getInput("baseline") || config?.baseline;
  const report = await analyzeProject({
    root: repoPath,
    builderCodes: builderCodes.length ? builderCodes : (config?.builderCodes ?? []),
    include: paths.length ? paths : config?.include,
    exclude: config?.exclude,
    rules: config?.rules,
    profile,
    baseline,
    changedSince,
    workspace: config?.workspace,
  });

  await annotate(report);
  await writeSummary(report, changedSince);
  await writeSarif(repoPath, report);
  setOutputs(report);

  const failOnMissing = resolveFailOnMissing(core.getInput("fail-on-missing"));

  if (report.summary.total === 0 && failOnMissing) {
    core.setFailed(
      "Base attribution validation found no transaction paths in the configured scope.",
    );
  } else if (!report.ok && failOnMissing) {
    core.setFailed(`Base attribution validation failed with ${report.summary.errors} error(s).`);
  }
}

async function annotate(report: AttributionReport): Promise<void> {
  core.info(`Using ${report.profile} Attribution Doctor profile.`);
  core.info(`Checked ${report.checkedFiles} source file(s).`);
  core.info(`Protected ${report.summary.protected}/${report.summary.total} transaction path(s).`);

  for (const finding of report.transactionPaths.filter(
    (entry) => entry.status !== "protected" && !entry.baseline,
  )) {
    const properties = {
      file: finding.file,
      startLine: finding.line,
      startColumn: finding.column,
      title: `${finding.ruleId ?? "BAO"}: ${finding.status}`,
    };
    const message = finding.suggestion
      ? `${finding.message} ${finding.suggestion}`
      : finding.message;

    if (finding.severity === "error") core.error(message, properties);
    else if (finding.severity === "warning") core.warning(message, properties);
  }
}

async function writeSummary(report: AttributionReport, changedSince?: string): Promise<void> {
  const familyRows = Array.from(new Set(report.transactionPaths.map((entry) => entry.family)))
    .sort()
    .map((family) => {
      const paths = report.transactionPaths.filter((entry) => entry.family === family);
      return [
        family,
        String(paths.filter((entry) => entry.status === "protected").length),
        String(paths.length),
      ];
    });

  core.summary
    .addHeading("Base Attribution Doctor", 2)
    .addRaw(
      `${report.summary.protected}/${report.summary.total} transaction paths protected (${report.summary.coverage}%).`,
    )
    .addEOL()
    .addRaw(
      `Errors: ${report.summary.errors} | Warnings: ${report.summary.warnings} | Baseline: ${report.summary.baseline}`,
    )
    .addEOL();

  if (changedSince) {
    core.summary
      .addRaw(`Files impacted by workspace dependencies since \`${changedSince}\`.`)
      .addEOL();
  }

  if (familyRows.length > 0) {
    core.summary.addTable([
      [
        { data: "Family", header: true },
        { data: "Protected", header: true },
        { data: "Total", header: true },
      ],
      ...familyRows,
    ]);
  }

  await core.summary.write();
}

async function writeSarif(root: string, report: AttributionReport): Promise<void> {
  const output = core.getInput("sarif-output");
  if (!output) return;

  const target = resolveWorkspaceOutput(root, output);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(reportToSarif(report), null, 2)}\n`, "utf8");
  core.setOutput("sarif-file", target);
}

function setOutputs(report: AttributionReport): void {
  core.setOutput("checked-files", String(report.checkedFiles));
  core.setOutput("transaction-paths", String(report.summary.total));
  core.setOutput("protected-paths", String(report.summary.protected));
  core.setOutput("coverage", String(report.summary.coverage));
  core.setOutput("profile", report.profile);
  core.setOutput(
    "findings",
    JSON.stringify(report.transactionPaths.filter((entry) => entry.status !== "protected")),
  );
}

function resolveBaseRef(): string {
  const configured = core.getInput("base-ref");
  if (configured) return configured;
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  return "HEAD~1";
}

function splitInput(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

main().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
