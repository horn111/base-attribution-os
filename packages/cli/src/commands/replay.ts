import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createAttributionReplayReport,
  hexByteLength,
  isHex,
  type AttributionReplayCandidate,
  type AttributionReplayReport,
  type Hex,
} from "@base-attribution-os/core";
import { CliError, type CommandResult } from "../output.js";

export type ReplayFormat = "human" | "json" | "markdown";

export interface ReplayOptions {
  builderCode: string;
  input?: string;
  hashes?: string[];
  rpcUrl?: string;
  chainId?: number;
  explorerBaseUrl?: string;
  generatedAt?: string;
  format?: ReplayFormat | string;
  output?: string;
  failOnMissing?: boolean;
  fetcher?: typeof fetch;
}

type ReplayInputRow = Record<string, unknown>;

export async function replayCommand(options: ReplayOptions): Promise<CommandResult> {
  const format = normalizeReplayFormat(options.format);
  const fromFile = options.input ? await readReplayInput(options.input) : [];
  const fromArguments = (options.hashes ?? []).map((hash) => ({ hash: normalizeHash(hash) }));
  const candidates = mergeCandidates([...fromFile, ...fromArguments]);

  if (candidates.length === 0) {
    throw new CliError("Replay requires --input or at least one transaction in --hashes.");
  }

  const resolved = await resolveCalldata(candidates, options.rpcUrl, options.fetcher ?? fetch);
  const report = createAttributionReplayReport(resolved, {
    builderCode: options.builderCode,
    chainId: options.chainId,
    explorerBaseUrl: options.explorerBaseUrl,
    generatedAt: options.generatedAt,
  });
  const rendered = formatReplayReport(report, format);

  if (options.output) {
    const outputPath = path.resolve(options.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${rendered}\n`);
  }

  return {
    ok: options.failOnMissing === false ? true : report.ok,
    message: options.output ? `Attribution replay written to ${options.output}.` : rendered,
    data: report,
  };
}

export async function readReplayInput(filePath: string): Promise<AttributionReplayCandidate[]> {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, "utf8");
  const extension = path.extname(absolutePath).toLowerCase();
  const rows =
    extension === ".csv" ? parseCsv(content) : normalizeJsonRows(JSON.parse(content) as unknown);

  return rows.map((row, index) => normalizeInputRow(row, index, path.basename(filePath)));
}

export function formatReplayReport(report: AttributionReplayReport, format: ReplayFormat): string {
  if (format === "json") {
    return JSON.stringify(report, null, 2);
  }

  if (format === "markdown") {
    return formatMarkdownReport(report);
  }

  return formatHumanReport(report);
}

function normalizeReplayFormat(format?: string): ReplayFormat {
  const normalized = format ?? "human";

  if (normalized === "human" || normalized === "json" || normalized === "markdown") {
    return normalized;
  }

  throw new CliError(`Unsupported replay format: ${normalized}`);
}

function normalizeJsonRows(value: unknown): ReplayInputRow[] {
  if (Array.isArray(value)) {
    return value.map(assertRow);
  }

  if (isRow(value)) {
    const nested = value.transactions ?? value.rows ?? value.data;
    if (Array.isArray(nested)) {
      return nested.map(assertRow);
    }
  }

  throw new CliError("Replay JSON must be an array or contain transactions, rows, or data.");
}

function normalizeInputRow(
  row: ReplayInputRow,
  index: number,
  defaultSource: string,
): AttributionReplayCandidate {
  const hashValue = firstValue(row, ["hash", "tx_hash", "transaction_hash"]);
  const calldataValue = firstValue(row, ["calldata", "input", "data", "tx_data"]);
  const timestampValue = firstValue(row, ["timestamp", "block_time", "time"]);
  const blockNumberValue = firstValue(row, ["blockNumber", "block_number"]);
  const sourceValue = firstValue(row, ["source"]);

  if (typeof hashValue !== "string") {
    throw new CliError(`Replay row ${index + 1} is missing hash or tx_hash.`);
  }

  const candidate: AttributionReplayCandidate = {
    hash: normalizeHash(hashValue),
    source: typeof sourceValue === "string" ? sourceValue : defaultSource,
  };

  if (typeof calldataValue === "string" && calldataValue.length > 0) {
    candidate.calldata = calldataValue as Hex;
  }

  if (typeof timestampValue === "string") {
    candidate.timestamp = timestampValue;
  }

  if (typeof blockNumberValue === "string" || typeof blockNumberValue === "number") {
    candidate.blockNumber = blockNumberValue;
  }

  return candidate;
}

function firstValue(row: ReplayInputRow, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return undefined;
}

function normalizeHash(value: string): Hex {
  const normalized = value.trim();
  if (!isHex(normalized) || hexByteLength(normalized) !== 32) {
    throw new CliError(`Invalid transaction hash: ${value}`);
  }
  return normalized;
}

function mergeCandidates(candidates: AttributionReplayCandidate[]): AttributionReplayCandidate[] {
  const merged = new Map<Hex, AttributionReplayCandidate>();

  for (const candidate of candidates) {
    const current = merged.get(candidate.hash);
    merged.set(candidate.hash, {
      ...current,
      ...candidate,
      calldata: candidate.calldata ?? current?.calldata,
    });
  }

  return Array.from(merged.values());
}

async function resolveCalldata(
  candidates: AttributionReplayCandidate[],
  rpcUrl: string | undefined,
  fetcher: typeof fetch,
): Promise<AttributionReplayCandidate[]> {
  if (!rpcUrl) {
    return candidates.map((candidate) =>
      candidate.calldata === undefined
        ? { ...candidate, error: "calldata missing; pass --rpc-url to fetch it" }
        : { ...candidate, verified: false },
    );
  }

  const fetched = await fetchTransactions(
    candidates.map((candidate) => candidate.hash),
    rpcUrl,
    fetcher,
  );

  return candidates.map((candidate) => {
    const remote = fetched.get(candidate.hash);
    if (!remote || remote.error || remote.calldata === undefined) {
      return {
        ...candidate,
        ...remote,
        hash: candidate.hash,
        source: candidate.source,
        verified: false,
      };
    }
    if (
      candidate.calldata !== undefined &&
      candidate.calldata.toLowerCase() !== remote.calldata.toLowerCase()
    ) {
      return {
        ...candidate,
        calldata: undefined,
        verified: false,
        error: "supplied calldata does not match the RPC transaction",
      };
    }

    return {
      ...candidate,
      ...remote,
      hash: candidate.hash,
      source: candidate.source,
      verified: true,
    };
  });
}

async function fetchTransactions(
  hashes: Hex[],
  rpcUrl: string,
  fetcher: typeof fetch,
): Promise<Map<Hex, Partial<AttributionReplayCandidate>>> {
  let response: Response;

  try {
    response = await fetcher(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        hashes.map((hash, index) => ({
          jsonrpc: "2.0",
          id: index + 1,
          method: "eth_getTransactionByHash",
          params: [hash],
        })),
      ),
    });
  } catch (error) {
    return errorMap(hashes, error instanceof Error ? error.message : "RPC request failed");
  }

  if (!response.ok) {
    return errorMap(hashes, `RPC request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as Array<{
    id?: number;
    result?: { hash?: Hex; input?: Hex; data?: Hex; blockNumber?: Hex } | null;
    error?: { message?: string };
  }>;

  if (!Array.isArray(payload)) {
    return errorMap(hashes, "RPC endpoint did not return a batch response");
  }

  const fetched = new Map<Hex, Partial<AttributionReplayCandidate>>();

  for (const entry of payload) {
    if (!entry.id || entry.id < 1 || entry.id > hashes.length) {
      continue;
    }

    const hash = hashes[entry.id - 1];
    if (entry.error) {
      fetched.set(hash, { error: `RPC error: ${entry.error.message ?? "unknown error"}` });
    } else if (!entry.result) {
      fetched.set(hash, { error: "Transaction not found" });
    } else if (!entry.result.hash || entry.result.hash.toLowerCase() !== hash.toLowerCase()) {
      fetched.set(hash, { error: "RPC response transaction hash mismatch" });
    } else {
      fetched.set(hash, {
        calldata: entry.result.input ?? entry.result.data ?? "0x",
        blockNumber: entry.result.blockNumber,
      });
    }
  }

  for (const hash of hashes) {
    if (!fetched.has(hash)) {
      fetched.set(hash, { error: "Transaction missing from RPC batch response" });
    }
  }

  return fetched;
}

function errorMap(hashes: Hex[], error: string): Map<Hex, Partial<AttributionReplayCandidate>> {
  return new Map(hashes.map((hash) => [hash, { error }]));
}

function formatHumanReport(report: AttributionReplayReport): string {
  const lines = [
    "Base Attribution Replay",
    "",
    `Builder Code: ${report.builderCode}`,
    `Network: ${report.network} (${report.chainId})`,
    `Coverage: ${report.attributed}/${report.total} transactions attributed (${report.coverage}%)`,
    `Missing: ${report.missing}  Wrong code: ${report.wrongCode}  Invalid: ${report.invalid}  Unavailable: ${report.unavailable}`,
    `Verified by RPC: ${report.verified}/${report.total}`,
    "",
  ];

  for (const transaction of report.transactions) {
    const icon = transaction.status === "attributed" ? "+" : "!";
    const displayCodes = transaction.status === "invalid-attribution" ? [] : transaction.codes;
    const codes = displayCodes.length ? ` [${displayCodes.join(", ")}]` : "";
    const verification = transaction.verified ? "" : " [unverified input]";
    lines.push(`${icon} ${transaction.hash} ${transaction.status}${codes}${verification}`);
  }

  return lines.join("\n");
}

function formatMarkdownReport(report: AttributionReplayReport): string {
  const status = report.ok ? "Verified" : "Attention required";
  const title = report.ok ? "Attribution Proof" : "Attribution Replay";
  const lines = [
    `# ${title}: ${report.builderCode}`,
    "",
    `**${status}.** ${report.attributed} of ${report.total} transactions carry the expected Builder Code (${report.coverage}% coverage).`,
    "",
    `- Network: ${report.network} (${report.chainId})`,
    `- Generated: ${report.generatedAt}`,
    `- Missing: ${report.missing}`,
    `- Wrong code: ${report.wrongCode}`,
    `- Invalid: ${report.invalid}`,
    `- Unavailable: ${report.unavailable}`,
    `- RPC verified: ${report.verified}/${report.total}`,
    "",
    "| Transaction | Status | Builder Codes |",
    "| --- | --- | --- |",
  ];

  for (const transaction of report.transactions) {
    const hash = transaction.explorerUrl
      ? `[${shortHash(transaction.hash)}](${transaction.explorerUrl})`
      : shortHash(transaction.hash);
    const transactionStatus = transaction.verified
      ? transaction.status
      : `${transaction.status} (unverified input)`;
    const displayCodes = transaction.status === "invalid-attribution" ? [] : transaction.codes;
    lines.push(`| ${hash} | ${transactionStatus} | ${displayCodes.join(", ") || "—"} |`);
  }

  lines.push("", "_Generated by Base Attribution OS._");
  return lines.join("\n");
}

function shortHash(hash: Hex): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

function parseCsv(content: string): ReplayInputRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];

    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      record.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }
      record.push(field);
      if (record.some((value) => value.length > 0)) {
        records.push(record);
      }
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  record.push(field);
  if (record.some((value) => value.length > 0)) {
    records.push(record);
  }

  const [headers, ...rows] = records;
  if (!headers) {
    return [];
  }

  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index] ?? ""])),
  );
}

function isRow(value: unknown): value is ReplayInputRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRow(value: unknown): ReplayInputRow {
  if (!isRow(value)) {
    throw new CliError("Every replay input entry must be an object.");
  }
  return value;
}
