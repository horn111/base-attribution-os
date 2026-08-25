import type { AttributionReport, RuleId, TransactionPath } from "./types.js";

const RULES: Record<RuleId, { description: string; name: string }> = {
  BAO001: {
    name: "missing-attribution",
    description: "A transaction path does not include Builder Code attribution.",
  },
  BAO002: {
    name: "wrong-builder-code",
    description:
      "A transaction path contains a Builder Code that is not configured for this project.",
  },
  BAO003: {
    name: "dynamic-attribution",
    description: "Attribution is configured dynamically and cannot be proven statically.",
  },
  BAO004: {
    name: "ambiguous-path",
    description: "A transaction path could not be classified with high confidence.",
  },
  BAO005: {
    name: "smart-wallet-data-suffix",
    description:
      "A smart-wallet call is missing negotiated EIP-5792 or ERC-4337 attribution middleware.",
  },
  BAO006: {
    name: "x402-builder-code-extension",
    description: "An x402 payment path is missing a Builder Code extension.",
  },
};

export function reportToSarif(report: AttributionReport): object {
  const findings = report.transactionPaths.filter(
    (entry): entry is TransactionPath & { ruleId: RuleId } =>
      entry.status !== "protected" && entry.ruleId !== undefined && !entry.baseline,
  );

  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "Base Attribution OS",
            informationUri: "https://github.com/horn111/base-attribution-os",
            rules: Object.entries(RULES).map(([id, rule]) => ({
              id,
              name: rule.name,
              shortDescription: { text: rule.description },
            })),
          },
        },
        results: findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: finding.severity === "error" ? "error" : "warning",
          message: { text: finding.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.file.replaceAll("\\", "/") },
                region: {
                  startLine: finding.line,
                  startColumn: finding.column,
                },
              },
            },
          ],
          partialFingerprints: {
            primaryLocationLineHash: finding.fingerprint,
          },
        })),
      },
    ],
  };
}
