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
  /\b(?:appendDataSuffix|attributeSendCalls|attributeUserOperation|Attribution\.toDataSuffix|BuilderCodeClientExtension|builderCodeDataSuffix|createAttributionProvider|createAttributionSigner|createDataSuffix|dataSuffix|declareBuilderCodeExtension|ethersBuilderCodeDataSuffix|sendAttributedCalls|useAttributionSuffix|validateUserOperationAttribution|withAttributionSuffix|withDataSuffixCapability|withEthersAttribution|withUserOperationAttribution|withViemDataSuffix)\b/;
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
  exportedBindings: string[];
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

interface LinkedSyntax {
  identifiers: Set<string>;
  literals: Set<string>;
  memberAccesses: Set<string>;
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
    /\b(?:createAttributionProvider|eth_sendUserOperation|sendAttributedCalls|sendCalls|sendUserOperation|wallet_getCapabilities|wallet_sendCalls|useSendCalls|withDataSuffixCapability|withUserOperationAttribution)\b/.test(
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
  const attributionRoots = collectAttributionRoots(candidate);
  const directSyntax = collectAttributionSyntax(sourceFile, attributionRoots, false);
  const linkedSyntax = collectAttributionSyntax(sourceFile, attributionRoots, true);
  const x402Registration =
    candidate.family === "x402"
      ? collectX402Registration(sourceFile, candidate)
      : { found: false, literals: new Set<string>() };

  for (const literal of x402Registration.literals) {
    linkedSyntax.literals.add(literal);
  }

  const expectedSuffixes = options.builderCodes.map((code) =>
    createDataSuffix({ codes: [code] })
      .slice(2)
      .toLowerCase(),
  );
  const directCodes = discoverBuilderCodesInLiterals(directSyntax.literals);
  const linkedCodes = discoverBuilderCodesInLiterals(linkedSyntax.literals);
  const hasExpectedDirectCode = options.builderCodes.some((code) =>
    directSyntax.literals.has(code),
  );
  const hasExpectedLinkedCode = options.builderCodes.some((code) =>
    linkedSyntax.literals.has(code),
  );
  const hasExpectedSuffix = expectedSuffixes.some((suffix) =>
    Array.from(linkedSyntax.literals).some((literal) =>
      literal.toLowerCase().replace(/^0x/, "").includes(suffix),
    ),
  );
  const wrongDirectCode = directCodes.find((code) => !options.builderCodes.includes(code));
  const wrongLinkedCode = linkedCodes.find((code) => !options.builderCodes.includes(code));
  const localAttribution = findLocalAttribution(
    candidate,
    directSource,
    source,
    x402Registration.found,
  );
  const familyEvidence =
    options.globalEvidence?.filter((entry) => entry.family === candidate.family) ?? [];
  const linkedProjectEvidence = familyEvidence.find(
    (entry) =>
      entry.expected &&
      candidate.family === "privy" &&
      isPrivyProjectEvidenceLinked(sourceFile, candidate, entry, options.builderCodes),
  );
  const projectEvidence =
    linkedProjectEvidence ?? familyEvidence.find((entry) => entry.expected) ?? familyEvidence[0];
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

  const wrongCode = wrongDirectCode ?? (localAttribution ? wrongLinkedCode : undefined);
  if (wrongCode && !hasExpectedDirectCode && !hasExpectedSuffix) {
    status = "wrong-code";
    ruleId = "BAO002";
    message = `${candidate.marker} uses ${wrongCode}, which is not configured for this project.`;
    suggestion = "Replace it with a Builder Code from bao.config.json.";
  } else if (
    localAttribution &&
    (hasExpectedDirectCode || hasExpectedLinkedCode || hasExpectedSuffix)
  ) {
    status = "protected";
    message = `${candidate.marker} is protected by Builder Code attribution.`;
    confidence = hasExpectedDirectCode ? "high" : "medium";
  } else if (
    projectEvidence?.expected &&
    candidate.family === "privy" &&
    (options.profile !== "strict" || linkedProjectEvidence)
  ) {
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
  hasLinkedX402Registration = false,
): { detail: string; kind: AttributionEvidence["kind"] } | undefined {
  if (candidate.family === "x402") {
    const hasClientExtension =
      (candidate.marker === "x402Client" || candidate.marker === "wrapFetchWithPayment") &&
      hasLinkedX402Registration;
    const hasSellerExtension =
      candidate.marker === "paymentMiddleware" && /\bdeclareBuilderCodeExtension\s*\(/.test(source);
    if (hasClientExtension || hasSellerExtension) {
      return { kind: "helper", detail: "official x402 Builder Code extension" };
    }
    return undefined;
  }

  if (candidate.family === "wallet") {
    if (
      /\b(?:attributeUserOperation|sendAttributedCalls|withDataSuffixCapability|withUserOperationAttribution)\b/.test(
        directSource,
      ) ||
      /\b(?:attributeUserOperation|createAttributionProvider|withDataSuffixCapability|withUserOperationAttribution)\b/.test(
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

function collectLinkedSyntax(sourceFile: ts.SourceFile, root: ts.Node): LinkedSyntax {
  const syntax: LinkedSyntax = {
    identifiers: new Set(),
    literals: new Set(),
    memberAccesses: new Set(),
  };
  const declarations = collectValueDeclarations(sourceFile);
  const visitedValues = new Set<ts.Node>();

  function visit(node: ts.Node): void {
    if (isValueLiteral(node)) {
      syntax.literals.add(node.text);
    }

    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      syntax.identifiers.add(node.text);
      const declaration = findVisibleDeclaration(
        declarations,
        node.text,
        node.getStart(sourceFile),
      );
      const value = declaration ? declarationValue(declaration.node) : undefined;

      if (value && !visitedValues.has(value)) {
        visitedValues.add(value);
        visit(value);
      }
    }

    if (ts.isPropertyAccessExpression(node)) {
      syntax.memberAccesses.add(node.getText(sourceFile));
    }

    ts.forEachChild(node, visit);
  }

  visit(root);
  return syntax;
}

function collectAttributionSyntax(
  sourceFile: ts.SourceFile,
  roots: ts.Node[],
  followDeclarations: boolean,
): LinkedSyntax {
  const syntax: LinkedSyntax = {
    identifiers: new Set(),
    literals: new Set(),
    memberAccesses: new Set(),
  };
  const declarations = followDeclarations ? collectValueDeclarations(sourceFile) : [];
  const visitedValues = new Set<ts.Node>();
  const evidenceProperties = new Set([
    "appDataSuffix",
    "capabilities",
    "codes",
    "dataSuffix",
    "value",
    "walletCodes",
  ]);

  function visit(node: ts.Node): void {
    if (isValueLiteral(node)) syntax.literals.add(node.text);
    if (ts.isPropertyAccessExpression(node)) syntax.memberAccesses.add(node.getText(sourceFile));

    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      syntax.identifiers.add(node.text);
      if (followDeclarations) {
        const declaration = findVisibleDeclaration(
          declarations,
          node.text,
          node.getStart(sourceFile),
        );
        const value = declaration ? declarationValue(declaration.node) : undefined;
        if (value && !visitedValues.has(value)) {
          visitedValues.add(value);
          visit(value);
        }
      }
      return;
    }

    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        const name =
          ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)
            ? propertyName(property.name)
            : undefined;
        if (!name || !evidenceProperties.has(name)) continue;
        if (ts.isPropertyAssignment(property)) visit(property.initializer);
        else if (ts.isShorthandPropertyAssignment(property)) visit(property.name);
      }
      return;
    }

    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const marker = expressionName(node.expression);
      for (const argument of attributionArguments(marker, node.arguments ?? [])) visit(argument);
      return;
    }

    ts.forEachChild(node, visit);
  }

  for (const root of roots) visit(root);
  return syntax;
}

function attributionArguments(
  marker: string | undefined,
  args: readonly ts.Expression[],
): readonly ts.Expression[] {
  switch (marker) {
    case "appendDataSuffix":
    case "attributeSendCalls":
    case "attributeUserOperation":
    case "createAttributionProvider":
    case "createAttributionSigner":
    case "withAttributionSuffix":
    case "withDataSuffixCapability":
    case "withEthersAttribution":
    case "withUserOperationAttribution":
    case "withViemDataSuffix":
      return args[1] ? [args[1]] : [];
    case "sendAttributedCalls":
      return args[2] ? [args[2]] : [];
    case "BuilderCodeClientExtension":
    case "builderCodeDataSuffix":
    case "createConfig":
    case "createDataSuffix":
    case "createWalletClient":
    case "dataSuffix":
    case "declareBuilderCodeExtension":
    case "ethersBuilderCodeDataSuffix":
    case "registerExtension":
    case "toDataSuffix":
    case "useAttributionSuffix":
      return args;
    default:
      return [];
  }
}

function collectAttributionRoots(candidate: Candidate): ts.Node[] {
  const roots: ts.Node[] = [];
  const seen = new Set<ts.Node>();

  function add(node: ts.Node): void {
    if (!seen.has(node)) {
      seen.add(node);
      roots.push(node);
    }
  }

  if (candidate.marker === "sendAttributedCalls") {
    add(candidate.node);
    return roots;
  }

  function visitX402Extensions(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      expressionName(node.expression) === "declareBuilderCodeExtension"
    ) {
      add(node);
      return;
    }
    ts.forEachChild(node, visitX402Extensions);
  }

