"use client";

import { useMemo, useState, type ChangeEvent } from "react";

type Profile = "local" | "ci" | "strict";
type Family = "agent" | "ethers" | "viem" | "wagmi" | "wallet" | "x402";
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
  {
    id: "x402-client",
    label: "x402 client",
    file: "src/paid-fetch.ts",
    source: `import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));

export const fetchWithPayment = wrapFetchWithPayment(fetch, client);
`,
  },
  {
    id: "x402-seller",
    label: "x402 seller",
    file: "src/paid-route.ts",
    source: `import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { BUILDER_CODE, declareBuilderCodeExtension } from "@x402/extensions/builder-code";

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            price: "$0.001",
            payTo,
          },
        ],
        extensions: {
          [BUILDER_CODE]: declareBuilderCodeExtension("bc_abc123"),
        },
      },
    },
    new x402ResourceServer(facilitatorClient).register("eip155:8453", new ExactEvmScheme()),
  ),
);
`,
  },
];

const transactionPatterns: TransactionPattern[] = [
  {
    marker: "BuilderCodeClientExtension",
    family: "x402",
    regex: /\bBuilderCodeClientExtension\b/,
  },
  {
    marker: "declareBuilderCodeExtension",
    family: "x402",
    regex: /\bdeclareBuilderCodeExtension\b/,
  },
  {
    marker: "x402Client",
    family: "x402",
    regex: /\bx402Client\s*\(/,
  },
  {
    marker: "wrapFetchWithPayment",
    family: "x402",
    regex: /\bwrapFetchWithPayment\s*\(/,
  },
  {
    marker: "registerExtension",
    family: "x402",
    regex: /\bregisterExtension\s*\(/,
  },
  {
    marker: "paymentMiddleware",
    family: "x402",
    regex: /\bpaymentMiddleware\s*\(/,
  },
  {
    marker: "x402ResourceServer",
    family: "x402",
    regex: /\bx402ResourceServer\b/,
  },
  {
    marker: "BUILDER_CODE",
    family: "x402",
    regex:
      /(?:@x402\/extensions\/builder-code[\s\S]*\bBUILDER_CODE\b|\bBUILDER_CODE\b[\s\S]*@x402\/extensions\/builder-code)/,
  },
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
  /\b(?:appendDataSuffix|attributeSendCalls|BuilderCodeClientExtension|builderCodeDataSuffix|createAttributionSigner|createDataSuffix|dataSuffix|declareBuilderCodeExtension|ethersBuilderCodeDataSuffix|parseBuilderCodeSuffixFromCalldata|useAttributionSuffix|withAttributionSuffix|withEthersAttribution|withViemDataSuffix)\b/;
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
  const introTitle = "Builder Codes in CI";
  const introCopy =
    "Try attribution checks across x402, ethers, viem, wagmi, wallet batches, and agent transaction tools.";
  const lineNumbers = source.split(/\r?\n/).map((_, index) => index + 1);

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
    <main className="app-container">
      <header className="topbar">
        <a className="brand" href="https://github.com/horn111/base-attribution-os">
          <span className="brand-mark" aria-hidden="true">
            BAO
          </span>
          <span>Base Attribution OS</span>
        </a>
        <nav className="nav-links" aria-label="Project links">
          <a className="star-button" href="https://github.com/horn111/base-attribution-os">
            <StarIcon />
            <span>Star repo</span>
          </a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-meta">
          <p className="eyebrow">Live OSS Utility</p>
          <h1>{introTitle}</h1>
        </div>
        <div className="hero-controls">
          <p className="lede">{introCopy}</p>
        </div>
      </section>

      <div className="bento-grid">
        <aside className="bento-card input-card">
          <ScannerInputs
            activeExample={activeExample}
            builderCode={builderCode}
            copied={copied}
            profile={profile}
            onBuilderCodeChange={handleBuilderCode}
            onExampleSelect={selectExample}
            onProfileChange={setProfile}
          />
        </aside>

        <section className="bento-card editor-card">
          <div className="editor-header">
            <div className="editor-header-title">
              <p className="card-kicker">Candidate file</p>
              <h2>{activeExample.file}</h2>
            </div>
            <CopyButton copied={copied === "code"} onClick={() => copyText("code", source)} />
          </div>
          <div className="editor-container">
            <div className="line-numbers" aria-hidden="true">
              {lineNumbers.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
            <textarea
              aria-label="Transaction source"
              className="code-textarea"
              spellCheck={false}
              value={source}
              onChange={handleSource}
            />
          </div>
        </section>

        <ScannerResultPanel profile={profile} result={result} />
      </div>

      <section className="bento-card output-card">
        <div className="output-header">
          <div className="editor-header-title">
            <p className="card-kicker">GitHub Action</p>
            <h2>validate-attribution.yml</h2>
          </div>
          <CopyButton copied={copied === "action"} onClick={() => copyText("action", actionYaml)} />
        </div>
        <div className="output-code-container">
          <pre>
            <code>{actionYaml}</code>
          </pre>
        </div>
      </section>
    </main>
  );
}

function ScannerInputs(props: {
  activeExample: Example;
  builderCode: string;
  copied: string | undefined;
  profile: Profile;
  onBuilderCodeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onExampleSelect: (example: Example) => void;
  onProfileChange: (profile: Profile) => void;
}) {
  return (
    <>
      <div className="card-header">
        <p className="card-kicker">Inputs</p>
        <h2>Scan setup</h2>
      </div>

      <div className="form-stack">
        <label className="form-group">
          <span className="form-label">Builder Code</span>
          <input
            className="text-input"
            spellCheck={false}
            value={props.builderCode}
            onChange={props.onBuilderCodeChange}
          />
        </label>

        <div className="form-group">
          <span className="form-label">Profile</span>
          <div className="segmented-control" role="group" aria-label="Scanner profile">
            {(Object.keys(profiles) as Profile[]).map((entry) => (
              <button
                key={entry}
                className={`segment-button ${entry === props.profile ? "active" : ""}`}
                type="button"
                onClick={() => props.onProfileChange(entry)}
              >
                {entry}
              </button>
            ))}
          </div>
          <p className="field-hint">{profiles[props.profile].intent}</p>
        </div>

        <div className="form-group">
          <span className="form-label">Example</span>
          <div className="option-list" role="list">
            {examples.map((example) => (
              <button
                key={example.id}
                className={`option-item ${example.id === props.activeExample.id ? "active" : ""}`}
                type="button"
                onClick={() => props.onExampleSelect(example)}
              >
                <span className="option-item-name">{example.label}</span>
                <span className="option-item-meta">{example.file}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ScannerResultPanel(props: { profile: Profile; result: ScanResult }) {
  const status = props.result.ok ? "passing" : "failing";

  return (
    <section className="bento-card result-panel">
      <div className="card-header">
        <p className="card-kicker">Result</p>
        <div className={`status-badge ${status}`}>
          <span className="status-dot" />
          <span>{status}</span>
        </div>
      </div>

      <div className="metrics-row">
        <div className="metric-item">
          <p className="metric-label">profile</p>
          <p className="metric-value">{props.profile}</p>
        </div>
        <div className="metric-item">
          <p className="metric-label">candidates</p>
          <p className="metric-value">{props.result.candidateFiles}</p>
        </div>
        <div className="metric-item">
          <p className="metric-label">findings</p>
          <p className="metric-value">{props.result.findings.length}</p>
        </div>
      </div>

      <div className="analysis-block">
        <p className="findings-title">Analysis details</p>
        <div className="findings-container">
          {props.result.findings.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-title">No findings</span>
              <span className="empty-state-desc">
                Attribution checks confirm valid implementation.
              </span>
            </div>
          ) : (
            props.result.findings.map((finding) => (
              <article className="finding-card" key={`${finding.marker}-${finding.line}`}>
                <div className="finding-info">
                  <span className="finding-reason">{finding.reason}</span>
                  <span className="finding-meta">
                    line {finding.line} near {finding.marker}
                  </span>
                </div>
                <span className="finding-family">{finding.family}</span>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function CopyButton(props: { copied: boolean; onClick: () => void }) {
  return (
    <button className="copy-btn" type="button" onClick={props.onClick}>
      <CopyIcon />
      <span>{props.copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" height="14" viewBox="0 0 24 24" width="14">
      <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" height="12" viewBox="0 0 24 24" width="12">
      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192z" />
    </svg>
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
  const hasExpectedSuffix = source.toLowerCase().includes(stringToHex(builderCode).toLowerCase());
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
      - uses: horn111/base-attribution-os/packages/github-action@main
        with:
          builder-code: ${builderCode || "bc_abc123"}
          paths: "src,app,packages"
          profile: "${profile}"`;
}
