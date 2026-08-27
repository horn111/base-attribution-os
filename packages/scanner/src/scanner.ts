import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { createDataSuffix, validateBuilderCodes } from "@base-attribution-os/core";
import ts from "typescript";
import { readBaseline } from "./baseline.js";
import { SCAN_PROFILES } from "./types.js";
import type {
  AnalyzeProjectOptions,
  AttributionEvidence,
  AttributionReport,
  AttributionSummary,
  BaoRuleConfig,
  FindingSeverity,
  RuleId,
  ScanProfile,
  TransactionFamily,
  TransactionPath,
} from "./types.js";

const execFile = promisify(execFileCallback);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);
const BUILDER_CODE_REGEX = /\bbc_[a-z0-9_]{1,29}\b/g;
const ATTRIBUTION_HELPER_REGEX =
  /\b(?:appendDataSuffix|attributeSendCalls|attributeUserOperation|Attribution\.toDataSuffix|BuilderCodeClientExtension|builderCodeDataSuffix|createAttributionProvider|createAttributionSigner|createDataSuffix|dataSuffix|declareBuilderCodeExtension|ethersBuilderCodeDataSuffix|sendAttributedCalls|useAttributionSuffix|validateUserOperationAttribution|withAttributionSuffix|withEthersAttribution|withUserOperationAttribution|withViemDataSuffix)\b/;
const AGENT_MARKER_REGEX =
  /\b(?:agentTransactionTool|executeTransaction|onchainAction|sendTransactionTool|transactionTool)\b/;

interface SourceRecord {
  absolutePath: string;
  relativePath: string;
  source: string;
  frameworks: string[];
}

interface ProjectEvidence {
  family: TransactionFamily;
  evidence: AttributionEvidence;
  expected: boolean;
  dynamic: boolean;
}

interface SourceAnalysisOptions {
  baseline?: Set<string>;
  builderCodes: string[];
  globalEvidence?: ProjectEvidence[];
  profile?: ScanProfile | string;
  relativePath?: string;
  rules?: BaoRuleConfig;
}

interface Candidate {
  family: TransactionFamily;
  marker: string;
  node: ts.Node;
  confidence: TransactionPath["confidence"];
}

export async function analyzeProject(options: AnalyzeProjectOptions): Promise<AttributionReport> {
  assertBuilderCodes(options.builderCodes);
  const root = path.resolve(options.root);
  const profile = normalizeProfile(options.profile);
  const baseline = await readBaseline(root, options.baseline);
  const files = await resolveFiles(root, options);
  const records = await Promise.all(
    files.map(async (absolutePath): Promise<SourceRecord> => {
      const source = await fs.readFile(absolutePath, "utf8");
      return {
        absolutePath,
        relativePath: normalizePath(path.relative(root, absolutePath)),
        source,
        frameworks: detectFrameworks(source),
      };
    }),
  );
  const globalEvidence = collectProjectEvidence(records, options.builderCodes);
  const transactionPaths = records.flatMap((record) =>
    analyzeSource(record.source, {
      baseline,
      builderCodes: options.builderCodes,
      globalEvidence,
      profile,
      relativePath: record.relativePath,
      rules: options.rules,
    }),
  );
  const summary = summarize(transactionPaths);

  return {
    ok: summary.errors === 0,
    root,
    profile,
    frameworks: Array.from(new Set(records.flatMap((record) => record.frameworks))).sort(),
    checkedFiles: records.length,
    transactionPaths,
    summary,
  };
}

export function analyzeSource(source: string, options: SourceAnalysisOptions): TransactionPath[] {
  assertBuilderCodes(options.builderCodes);
  const relativePath = options.relativePath ?? "source.ts";
  const profile = normalizeProfile(options.profile);
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(relativePath),
  );
  const frameworks = detectFrameworks(source);
  const candidates = collectCandidates(sourceFile, source, frameworks);
  const fingerprintOccurrences = new Map<string, number>();

  return candidates.map((candidate) => {
    const fingerprintKey = [
      candidate.family,
      candidate.marker,
      normalizeFingerprintSource(candidate.node.getText(sourceFile)),
    ].join(":");
    const fingerprintOccurrence = (fingerprintOccurrences.get(fingerprintKey) ?? 0) + 1;
    fingerprintOccurrences.set(fingerprintKey, fingerprintOccurrence);

    return evaluateCandidate(sourceFile, source, candidate, fingerprintOccurrence, {
      ...options,
      profile,
      relativePath,
    });
  });
}