  function visit(node: ts.Node): void {
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === "dataSuffix") {
      add(node.initializer);
      return;
    }
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === "dataSuffix") {
      add(node.name);
      return;
    }
    if (
      candidate.family === "x402" &&
      ts.isPropertyAssignment(node) &&
      propertyName(node.name) === "extensions"
    ) {
      visitX402Extensions(node.initializer);
      return;
    }
    if (
      candidate.marker === "eth_sendUserOperation" &&
      ts.isPropertyAssignment(node) &&
      propertyName(node.name) === "params" &&
      ts.isArrayLiteralExpression(node.initializer) &&
      node.initializer.elements[0]
    ) {
      add(node.initializer.elements[0]);
      return;
    }
    if (
      ts.isPropertyAssignment(node) &&
      propertyName(node.name) === "data" &&
      /(?:suffix|Suffix|DATA_SUFFIX)/.test(node.initializer.getText())
    ) {
      add(node.initializer);
      return;
    }

    if (
      ts.isPropertyAssignment(node) &&
      (propertyName(node.name) === "capabilities" || propertyName(node.name) === "params")
    ) {
      visit(node.initializer);
      return;
    }
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isObjectLiteralExpression(node.initializer) ||
        ts.isArrayLiteralExpression(node.initializer))
    ) {
      visit(node.initializer);
      return;
    }

    if (ts.isCallExpression(node) && node !== candidate.node) {
      const marker = expressionName(node.expression);
      if (marker && ATTRIBUTION_HELPER_REGEX.test(marker)) {
        add(node);
      }
      return;
    }

    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        visit(property);
      }
      return;
    }

    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) visit(element);
    }
  }

  if (ts.isCallExpression(candidate.node)) {
    for (const argument of candidate.node.arguments) visit(argument);
  }
  return roots;
}

