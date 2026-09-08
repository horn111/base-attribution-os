import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { analyzeProject, loadBaoConfig } from "../packages/scanner/src/index.js";
import { validateBuilderCodes } from "../packages/core/src/index.js";

async function main() {
  const { values } = parseArgs({
    options: {
      path: { type: "string" },
      "builder-code": { type: "string" },
      output: { type: "string" },
    },
  });
  if (!values.path || !values["builder-code"] || !values.output) {
    throw new Error(
      "Usage: tsx scripts/export-dashboard-audit.ts --path <project> --builder-code <code> --output <public-json>",
    );
  }
  const builderCode = values["builder-code"];
  if (validateBuilderCodes([builderCode]).length) throw new Error("Invalid Builder Code.");
  const root = path.resolve(values.path);
  const config = (await loadBaoConfig(root))?.config;
  const report = await analyzeProject({
    root,
    builderCodes: [builderCode],
    profile: "strict",
    include: config?.include,
    exclude: config?.exclude,
    workspace: config?.workspace,
  });
  let sourceRevision: string | null = null;
  let workingTreeDirty: boolean | null = null;
  try {
    sourceRevision = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    workingTreeDirty =
      execFileSync("git", ["-C", root, "status", "--porcelain"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim().length > 0;
  } catch {
    /* Non-Git inputs still produce a dated audit, without a revision claim. */
  }
  // Deliberate allowlist: never publish file paths, source text, or raw findings.
  const snapshot = {
    schemaVersion: 1,
    builderCode,
    generatedAt: new Date().toISOString(),
    profile: report.profile,
    sourceRevision,
    workingTreeDirty,
    checkedFiles: report.checkedFiles,
    summary: report.summary,
    families: Array.from(new Set(report.transactionPaths.map((entry) => entry.family)))
      .sort()
      .map((family) => {
        const entries = report.transactionPaths.filter((entry) => entry.family === family);
        return {
          family,
          total: entries.length,
          protected: entries.filter((entry) => entry.status === "protected").length,
          missing: entries.filter((entry) => entry.status === "missing").length,
          wrongCode: entries.filter((entry) => entry.status === "wrong-code").length,
          unresolved: entries.filter((entry) => entry.status === "unresolved").length,
        };
      }),
  };
  const output = path.resolve(values.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `${report.summary.protected}/${report.summary.total} supported paths protected; ${report.summary.errors} errors. Public audit snapshot written.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Audit export failed.");
  process.exitCode = 1;
});
