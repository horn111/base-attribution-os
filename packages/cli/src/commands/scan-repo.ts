import { promises as fs } from "node:fs";
import path from "node:path";
import { createDataSuffix } from "@base-attribution-os/core";
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
  family: TransactionFamily;
  line: number;
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
const BUILDER_CODE_ASSIGNMENT_REGEX =
  /\b(?:builderCode|builderCodes|builder-code|BUILDER_CODE|BUILDER_CODES)\b[^"'`\n]{0,120}["'`]([^"'`]+)["'`]/gi;
const ATTRIBUTION_HELPER_REGEX =
  /\b(?:appendDataSuffix|attributeSendCalls|builderCodeDataSuffix|createDataSuffix|dataSuffix|useAttributionSuffix|withAttributionSuffix|withViemDataSuffix)\b/;

type TransactionFamily = "agent" | "viem" | "wagmi" | "wallet";

interface TransactionPattern {
  marker: string;
  family: TransactionFamily;
  regex: RegExp;
}

const TRANSACTION_PATTERNS: TransactionPattern[] = [
  {
    marker: "agentTransactionTool",
    family: "agent",
    regex:
      /\b(?:agentTransactionTool|executeTransaction|onchainAction|sendTransactionTool|transactionTool)\b/,
  },
  {
    marker: "useSendTransaction",
    family: "wagmi",
    regex: /\buseSendTransaction\s*\(/,
  },
  {
    marker: "useWriteContract",
    family: "wagmi",
    regex: /\buseWriteContract\s*\(/,
  },
  {
    marker: "sendTransaction",
    family: "viem",
    regex: /\bsendTransaction\s*\(/,
  },
  {
    marker: "writeContract",
    family: "viem",
    regex: /\bwriteContract\s*\(/,
  },
  {
    marker: "prepareTransactionRequest",
    family: "viem",
    regex: /\bprepareTransactionRequest\s*\(/,
  },
  {
    marker: "sendCalls",
    family: "wallet",
    regex: /\bsendCalls\s*\(|["'`]wallet_sendCalls["'`]/,
  },
];

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
    const match = findTransactionMatch(source);

    if (!match) {
      continue;
    }

    candidateFiles += 1;

    const hasExpectedCode = source.includes(options.builderCode);
    const hasExpectedSuffix = source.toLowerCase().includes(expectedSuffix.slice(2));
    const discoveredCodes = discoverBuilderCodes(source);
    const hasWrongCode = discoveredCodes.some((code) => code !== options.builderCode);
    const hasAttributionHelper = ATTRIBUTION_HELPER_REGEX.test(source);

    if (hasWrongCode && !hasExpectedCode && !hasExpectedSuffix) {
      findings.push({
        file: path.relative(root, file),
        reason: "wrong-builder-code",
        marker: match.pattern.marker,
        family: match.pattern.family,
        line: match.line,
      });
      continue;
    }

    if (!hasExpectedCode && !hasExpectedSuffix && !hasAttributionHelper) {
      findings.push({
        file: path.relative(root, file),
        reason: "missing-attribution",
        marker: match.pattern.marker,
        family: match.pattern.family,
        line: match.line,
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

function findTransactionMatch(source: string):
  | {
      pattern: TransactionPattern;
      line: number;
    }
  | undefined {
  for (const pattern of TRANSACTION_PATTERNS) {
    const match = source.match(pattern.regex);

    if (!match || match.index === undefined) {
      continue;
    }

    return {
      pattern,
      line: lineNumberAtIndex(source, match.index),
    };
  }

  return undefined;
}

function discoverBuilderCodes(source: string): string[] {
  const discovered = new Set<string>();

  for (const match of source.matchAll(BUILDER_CODE_REGEX)) {
    discovered.add(match[0]);
  }

  for (const match of source.matchAll(BUILDER_CODE_ASSIGNMENT_REGEX)) {
    for (const code of match[1].split(",")) {
      const normalized = code.trim();

      if (normalized.length > 0) {
        discovered.add(normalized);
      }
    }
  }

  return Array.from(discovered);
}

function lineNumberAtIndex(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
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
