"use client";

import { useMemo, useState, type ChangeEvent } from "react";

type Profile = "local" | "ci" | "strict";
type Family = "agent" | "ethers" | "viem" | "wagmi" | "wallet";
type Reason = "missing-attribution" | "wrong-builder-code";

interface Finding {
  line: number;
  family: Family;
  marker: string;
  reason: Reason;
}

interface ScanResult {
  ok: boolean;
  candidateFiles: number;
  findings: Finding[];
}

interface Example {
  id: string;
  label: string;
  file: string;
  source: string;
}

interface TransactionPattern {
  marker: string;
  family: Family;
  regex: RegExp;
}

const profiles: Record<
  Profile,
  {
    label: string;
    intent: string;
    failOnMissing: boolean;
    requireExpectedCode: boolean;
  }
> = {
  local: {
    label: "local",
    intent: "report only",
    failOnMissing: false,
    requireExpectedCode: false,
  },
  ci: {
    label: "ci",
    intent: "fail obvious misses",
    failOnMissing: true,
    requireExpectedCode: false,
  },
  strict: {
    label: "strict",
    intent: "require expected code",
    failOnMissing: true,
    requireExpectedCode: true,
  },
};

const examples: Example[] = [
  {
    id: "ethers",
    label: "ethers",
    file: "src/checkout.ts",
    source: `import { Wallet } from "ethers";

export async function checkout(wallet: Wallet, to: string) {
  return wallet.sendTransaction({
    to,
    value: 1000000000000000n,
    data: "0x",
  });
}
`,
  },
  {
    id: "viem",
    label: "viem",
    file: "src/mint.ts",
    source: `import { builderCodeDataSuffix } from "@base-attribution-os/viem";

const dataSuffix = builderCodeDataSuffix("bc_abc123");

await walletClient.writeContract({
  address,
  abi,
  functionName: "mint",
  args: [],
  dataSuffix,
});
`,
  },
  {
    id: "wagmi",
    label: "wagmi",
    file: "app/mint-button.tsx",
    source: `import { useSendTransaction } from "wagmi";

export function MintButton() {
  const { sendTransaction } = useSendTransaction();
  return (
    <button
      onClick={() =>
        sendTransaction({
          to: "0x0000000000000000000000000000000000000000",
          data: "0x",
        })
      }
    >
      Mint
    </button>
  );
}
`,
  },
  {
    id: "wallet",
    label: "wallet",
    file: "src/wallet-sendcalls.ts",
    source: `export async function batch(provider: Eip1193Provider) {
  return provider.request({
    method: "wallet_sendCalls",
    params: [
      {
        calls: [{ to, value, data: "0x" }],
      },
    ],
  });
}
`,
  },
  {
    id: "agent",
    label: "agent",
    file: "src/agent-tool.ts",
    source: `export const transactionTool = {
  name: "send-base-transaction",
  execute: async ({ wallet, tx }) => {
    return wallet.sendTransaction(tx);
  },
};
`,
  },
];