export function detectFrameworks(source: string): string[] {
  const frameworks = new Set<string>();

  if (/from\s+["']@privy-io\/react-auth["']|@privy-io\/react-auth/.test(source)) {
    frameworks.add("privy");
  }
  if (/from\s+["']wagmi["']|from\s+["']wagmi\//.test(source)) {
    frameworks.add("wagmi");
  }
  if (/from\s+["']viem["']|from\s+["']viem\//.test(source)) {
    frameworks.add("viem");
  }
  if (/from\s+["']ethers["']|from\s+["']ethers\//.test(source)) {
    frameworks.add("ethers");
  }
  if (/@x402\//.test(source)) {
    frameworks.add("x402");
  }
  if (
    /\b(?:createAttributionProvider|eth_sendUserOperation|sendAttributedCalls|sendCalls|sendUserOperation|wallet_getCapabilities|wallet_sendCalls|useSendCalls|withUserOperationAttribution)\b/.test(
      source,
    )
  ) {
    frameworks.add("smart-wallet");
  }
  if (/\b(?:window\.ethereum|eth_sendTransaction)\b/.test(source)) {
    frameworks.add("raw-rpc");
  }
  if (AGENT_MARKER_REGEX.test(source)) {
    frameworks.add("agent");
  }

  return Array.from(frameworks).sort();
}

export function normalizeProfile(profile: ScanProfile | string | undefined): ScanProfile {
  if (!profile) {
    return "ci";
  }

  if ((SCAN_PROFILES as readonly string[]).includes(profile)) {
    return profile as ScanProfile;
  }

  throw new Error(`Unknown scan profile: ${profile}`);
}

function collectCandidates(
  sourceFile: ts.SourceFile,
  source: string,
  frameworks: string[],
): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  function add(candidate: Candidate): void {
    const key = `${candidate.node.pos}:${candidate.marker}:${candidate.family}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(candidate);
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isNewExpression(node) && expressionName(node.expression) === "x402Client") {
      add({ family: "x402", marker: "x402Client", node, confidence: "high" });
    }

    if (ts.isCallExpression(node)) {
      const marker = expressionName(node.expression);
      const requestMethod = marker === "request" ? readRequestMethod(node) : undefined;
      const resolvedMarker = requestMethod ?? marker;
      const family = classifyCall(marker, requestMethod, source, frameworks);

      if (family && resolvedMarker) {
        add({
          family,
          marker: resolvedMarker,
          node,
          confidence: confidenceFor(family, frameworks),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return candidates.sort(
    (left, right) => left.node.getStart(sourceFile) - right.node.getStart(sourceFile),
  );
}

function classifyCall(
  marker: string | undefined,
  requestMethod: string | undefined,
  source: string,
  frameworks: string[],
): TransactionFamily | undefined {
  if (requestMethod === "wallet_sendCalls" || requestMethod === "eth_sendUserOperation") {
    return "wallet";
  }
  if (requestMethod === "eth_sendTransaction") {
    return "rpc";
  }
  if (marker === "paymentMiddleware" || marker === "wrapFetchWithPayment") {
    return "x402";
  }
  if (
    marker === "sendCalls" ||
    marker === "useSendCalls" ||
    marker === "sendAttributedCalls" ||
    marker === "sendUserOperation"
  ) {
    return "wallet";
  }
  if (
    !marker ||
    ![
      "sendTransaction",
      "writeContract",
      "prepareTransactionRequest",
      "sendRawTransaction",
    ].includes(marker)
  ) {
    return undefined;
  }
  if (AGENT_MARKER_REGEX.test(source)) {
    return "agent";
  }
  if (frameworks.includes("privy")) {
    return "privy";
  }
  if (frameworks.includes("ethers")) {
    return "ethers";
  }
  if (frameworks.includes("wagmi")) {
    return "wagmi";
  }
  if (frameworks.includes("raw-rpc")) {
    return "rpc";
  }
  return "viem";
}

function evaluateCandidate(
  sourceFile: ts.SourceFile,
  source: string,
  candidate: Candidate,
  fingerprintOccurrence: number,
  options: Required<Pick<SourceAnalysisOptions, "builderCodes" | "relativePath">> &
    SourceAnalysisOptions & { profile: ScanProfile },
): TransactionPath {
  const start = sourceFile.getLineAndCharacterOfPosition(candidate.node.getStart(sourceFile));
  const directSource = candidate.node.getText(sourceFile);
  const expectedSuffixes = options.builderCodes.map((code) =>
    createDataSuffix({ codes: [code] })
      .slice(2)
      .toLowerCase(),
  );
  const directCodes = discoverBuilderCodes(directSource);
  const fileCodes = discoverBuilderCodes(source);
  const hasExpectedDirectCode = options.builderCodes.some((code) =>
    containsBuilderCode(directSource, code),
  );
  const hasExpectedFileCode = options.builderCodes.some((code) =>
    containsBuilderCode(source, code),
  );
  const hasExpectedSuffix = expectedSuffixes.some((suffix) =>
    source.toLowerCase().includes(suffix),
  );
  const wrongDirectCode = directCodes.find((code) => !options.builderCodes.includes(code));
  const wrongFileCode = fileCodes.find((code) => !options.builderCodes.includes(code));
  const localAttribution = findLocalAttribution(candidate, directSource, source);
  const projectEvidence =
    options.globalEvidence?.find((entry) => entry.family === candidate.family && entry.expected) ??
    options.globalEvidence?.find((entry) => entry.family === candidate.family);
  const evidence: AttributionEvidence[] = [];

  if (localAttribution) {
    evidence.push({
      kind: localAttribution.kind,
      detail: localAttribution.detail,
      file: options.relativePath,
      line: start.line + 1,
    });
  } else if (projectEvidence) {
    evidence.push(projectEvidence.evidence);
  }

  let status: TransactionPath["status"];
  let ruleId: RuleId | undefined;
  let message: string;
  let suggestion: string | undefined;
  let confidence = candidate.confidence;

  const wrongCode = wrongDirectCode ?? (localAttribution ? wrongFileCode : undefined);
  if (wrongCode && !hasExpectedDirectCode && !hasExpectedSuffix) {
    status = "wrong-code";
    ruleId = "BAO002";
    message = `${candidate.marker} uses ${wrongCode}, which is not configured for this project.`;
    suggestion = "Replace it with a Builder Code from bao.config.json.";
  } else if (
    localAttribution &&
    (hasExpectedDirectCode || hasExpectedFileCode || hasExpectedSuffix)
  ) {
    status = "protected";
    message = `${candidate.marker} is protected by Builder Code attribution.`;
    confidence = hasExpectedDirectCode ? "high" : "medium";
  } else if (projectEvidence?.expected && candidate.family === "privy") {
    status = "protected";
    message = `${candidate.marker} is covered by the project-level Privy dataSuffix plugin.`;
    confidence = "medium";
  } else if (projectEvidence?.expected) {
    status = "unresolved";
    ruleId = "BAO004";
    message = `${candidate.marker} has project-level Builder Code configuration, but this call site is not statically linked to it.`;
    suggestion =
      "Pass dataSuffix at this call site or expose an import path the scanner can verify.";
    confidence = "medium";
  } else if (localAttribution || projectEvidence?.dynamic) {
    status = "unresolved";
    ruleId = "BAO003";
    message = `${candidate.marker} uses dynamic attribution that cannot be matched to a configured Builder Code.`;
    suggestion = "Expose the configured Builder Code to CI or use strict-verifiable configuration.";
    confidence = "medium";
  } else {
    status = "missing";
    ruleId = missingRuleFor(candidate.family);
    message = missingMessage(candidate);
    suggestion = suggestionFor(candidate.family);
  }

  const severity = severityFor(status, ruleId, options.profile, options.rules);
  const fingerprint = createFingerprint(
    ruleId ?? "protected",
    options.relativePath,
    candidate.family,
    candidate.marker,
    normalizeFingerprintSource(directSource),
    fingerprintOccurrence,
  );
  const isBaseline = options.baseline?.has(fingerprint) ?? false;

  return {
    file: options.relativePath,
    line: start.line + 1,
    column: start.character + 1,
    family: candidate.family,
    marker: candidate.marker,
    status,
    ruleId,
    message,
    suggestion,
    evidence,
    confidence,
    severity,
    fingerprint,
    baseline: isBaseline,
  };
}

function findLocalAttribution(
  candidate: Candidate,
  directSource: string,
  source: string,
): { detail: string; kind: AttributionEvidence["kind"] } | undefined {
  if (candidate.family === "x402") {
    const hasClientExtension =
      (candidate.marker === "x402Client" || candidate.marker === "wrapFetchWithPayment") &&
      /\bregisterExtension\s*\([\s\S]*\bBuilderCodeClientExtension\b/.test(source);
    const hasSellerExtension =
      candidate.marker === "paymentMiddleware" && /\bdeclareBuilderCodeExtension\s*\(/.test(source);
    if (hasClientExtension || hasSellerExtension) {
      return { kind: "helper", detail: "official x402 Builder Code extension" };
    }
    return undefined;
  }

  if (candidate.family === "wallet") {
    if (
      /\b(?:attributeUserOperation|sendAttributedCalls|withUserOperationAttribution)\b/.test(
        directSource,
      ) ||
      /\b(?:attributeUserOperation|createAttributionProvider|withUserOperationAttribution)\b/.test(
        source,
      )
    ) {
      return { kind: "helper", detail: "Smart Wallet Attribution Kit middleware" };
    }
    if (
      /\bcapabilities\b[\s\S]*\bdataSuffix\b/.test(directSource) &&
      /\bwallet_getCapabilities\b/.test(source)
    ) {
      return { kind: "config", detail: "negotiated EIP-5792 dataSuffix capability" };
    }
    return undefined;
  }

  if (/\bdataSuffix\b/.test(directSource)) {
    return { kind: "config", detail: "transaction dataSuffix" };
  }
  if (ATTRIBUTION_HELPER_REGEX.test(directSource)) {
    return { kind: "helper", detail: "Builder Code attribution helper" };
  }
  if (/\bdata\b\s*:\s*[^,}\n]+(?:suffix|Suffix|DATA_SUFFIX)/.test(directSource)) {
    return { kind: "suffix", detail: "suffix appended to transaction calldata" };
  }

  return undefined;
}

function collectProjectEvidence(
  records: SourceRecord[],
  builderCodes: string[],
): ProjectEvidence[] {
  const evidence: ProjectEvidence[] = [];

  for (const record of records) {
    if (!hasProjectConfigEvidence(record.source)) {
      continue;
    }

    const expected = builderCodes.some((code) => containsBuilderCode(record.source, code));
    const location = locationOf(
      record.source,
      /\bdataSuffix\b|attributeUserOperation|BuilderCodeClientExtension|createAttributionProvider|declareBuilderCodeExtension|withUserOperationAttribution/,
    );
    const families = evidenceFamilies(record);

    for (const family of families) {
      evidence.push({
        family,
        expected,
        dynamic: !expected,
        evidence: {
          kind: "config",
          detail: "project-level attribution configuration",
          file: record.relativePath,
          line: location,
        },
      });
    }
  }

  return evidence;
}

function evidenceFamilies(record: SourceRecord): TransactionFamily[] {
  const families = new Set<TransactionFamily>();

  if (record.frameworks.includes("privy")) families.add("privy");
  if (record.frameworks.includes("wagmi")) families.add("wagmi");
  if (record.frameworks.includes("viem")) families.add("viem");
  if (record.frameworks.includes("ethers")) families.add("ethers");
  if (record.frameworks.includes("x402")) families.add("x402");
  if (record.frameworks.includes("smart-wallet")) families.add("wallet");
  if (record.frameworks.includes("raw-rpc")) families.add("rpc");
  if (record.frameworks.includes("agent")) families.add("agent");

  if (families.size === 0 && /\bcreateWalletClient\b/.test(record.source)) {
    families.add("viem");
  }

  return Array.from(families);
}

function hasProjectConfigEvidence(source: string): boolean {
  return (
    /\b(?:createWalletClient|createConfig)\b[\s\S]*\bdataSuffix\b/.test(source) ||
    /\bplugins\s*:[\s\S]*\bdataSuffix\s*\(/.test(source) ||
    /\bcreateAttributionProvider\s*\(/.test(source) ||
    /\b(?:attributeUserOperation|withUserOperationAttribution)\s*\(/.test(source) ||
    (/\bwallet_getCapabilities\b/.test(source) &&
      /\bcapabilities\b[\s\S]*\bdataSuffix\b/.test(source)) ||
    /\bregisterExtension\s*\([\s\S]*\bBuilderCodeClientExtension\b/.test(source) ||
    /\bdeclareBuilderCodeExtension\s*\(/.test(source) ||
    /\bcreateAttributionSigner\s*\(/.test(source)
  );
}

function missingRuleFor(family: TransactionFamily): RuleId {
  if (family === "wallet") return "BAO005";
  if (family === "x402") return "BAO006";
  return "BAO001";
}

function missingMessage(candidate: Candidate): string {
  if (candidate.family === "wallet") {
    return `${candidate.marker} is missing the EIP-5792 dataSuffix capability.`;
  }
  if (candidate.family === "x402") {
    return `${candidate.marker} is missing the official x402 Builder Code extension.`;
  }
  return `${candidate.marker} does not have Builder Code attribution evidence.`;
}

function suggestionFor(family: TransactionFamily): string {
  switch (family) {
    case "wallet":
      return "Use Smart Wallet Attribution Kit middleware or negotiate wallet_getCapabilities before adding capabilities.dataSuffix.";
    case "x402":
      return "Register BuilderCodeClientExtension or declareBuilderCodeExtension.";
    case "privy":
      return "Configure Privy's dataSuffix plugin with an ERC-8021 suffix.";
    case "rpc":
      return "Append the ERC-8021 suffix to the transaction data field.";
    default:
      return "Add a BAO SDK helper or dataSuffix configuration to this transaction path.";
  }
}

function severityFor(
  status: TransactionPath["status"],
  ruleId: RuleId | undefined,
  profile: ScanProfile,
  rules?: BaoRuleConfig,
): FindingSeverity {
  if (status === "protected") return "off";

  const configured =
    ruleId === "BAO004"
      ? rules?.["ambiguous-path"]
      : status === "missing"
        ? rules?.["missing-attribution"]
        : status === "wrong-code"
          ? rules?.["wrong-builder-code"]
          : rules?.["dynamic-attribution"];

  if (configured) return configured;
  if (profile === "local") return "warning";
  if (profile === "strict") return "error";
  return status === "unresolved" ? "warning" : "error";
}

function summarize(paths: TransactionPath[]): AttributionSummary {
  const protectedCount = paths.filter((entry) => entry.status === "protected").length;
  const baselineCount = paths.filter((entry) => entry.baseline).length;

  return {
    total: paths.length,
    protected: protectedCount,
    missing: paths.filter((entry) => entry.status === "missing").length,
    wrongCode: paths.filter((entry) => entry.status === "wrong-code").length,
    unresolved: paths.filter((entry) => entry.status === "unresolved").length,
    errors: paths.filter((entry) => entry.severity === "error" && !entry.baseline).length,
    warnings: paths.filter((entry) => entry.severity === "warning" && !entry.baseline).length,
    baseline: baselineCount,
    coverage: paths.length === 0 ? 100 : Math.round((protectedCount / paths.length) * 100),
  };
}

async function resolveFiles(root: string, options: AnalyzeProjectOptions): Promise<string[]> {
  let files: string[];

  if (options.files && options.files.length > 0) {
    files = options.files.map((file) => path.resolve(root, file));
  } else {
    files = await collectSourceFiles(root);
  }

  if (options.changedSince) {
    const changed = await changedFiles(root, options.changedSince);
    files = files.filter((file) => changed.has(normalizePath(path.relative(root, file))));
  }

  return Array.from(new Set(files))
    .filter((file) => SOURCE_EXTENSIONS.has(path.extname(file)))
    .filter((file) => matchesIncludes(normalizePath(path.relative(root, file)), options.include))
    .filter((file) => !matchesExcludes(normalizePath(path.relative(root, file)), options.exclude))
    .sort();
}

async function collectSourceFiles(root: string): Promise<string[]> {
  const stat = await fs.stat(root).catch(() => undefined);
  if (!stat) return [];
  if (stat.isFile()) return SOURCE_EXTENSIONS.has(path.extname(root)) ? [root] : [];

  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(fullPath)));
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name)))
      files.push(fullPath);
  }

  return files;
}

async function changedFiles(root: string, ref: string): Promise<Set<string>> {
  const { stdout } = await execFile("git", ["diff", "--name-only", `${ref}...HEAD`, "--"], {
    cwd: root,
  });
  return new Set(
    stdout
      .split(/\r?\n/)
      .map((entry) => normalizePath(entry.trim()))
      .filter(Boolean),
  );
}

function matchesIncludes(file: string, includes?: string[]): boolean {
  if (!includes || includes.length === 0) return true;
  return includes.some((entry) => pathRuleMatches(file, entry));
}

function matchesExcludes(file: string, excludes?: string[]): boolean {
  return excludes?.some((entry) => pathRuleMatches(file, entry)) ?? false;
}

function pathRuleMatches(file: string, rule: string): boolean {
  const normalized = normalizePath(rule).replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalized.includes("*")) {
    return file === normalized || file.startsWith(`${normalized}/`);
  }
  let pattern = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];
    const afterNext = normalized[index + 2];

    if (character === "*" && next === "*" && afterNext === "/") {
      pattern += "(?:.*/)?";
      index += 2;
    } else if (character === "*" && next === "*") {
      pattern += ".*";
      index += 1;
    } else if (character === "*") {
      pattern += "[^/]*";
    } else {
      pattern += character.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }

  return new RegExp(`^${pattern}$`).test(file);
}

function readRequestMethod(node: ts.CallExpression): string | undefined {
  const first = node.arguments[0];
  if (!first || !ts.isObjectLiteralExpression(first)) return undefined;

  for (const property of first.properties) {
    if (!ts.isPropertyAssignment(property) || propertyName(property.name) !== "method") continue;
    if (ts.isStringLiteralLike(property.initializer)) return property.initializer.text;
  }

  return undefined;
}

function expressionName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return undefined;
}

function discoverBuilderCodes(source: string): string[] {
  return Array.from(new Set(source.match(BUILDER_CODE_REGEX) ?? []));
}

function containsBuilderCode(source: string, code: string): boolean {
  return (
    source.includes(`"${code}"`) || source.includes(`'${code}'`) || source.includes(`\`${code}\``)
  );
}

function assertBuilderCodes(codes: string[]): void {
  const errors = validateBuilderCodes(codes);
  if (errors.length > 0) throw new Error(errors.join("; "));
}

function normalizeFingerprintSource(source: string): string {
  return source.replace(/\s+/g, " ").trim();
}

function confidenceFor(
  family: TransactionFamily,
  frameworks: string[],
): TransactionPath["confidence"] {
  if (family === "viem" && !frameworks.includes("viem")) return "low";
  return "high";
}

function locationOf(source: string, regex: RegExp): number {
  const index = source.search(regex);
  return index < 0 ? 1 : source.slice(0, index).split(/\r?\n/).length;
}

function createFingerprint(...parts: Array<string | number>): string {
  return createHash("sha256").update(parts.join(":"), "utf8").digest("hex").slice(0, 20);
}

function scriptKindFor(file: string): ts.ScriptKind {
  switch (path.extname(file)) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function normalizePath(file: string): string {
  return file.replaceAll("\\", "/");
}
