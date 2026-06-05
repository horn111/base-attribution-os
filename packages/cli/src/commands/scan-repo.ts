import { promises as fs } from "node:fs";
import path from "node:path";
import { KNOWN_TRANSACTION_MARKERS, createDataSuffix } from "@base-attribution-os/core";
import type { CommandResult } from "../output.js";

export interface ScanRepoOptions {
  path: string;
  builderCode: string;
  failOnMissing?: boolean;
  paths?: string[];
}

export interface ScanFinding {
  file: string;
  reason: "missing-attribution" | "wrong-builder-code";
  marker: string;
}

export interface ScanRepoResult {
  ok: boolean;
  root: string;
  checkedFiles: number;
  candidateFiles: number;
  findings: ScanFinding[];
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);
const BUILDER_CODE_REGEX = /\bbc_[A-Za-z0-9._:-]+\b/g;

export async function scanRepo(options: ScanRepoOptions): Promise<ScanRepoResult> {
  const root = path.resolve(options.path);
  const roots =
    options.paths && options.paths.length > 0
      ? options.paths.map((entry) => path.resolve(root, entry))
      : [root];
  const expectedSuffix = createDataSuffix({ codes: [options.builderCode] }).toLowerCase();
  const files: string[] = [];

  for (const searchRoot of roots) {
    files.push(...(await collectSourceFiles(searchRoot)));
  }

  const findings: ScanFinding[] = [];
  let candidateFiles = 0;

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    const marker = KNOWN_TRANSACTION_MARKERS.find((item) => source.includes(item));

    if (!marker) {
      continue;
    }

    candidateFiles += 1;

    const hasExpectedCode = source.includes(options.builderCode);
    const hasExpectedSuffix = source.toLowerCase().includes(expectedSuffix.slice(2));
    const discoveredCodes = Array.from(source.matchAll(BUILDER_CODE_REGEX)).map(
      (match) => match[0],
    );
    const hasWrongCode = discoveredCodes.some((code) => code !== options.builderCode);
    const hasAttributionHelper =
      source.includes("createDataSuffix") ||
      source.includes("builderCodeDataSuffix") ||
      source.includes("useAttributionSuffix") ||
      source.includes("withAttributionSuffix") ||
      source.includes("dataSuffix");

    if (hasWrongCode && !hasExpectedCode && !hasExpectedSuffix) {
      findings.push({
        file: path.relative(root, file),
        reason: "wrong-builder-code",
        marker,
      });
      continue;
    }

    if (!hasExpectedCode && !hasExpectedSuffix && !hasAttributionHelper) {
      findings.push({
        file: path.relative(root, file),
        reason: "missing-attribution",
        marker,
      });
    }
  }

  return {
    ok: findings.length === 0 || options.failOnMissing === false,
    root,
    checkedFiles: files.length,
    candidateFiles,
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

async function collectSourceFiles(root: string): Promise<string[]> {
  const stat = await fs.stat(root).catch(() => undefined);

  if (!stat) {
    return [];
  }

  if (stat.isFile()) {
    return SOURCE_EXTENSIONS.has(path.extname(root)) ? [root] : [];
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}