interface ValueDeclaration {
  name: string;
  node: ts.Declaration;
  scope: ts.Node;
}

function collectValueDeclarations(sourceFile: ts.SourceFile): ValueDeclaration[] {
  const declarations: ValueDeclaration[] = [];

  function addBindingNames(name: ts.BindingName, node: ts.Declaration): void {
    if (ts.isIdentifier(name)) {
      declarations.push({ name: name.text, node, scope: declarationScope(node, sourceFile) });
      return;
    }

    for (const element of name.elements) {
      if (ts.isBindingElement(element)) {
        addBindingNames(element.name, node);
      }
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
      addBindingNames(node.name, node);
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      declarations.push({
        name: node.name.text,
        node,
        scope: declarationScope(node, sourceFile),
      });
    } else if (ts.isImportClause(node) && node.name) {
      declarations.push({ name: node.name.text, node, scope: sourceFile });
    } else if (ts.isImportSpecifier(node)) {
      declarations.push({ name: node.name.text, node, scope: sourceFile });
    } else if (ts.isNamespaceImport(node)) {
      declarations.push({ name: node.name.text, node, scope: sourceFile });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return declarations;
}

function findVisibleDeclaration(
  declarations: ValueDeclaration[],
  name: string,
  referencePosition: number,
): ValueDeclaration | undefined {
  return declarations
    .filter((entry) => {
      const scopeStart = entry.scope.getStart();
      const scopeEnd = entry.scope.getEnd();
      const isHoisted =
        ts.isFunctionDeclaration(entry.node) ||
        ts.isImportClause(entry.node) ||
        ts.isImportSpecifier(entry.node) ||
        ts.isNamespaceImport(entry.node);

      return (
        entry.name === name &&
        scopeStart <= referencePosition &&
        referencePosition <= scopeEnd &&
        (isHoisted || entry.node.getStart() <= referencePosition)
      );
    })
    .sort((left, right) => {
      const scopeDifference =
        left.scope.getEnd() -
        left.scope.getStart() -
        (right.scope.getEnd() - right.scope.getStart());
      return scopeDifference || right.node.getStart() - left.node.getStart();
    })[0];
}

function declarationScope(node: ts.Node, sourceFile: ts.SourceFile): ts.Node {
  let current = node.parent;

  while (current && current !== sourceFile) {
    if (ts.isBlock(current) || ts.isFunctionLike(current) || ts.isModuleBlock(current)) {
      return current;
    }
    current = current.parent;
  }

  return sourceFile;
}

function declarationValue(node: ts.Declaration): ts.Node | undefined {
  if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
    return node.initializer;
  }
  if (ts.isFunctionDeclaration(node)) {
    return node.body;
  }
  return undefined;
}

function isReferenceIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;

  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return false;
  if (ts.isParameter(parent) && parent.name === node) return false;
  if (ts.isBindingElement(parent) && parent.name === node) return false;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return false;
  if (ts.isImportClause(parent) || ts.isImportSpecifier(parent) || ts.isNamespaceImport(parent)) {
    return false;
  }
  if (ts.isJsxAttribute(parent) && parent.name === node) return false;

  return true;
}

