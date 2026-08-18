import { promises as fs } from "node:fs";
import path from "node:path";
import type { AttributionReport, BaoBaseline } from "./types.js";

export async function readBaseline(root: string, file?: string): Promise<Set<string>> {
  if (!file) {
    return new Set();
  }

  const source = await fs.readFile(path.resolve(root, file), "utf8").catch(() => undefined);

  if (!source) {
    return new Set();
  }

  const baseline = JSON.parse(source) as BaoBaseline;
  return new Set(baseline.findings ?? []);
}

export async function writeBaseline(report: AttributionReport, file: string): Promise<string> {
  const target = path.resolve(report.root, file);
  const baseline: BaoBaseline = {
    version: 1,
    generatedAt: new Date().toISOString(),
    findings: report.transactionPaths
      .filter((entry) => entry.status !== "protected")
      .map((entry) => entry.fingerprint)
      .sort(),
  };

  await fs.writeFile(target, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  return target;
}
