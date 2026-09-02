import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createAttributionProofSet,
  type AttributionProofSet,
  type AttributionReplayTransaction,
  type AttributionReplayReport,
} from "@base-attribution-os/core";
import { CliError, type CommandResult } from "../output.js";

export const MAX_PROOF_SET_INPUT_BYTES = 2 * 1024 * 1024;

export type ProofSetFormat = "json" | "markdown";

export interface ProofSetOptions {
  title: string;
  builderCode: string;
  inputs: string[];
  format?: ProofSetFormat | string;
  output?: string;
  failOnMissing?: boolean;
}

export async function proofSetCommand(options: ProofSetOptions): Promise<CommandResult> {
  const format = normalizeProofSetFormat(options.format);
  const inputs = normalizeInputs(options.inputs);
  const reports = await Promise.all(inputs.map(readReplayReport));

  let proofSet: AttributionProofSet;
  try {
    proofSet = createAttributionProofSet(reports, {
      title: options.title,
      builderCode: options.builderCode,
    });
  } catch (error) {
    throw new CliError(
      error instanceof Error ? error.message : "Unable to create Attribution Proof Set.",
    );
  }

  const rendered = formatProofSet(proofSet, format);
  if (options.output) {
    const outputPath = path.resolve(options.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${rendered}\n`, "utf8");
  }

  return {
    ok: options.failOnMissing === false ? true : proofSet.ok,
    message: options.output ? `Attribution Proof Set written to ${options.output}.` : rendered,
    data: proofSet,
  };
}

export async function readReplayReport(filePath: string): Promise<AttributionReplayReport> {
  const absolutePath = path.resolve(filePath);
  let file;
  try {
    file = await fs.stat(absolutePath);
  } catch {
    throw new CliError(`Unable to read replay report: ${filePath}.`);
  }
  if (!file.isFile()) {
    throw new CliError(`Replay report is not a file: ${filePath}.`);
  }
  if (file.size > MAX_PROOF_SET_INPUT_BYTES) {
    throw new CliError(`Replay report exceeds the 2 MiB input limit: ${filePath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(absolutePath, "utf8")) as unknown;
  } catch (error) {
    throw new CliError(
      `Unable to parse replay report ${filePath}: ${error instanceof Error ? error.message : "invalid JSON"}.`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new CliError(`Replay report must contain a JSON object: ${filePath}.`);
  }
  return parsed as AttributionReplayReport;
}

export function formatProofSet(proofSet: AttributionProofSet, format: ProofSetFormat): string {
  if (format === "json") {
    return JSON.stringify(proofSet, null, 2);
  }

  const status = proofSet.ok ? "Verified" : "Attention required";
  const transactions = getUniqueTransactions(proofSet);
  const lines = [
    `# Attribution Proof Set: ${proofSet.title}`,
    "",
    `**${status}.** ${proofSet.summary.attributed} of ${proofSet.summary.total} unique transactions carry the expected Builder Code (${proofSet.summary.coverage}% coverage).`,
    "",
    `- Builder Code: \`${proofSet.builderCode}\``,
    `- Generated: ${proofSet.generatedAt}`,
    `- Replay reports: ${proofSet.summary.reports}`,
    `- RPC verified: ${proofSet.summary.verified}/${proofSet.summary.total}`,
    `- Missing: ${proofSet.summary.missing}`,
    `- Wrong code: ${proofSet.summary.wrongCode}`,
    `- Invalid: ${proofSet.summary.invalid}`,
    `- Unavailable: ${proofSet.summary.unavailable}`,
    "",
    "## Networks",
    "",
    "| Network | Chain ID | Reports | Transactions |",
    "| --- | ---: | ---: | ---: |",
    ...proofSet.summary.networks.map(
      (network) =>
        `| ${network.network} | ${network.chainId} | ${network.reports} | ${network.transactions} |`,
    ),
    "",
    "## Transaction evidence",
    "",
    "| Transaction | Network | Status | Builder Codes |",
    "| --- | --- | --- | --- |",
    ...transactions.map(({ network, transaction }) => {
      const hash = transaction.explorerUrl
        ? `[\`${transaction.hash}\`](${transaction.explorerUrl})`
        : `\`${transaction.hash}\``;
      return `| ${hash} | ${network} | ${transaction.status} | ${transaction.codes.map((code) => `\`${code}\``).join(", ") || "—"} |`;
    }),
  ];

  return lines.join("\n");
}

function getUniqueTransactions(proofSet: AttributionProofSet): Array<{
  chainId: number;
  network: string;
  transaction: AttributionReplayTransaction;
}> {
  const unique = new Map<
    string,
    { chainId: number; network: string; transaction: AttributionReplayTransaction }
  >();
  for (const report of proofSet.reports) {
    for (const transaction of report.transactions) {
      const key = `${report.chainId}:${transaction.hash.toLowerCase()}`;
      const current = unique.get(key);
      if (!current || (transaction.verified && !current.transaction.verified)) {
        unique.set(key, { chainId: report.chainId, network: report.network, transaction });
      }
    }
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.chainId - right.chainId ||
      left.transaction.hash.toLowerCase().localeCompare(right.transaction.hash.toLowerCase()),
  );
}

function normalizeProofSetFormat(format?: string): ProofSetFormat {
  const normalized = format ?? "json";
  if (normalized === "json" || normalized === "markdown") {
    return normalized;
  }
  throw new CliError(`Unsupported proof-set format: ${normalized}.`);
}

function normalizeInputs(inputs: string[]): string[] {
  const normalized = inputs.map((entry) => entry.trim()).filter(Boolean);
  if (normalized.length === 0) {
    throw new CliError("proof-set requires at least one replay report in --input.");
  }
  return [...new Set(normalized)];
}