function isValueLiteral(node: ts.Node): node is ts.StringLiteralLike {
  if (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node)) {
    return false;
  }

  const parent = node.parent;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return false;
  if (ts.isImportDeclaration(parent) && parent.moduleSpecifier === node) return false;
  if (ts.isExportDeclaration(parent) && parent.moduleSpecifier === node) return false;

  return true;
}

function collectX402Registration(
  sourceFile: ts.SourceFile,
  candidate: Candidate,
): { found: boolean; literals: Set<string> } {
  const literals = new Set<string>();
  let found = false;
  const declarations = collectValueDeclarations(sourceFile);
  const clientDeclarations = new Set<ts.Declaration>();
  let current: ts.Node | undefined = candidate.node;

  while (current && current !== sourceFile) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      if (
        ts.isNewExpression(candidate.node) &&
        expressionName(candidate.node.expression) === "x402Client"
      ) {
        clientDeclarations.add(current);
      }
      break;
    }
    current = current.parent;
  }

  function traceClientDeclaration(
    declaration: ValueDeclaration,
    chain: ts.Declaration[] = [],
  ): boolean {
    if (chain.includes(declaration.node)) return false;
    const value = declarationValue(declaration.node);
    const nextChain = [...chain, declaration.node];

    if (value && ts.isNewExpression(value) && expressionName(value.expression) === "x402Client") {
      for (const entry of nextChain) clientDeclarations.add(entry);
      return true;
    }

    if (value && ts.isIdentifier(value)) {
      const next = findVisibleDeclaration(declarations, value.text, value.getStart(sourceFile));
      if (next && traceClientDeclaration(next, nextChain)) {
        for (const entry of nextChain) clientDeclarations.add(entry);
        return true;
      }
    }

    return false;
  }

  function collectCandidateClients(node: ts.Node): void {
    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      const declaration = findVisibleDeclaration(
        declarations,
        node.text,
        node.getStart(sourceFile),
      );
      if (declaration) traceClientDeclaration(declaration);
    }
    ts.forEachChild(node, collectCandidateClients);
  }

  collectCandidateClients(candidate.node);

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "registerExtension" &&
      ts.isIdentifier(node.expression.expression)
    ) {
      const receiver = findVisibleDeclaration(
        declarations,
        node.expression.expression.text,
        node.expression.expression.getStart(sourceFile),
      );
      if (receiver && clientDeclarations.has(receiver.node)) {
        found = true;
        for (const literal of collectAttributionSyntax(sourceFile, [node], true).literals) {
          literals.add(literal);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { found, literals };
}

function collectProjectConfigNodes(sourceFile: ts.SourceFile): ts.Node[] {
  const nodes: ts.Node[] = [];
  const configCalls = new Set([
    "attributeUserOperation",
    "createAttributionProvider",
    "createAttributionSigner",
    "dataSuffix",
    "declareBuilderCodeExtension",
    "registerExtension",
    "withDataSuffixCapability",
    "withUserOperationAttribution",
  ]);

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const marker = expressionName(node.expression);
      if (
        (marker && configCalls.has(marker)) ||
        ((marker === "createWalletClient" || marker === "createConfig") &&
          /\bdataSuffix\b/.test(node.getText(sourceFile)))
      ) {
        nodes.push(node);
      }
    } else if (
      ts.isNewExpression(node) &&
      expressionName(node.expression) === "BuilderCodeClientExtension"
    ) {
      nodes.push(node);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return nodes.sort((left, right) => left.getStart(sourceFile) - right.getStart(sourceFile));
}

function exportedBindingsForNode(node: ts.Node): string[] {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      let statement: ts.Node | undefined = current.parent;
      while (statement && !ts.isVariableStatement(statement)) statement = statement.parent;
      const exported =
        statement &&
        ts.isVariableStatement(statement) &&
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
      return exported ? [current.name.text] : [];
    }
    if (ts.isExportAssignment(current)) {
      return ["default"];
    }
    current = current.parent;
  }

  return [];
}