const transactionPatterns: TransactionPattern[] = [
  {
    marker: "agentTransactionTool",
    family: "agent",
    regex:
      /\b(?:agentTransactionTool|executeTransaction|onchainAction|sendTransactionTool|transactionTool)\b/,
  },
  {
    marker: "populateTransaction",
    family: "ethers",
    regex: /\bpopulateTransaction\s*\(/,
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

const builderCodeRegex = /\bbc_[A-Za-z0-9._:-]+\b/g;
const attributionHelperRegex =
  /\b(?:appendDataSuffix|attributeSendCalls|builderCodeDataSuffix|createAttributionSigner|createDataSuffix|dataSuffix|ethersBuilderCodeDataSuffix|useAttributionSuffix|withAttributionSuffix|withEthersAttribution|withViemDataSuffix)\b/;
const ethersSourceRegex =
  /\bfrom\s+["'`]ethers["'`]|\bimport\s+["'`]ethers["'`]|\b(?:BrowserProvider|ContractRunner|JsonRpcSigner|new\s+Wallet)\b/;

export default function Page() {
  const [builderCode, setBuilderCode] = useState("bc_abc123");
  const [profile, setProfile] = useState<Profile>("ci");
  const [activeExample, setActiveExample] = useState(examples[0]);
  const [source, setSource] = useState(examples[0].source);
  const [copied, setCopied] = useState<string | undefined>();

  const result = useMemo(
    () => scanSource(source, builderCode.trim(), profile),
    [builderCode, profile, source],
  );
  const actionYaml = useMemo(
    () => createActionYaml(builderCode.trim(), profile),
    [builderCode, profile],
  );
  const statusLabel = result.ok ? "passing" : "failing";
  const statusTone = result.ok ? "good" : "bad";

  function selectExample(example: Example): void {
    setActiveExample(example);
    setSource(example.source);
  }

  function handleBuilderCode(event: ChangeEvent<HTMLInputElement>): void {
    setBuilderCode(event.target.value);
  }

  function handleSource(event: ChangeEvent<HTMLTextAreaElement>): void {
    setSource(event.target.value);
  }

  function copyText(label: string, value: string): void {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      window.setTimeout(() => setCopied(undefined), 1200);
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="https://github.com/horn111/base-attribution-os">
          <span className="brand-mark" aria-hidden="true">
            BAO
          </span>
          <span>Base Attribution OS</span>
        </a>
        <nav className="nav-links" aria-label="Project links">
          <a href="https://github.com/horn111/base-attribution-os">GitHub</a>
          <a href="https://github.com/horn111/base-attribution-os#readme">Docs</a>
          <a className="star-link" href="https://github.com/horn111/base-attribution-os">
            Star repo
          </a>
        </nav>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">Live scanner demo</p>
          <h1>Builder Codes in CI</h1>
        </div>
        <p className="lede">
          Try attribution checks across ethers, viem, wagmi, wallet batches, and agent transaction
          tools.
        </p>
      </section>

      <section className="demo-grid" aria-label="Base Attribution OS scanner demo">
        <aside className="panel control-panel">
          <div className="panel-heading">
            <p className="panel-kicker">Inputs</p>
            <h2>Scan setup</h2>
          </div>

          <label className="field">
            <span>Builder Code</span>
            <input value={builderCode} onChange={handleBuilderCode} spellCheck={false} />
          </label>

          <div className="field">
            <span>Profile</span>
            <div className="segmented" role="group" aria-label="Scanner profile">
              {(Object.keys(profiles) as Profile[]).map((entry) => (
                <button
                  key={entry}
                  className={entry === profile ? "is-active" : undefined}
                  type="button"
                  onClick={() => setProfile(entry)}
                >
                  {entry}
                </button>
              ))}
            </div>
            <p className="field-note">{profiles[profile].intent}</p>
          </div>

          <div className="field">
            <span>Example</span>
            <div className="example-list" role="list">
              {examples.map((example) => (
                <button
                  key={example.id}
                  className={example.id === activeExample.id ? "is-active" : undefined}
                  type="button"
                  onClick={() => selectExample(example)}
                >
                  <span>{example.label}</span>
                  <small>{example.file}</small>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="panel editor-panel">
          <div className="panel-heading editor-heading">
            <div>
              <p className="panel-kicker">Candidate file</p>
              <h2>{activeExample.file}</h2>
            </div>
            <button className="copy-button" type="button" onClick={() => copyText("code", source)}>
              {copied === "code" ? "Copied" : "Copy"}
            </button>
          </div>

          <textarea
            aria-label="Transaction source"
            className="code-editor"
            spellCheck={false}
            value={source}
            onChange={handleSource}
          />
        </section>

        <section className="panel result-panel">
          <div className="panel-heading">
            <p className="panel-kicker">Result</p>
            <h2>
              <span className={`status-dot ${statusTone}`} aria-hidden="true" />
              {statusLabel}
            </h2>
          </div>

          <dl className="metric-grid">
            <div>
              <dt>profile</dt>
              <dd>{profile}</dd>
            </div>
            <div>
              <dt>candidates</dt>
              <dd>{result.candidateFiles}</dd>
            </div>
            <div>
              <dt>findings</dt>
              <dd>{result.findings.length}</dd>
            </div>
          </dl>

          <div className="findings">
            {result.findings.length === 0 ? (
              <div className="empty-state">
                <strong>No findings</strong>
                <span>Attribution is present for this profile.</span>
              </div>
            ) : (
              result.findings.map((finding) => (
                <article className="finding-row" key={`${finding.marker}-${finding.line}`}>
                  <div>
                    <strong>{finding.reason}</strong>
                    <span>
                      line {finding.line} near {finding.marker}
                    </span>
                  </div>
                  <b>{finding.family}</b>
                </article>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="action-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">GitHub Action</p>
            <h2>validate-attribution.yml</h2>
          </div>
          <button
            className="copy-button"
            type="button"
            onClick={() => copyText("action", actionYaml)}
          >
            {copied === "action" ? "Copied" : "Copy"}
          </button>
        </div>
        <pre>
          <code>{actionYaml}</code>
        </pre>
      </section>
    </main>
  );
}

function scanSource(source: string, builderCode: string, profile: Profile): ScanResult {
  const profileConfig = profiles[profile];
  const match = findTransactionMatch(source);

  if (!match || builderCode.length === 0) {
    return {
      ok: true,
      candidateFiles: match ? 1 : 0,
      findings: [],
    };
  }

  const hasExpectedCode = source.includes(builderCode);
  const hasExpectedSuffix = source.toLowerCase().includes(stringToHex(builderCode).slice(2));
  const discoveredCodes = Array.from(source.matchAll(builderCodeRegex), (entry) => entry[0]);
  const hasWrongCode = discoveredCodes.some((code) => code !== builderCode);
  const hasAttributionHelper = attributionHelperRegex.test(source);
  const hasAcceptableAttribution =
    hasExpectedCode ||
    hasExpectedSuffix ||
    (!profileConfig.requireExpectedCode && hasAttributionHelper);

  if (hasWrongCode && !hasExpectedCode && !hasExpectedSuffix) {
    return {
      ok: !profileConfig.failOnMissing,
      candidateFiles: 1,
      findings: [
        {
          line: match.line,
          family: match.pattern.family,
          marker: match.pattern.marker,
          reason: "wrong-builder-code",
        },
      ],
    };
  }

  if (!hasAcceptableAttribution) {
    return {
      ok: !profileConfig.failOnMissing,
      candidateFiles: 1,
      findings: [
        {
          line: match.line,
          family: match.pattern.family,
          marker: match.pattern.marker,
          reason: "missing-attribution",
        },
      ],
    };
  }

  return {
    ok: true,
    candidateFiles: 1,
    findings: [],
  };
}

function findTransactionMatch(source: string):
  | {
      pattern: TransactionPattern;
      line: number;
    }
  | undefined {
  for (const pattern of transactionPatterns) {
    const match = source.match(pattern.regex);

    if (!match || match.index === undefined) {
      continue;
    }

    return {
      pattern: resolvePattern(source, pattern),
      line: lineNumberAtIndex(source, match.index),
    };
  }

  return undefined;
}

function resolvePattern(source: string, pattern: TransactionPattern): TransactionPattern {
  if (pattern.marker === "sendTransaction" && ethersSourceRegex.test(source)) {
    return {
      ...pattern,
      family: "ethers",
    };
  }

  return pattern;
}

function lineNumberAtIndex(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function stringToHex(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createActionYaml(builderCode: string, profile: Profile): string {
  return `name: Validate Attribution

on:
  pull_request:

jobs:
  attribution:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: horn111/base-attribution-os/packages/github-action@v0
        with:
          builder-code: ${builderCode || "bc_abc123"}
          paths: "src,app,packages"
          profile: "${profile}"`;
}