function isPrivyProjectEvidenceLinked(
  sourceFile: ts.SourceFile,
  candidate: Candidate,
  evidence: ProjectEvidence,
  builderCodes: string[],
): boolean {
  const candidateSyntax = collectLinkedSyntax(sourceFile, candidate.node);
  if (!referencesPrivyHook(sourceFile, candidateSyntax)) {
    return false;
  }

  const componentName = containingFunctionName(candidate.node);
  const importedBindings = importedBindingsForEvidence(sourceFile, evidence);
  let linked = false;

  function visit(node: ts.Node): void {
    if (linked || !ts.isJsxElement(node) || jsxTagName(node.openingElement) !== "PrivyProvider") {
      ts.forEachChild(node, visit);
      return;
    }

    const config = node.openingElement.attributes.properties.find(
      (attribute): attribute is ts.JsxAttribute =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === "config",
    );
    const configExpression =
      config?.initializer && ts.isJsxExpression(config.initializer)
        ? config.initializer.expression
        : undefined;

    if (!configExpression) {
      ts.forEachChild(node, visit);
      return;
    }

    const configSyntax = collectLinkedSyntax(sourceFile, configExpression);
    const configEvidenceSyntax = collectAttributionSyntax(sourceFile, [configExpression], true);
    const configUsesEvidence =
      (normalizePath(evidence.evidence.file) === normalizePath(sourceFile.fileName) &&
        builderCodes.some((code) => configEvidenceSyntax.literals.has(code))) ||
      Array.from(importedBindings).some((binding) =>
        binding.includes(".")
          ? configSyntax.memberAccesses.has(binding)
          : configSyntax.identifiers.has(binding),
      );
    const candidateIsChild =
      (candidate.node.getStart(sourceFile) >= node.getStart(sourceFile) &&
        candidate.node.getEnd() <= node.getEnd()) ||
      (componentName ? jsxContainsComponent(node, componentName, sourceFile) : false);

    linked = configUsesEvidence && candidateIsChild;
    if (!linked) ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return linked;
}

function containingFunctionName(node: ts.Node): string | undefined {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    current = current.parent;
  }

  return undefined;
}

function jsxContainsComponent(
  root: ts.JsxElement,
  componentName: string,
  sourceFile: ts.SourceFile,
): boolean {
  let found = false;

  function visit(node: ts.Node): void {
    if (found) return;
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sourceFile) === componentName
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  for (const child of root.children) visit(child);
  return found;
}

function jsxTagName(node: ts.JsxOpeningElement): string {
  return ts.isIdentifier(node.tagName) ? node.tagName.text : node.tagName.getText();
}

function importedBindingsForEvidence(
  sourceFile: ts.SourceFile,
  evidence: ProjectEvidence,
): Set<string> {
  const bindings = new Set<string>();
  const exportedBindings = new Set(evidence.exportedBindings);

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.importClause ||
      !moduleSpecifierMatchesFile(
        sourceFile.fileName,
        statement.moduleSpecifier.text,
        evidence.evidence.file,
      )
    ) {
      continue;
    }

    if (statement.importClause.name && exportedBindings.has("default")) {
      bindings.add(statement.importClause.name.text);
    }
    const namedBindings = statement.importClause.namedBindings;
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      for (const exportedBinding of exportedBindings) {
        if (exportedBinding !== "default") {
          bindings.add(`${namedBindings.name.text}.${exportedBinding}`);
        }
      }
    } else if (namedBindings) {
      for (const element of namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        if (exportedBindings.has(importedName)) bindings.add(element.name.text);
      }
    }
  }

  return bindings;
}

function referencesPrivyHook(sourceFile: ts.SourceFile, syntax: LinkedSyntax): boolean {
  const identifierHooks = new Set<string>();
  const memberHooks = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "@privy-io/react-auth" ||
      !statement.importClause?.namedBindings
    ) {
      continue;
    }

    const namedBindings = statement.importClause.namedBindings;
    if (ts.isNamespaceImport(namedBindings)) {
      memberHooks.add(`${namedBindings.name.text}.usePrivy`);
      memberHooks.add(`${namedBindings.name.text}.useWallets`);
      continue;
    }

    for (const element of namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName === "usePrivy" || importedName === "useWallets") {
        identifierHooks.add(element.name.text);
      }
    }
  }

  return (
    Array.from(identifierHooks).some((hook) => syntax.identifiers.has(hook)) ||
    Array.from(memberHooks).some((hook) => syntax.memberAccesses.has(hook))
  );
}

function moduleSpecifierMatchesFile(
  currentFile: string,
  moduleSpecifier: string,
  evidenceFile: string,
): boolean {
  if (!moduleSpecifier.startsWith(".")) return false;

  const resolved = normalizePath(
    path.posix.normalize(
      path.posix.join(path.posix.dirname(normalizePath(currentFile)), moduleSpecifier),
    ),
  );
  return normalizeModuleId(resolved) === normalizeModuleId(normalizePath(evidenceFile));
}

function normalizeModuleId(file: string): string {
  return file.replace(/\.(?:[cm]?[jt]sx?)$/, "").replace(/\/index$/, "");
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

    const sourceFile = ts.createSourceFile(
      record.relativePath,
      record.source,
      ts.ScriptTarget.Latest,
      true,
      scriptKindFor(record.relativePath),
    );
    const configNodes = collectProjectConfigNodes(sourceFile);

    if (configNodes.length === 0) {
      continue;
    }

    const expectedNodes = configNodes.filter((node) => {
      const literals = collectAttributionSyntax(sourceFile, [node], true).literals;
      return builderCodes.some((code) => literals.has(code));
    });
    const expected = expectedNodes.length > 0;
    const exportedBindings = Array.from(
      new Set(expectedNodes.flatMap((node) => exportedBindingsForNode(node))),
    );
    const location =
      sourceFile.getLineAndCharacterOfPosition(configNodes[0].getStart(sourceFile)).line + 1;
    const families = evidenceFamilies(record);

    for (const family of families) {
      evidence.push({
        family,
        expected,
        dynamic: !expected,
        exportedBindings,
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
    /\b(?:attributeUserOperation|withDataSuffixCapability|withUserOperationAttribution)\s*\(/.test(
      source,
    ) ||
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

function discoverBuilderCodesInLiterals(literals: Set<string>): string[] {
  return Array.from(
    new Set(Array.from(literals).flatMap((literal) => literal.match(BUILDER_CODE_REGEX) ?? [])),
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
