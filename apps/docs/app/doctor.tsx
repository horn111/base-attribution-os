"use client";

import { useMemo, useState, type ChangeEvent } from "react";

type Profile = "local" | "ci" | "strict";
type Variant = "broken" | "fixed";
type Family = "agent" | "privy" | "rpc" | "wagmi" | "wallet" | "x402";
type Status = "protected" | "missing" | "wrong-code" | "unresolved";

interface AuditPath {
  line: number;
  family: Family;
  marker: string;
  status: Status;
  ruleId?: string;
  suggestion?: string;
}

interface AuditResult {
  ok: boolean;
  coverage: number;
  protected: number;
  paths: AuditPath[];
}

interface Example {
  id: string;
  label: string;
  file: string;
  family: Family;
  broken: string;
  fixed: string;
}

const profiles: Record<Profile, { intent: string; unresolvedFails: boolean }> = {
  local: { intent: "report without blocking", unresolvedFails: false },
  ci: { intent: "block missing attribution", unresolvedFails: false },
  strict: { intent: "require verifiable code", unresolvedFails: true },
};

const examples: Example[] = [
  {
    id: "wagmi",
    label: "Wagmi app",
    file: "app/send-button.tsx",
    family: "wagmi",
    broken: `import { useSendTransaction } from "wagmi";

export function SendButton() {
  const { sendTransaction } = useSendTransaction();
  return <button onClick={() => sendTransaction({ to, data: "0x" })}>Send</button>;
}`,
    fixed: `import { useSendTransaction } from "wagmi";
import { useAttributionSuffix } from "@base-attribution-os/wagmi";

export function SendButton() {
  const { sendTransaction } = useSendTransaction();
  const dataSuffix = useAttributionSuffix("bc_abc123");
  return <button onClick={() => sendTransaction({ to, data: "0x", dataSuffix })}>Send</button>;
}`,
  },
  {
    id: "privy",
    label: "Privy wallet",
    file: "src/privy-send.ts",
    family: "privy",
    broken: `import { usePrivy } from "@privy-io/react-auth";

export async function send(wallet) {
  return wallet.sendTransaction({ to, data: "0x" });
}`,
    fixed: `import { dataSuffix } from "@privy-io/react-auth";
import { createDataSuffix } from "@base-attribution-os/core";

export const config = {
  plugins: [dataSuffix(createDataSuffix({ codes: ["bc_abc123"] }))],
};

export async function send(wallet) {
  return wallet.sendTransaction({ to, data: "0x" });
}`,
  },
  {
    id: "smart-wallet",
    label: "Smart wallet",
    file: "src/send-calls.ts",
    family: "wallet",
    broken: `export async function batch(wallet) {
  return wallet.sendCalls({ calls: [{ to, data: "0x" }] });
}`,
    fixed: `import { sendAttributedCalls } from "@base-attribution-os/wallet";

export async function batch(provider, account) {
  return sendAttributedCalls(provider, {
    chainId: "0x2105",
    from: account,
    calls: [{ to, data: "0x" }],
  }, {
    codes: ["bc_abc123"],
  });
}`,
  },
  {
    id: "raw-rpc",
    label: "Raw RPC",
    file: "src/legacy-send.ts",
    family: "rpc",
    broken: `await window.ethereum.request({
  method: "eth_sendTransaction",
  params: [{ from, to, data: "0x" }],
});`,
    fixed: `import { appendDataSuffix } from "@base-attribution-os/core";

await window.ethereum.request({
  method: "eth_sendTransaction",
  params: [{ from, to, data: appendDataSuffix("0x", { codes: ["bc_abc123"] }) }],
});`,
  },
  {
    id: "x402",
    label: "x402 buyer",
    file: "src/paid-fetch.ts",
    family: "x402",
    broken: `import { x402Client } from "@x402/fetch";

export const client = new x402Client();`,
    fixed: `import { x402Client } from "@x402/fetch";
import { BuilderCodeClientExtension } from "@x402/extensions/builder-code";

export const client = new x402Client();
client.registerExtension(new BuilderCodeClientExtension("bc_abc123"));`,
  },
  {
    id: "agent",
    label: "Agent tool",
    file: "src/agent-tool.ts",
    family: "agent",
    broken: `export const transactionTool = {
  execute: async ({ wallet, transaction }) => wallet.sendTransaction(transaction),
};`,
    fixed: `import { withViemDataSuffix } from "@base-attribution-os/viem";

export const transactionTool = {
  execute: async ({ wallet, transaction }) =>
    wallet.sendTransaction(withViemDataSuffix(transaction, "bc_abc123")),
};`,
  },
];

export default function DoctorPage() {
  const [builderCode, setBuilderCode] = useState("bc_abc123");
  const [profile, setProfile] = useState<Profile>("ci");
  const [variant, setVariant] = useState<Variant>("broken");
  const [activeExample, setActiveExample] = useState(examples[0]);
  const [source, setSource] = useState(examples[0].broken);
  const [copied, setCopied] = useState<string>();
  const result = useMemo(
    () => auditSource(source, activeExample.family, builderCode.trim(), profile),
    [activeExample.family, builderCode, profile, source],
  );
  const actionYaml = useMemo(
    () => createActionYaml(builderCode.trim(), profile),
    [builderCode, profile],
  );
  const lineNumbers = source.split(/\r?\n/).map((_, index) => index + 1);

  function selectExample(example: Example): void {
    setActiveExample(example);
    setVariant("broken");
    setSource(example.broken);
  }

  function selectVariant(next: Variant): void {
    setVariant(next);
    setSource(activeExample[next]);
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
          <img
            alt=""
            aria-hidden="true"
            className="brand-wordmark"
            height="65"
            src="/bao-wordmark.png"
            width="172"
          />
          <span>Base Attribution OS</span>
        </a>
        <a className="star-button" href="https://github.com/horn111/base-attribution-os">
          <StarIcon />
          <span>Star repo</span>
        </a>
      </header>

      <section className="hero">
        <div className="hero-meta">
          <p className="eyebrow">Update 6 · Live OSS Utility</p>
          <h1>Attribution Doctor</h1>
        </div>
        <div className="hero-controls">
          <p className="lede">
            Audit transaction paths across Base apps, wallets, x402 routes, and agents before they
            reach production.
          </p>
          <code className="hero-command">bao doctor --changed-since origin/main</code>
        </div>
      </section>

      <section className="coverage-strip" aria-label="Attribution coverage">
        <div>
          <p className="card-kicker">Attribution coverage</p>
          <p className="coverage-value">
            {result.protected}/{result.paths.length} paths protected
          </p>
        </div>
        <div className="coverage-track" aria-hidden="true">
          <span style={{ width: `${result.coverage}%` }} />
        </div>
        <strong>{result.coverage}%</strong>
      </section>

      <div className="bento-grid doctor-grid">
        <aside className="bento-card input-card">
          <div className="card-header">
            <p className="card-kicker">Audit setup</p>
            <h2>Project fixture</h2>
          </div>
          <div className="form-stack">
            <label className="form-group">
              <span className="form-label">Builder Code</span>
              <input
                className="text-input"
                spellCheck={false}
                value={builderCode}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setBuilderCode(event.target.value)
                }
              />
            </label>
            <SegmentedControl
              label="Profile"
              options={Object.keys(profiles) as Profile[]}
              value={profile}
              onChange={setProfile}
            />
            <p className="field-hint">{profiles[profile].intent}</p>
            <SegmentedControl
              label="State"
              options={["broken", "fixed"]}
              value={variant}
              onChange={selectVariant}
            />
            <div className="form-group">
              <span className="form-label">Fixture</span>
              <div className="option-list">
                {examples.map((example) => (
                  <button
                    key={example.id}
                    className={`option-item ${example.id === activeExample.id ? "active" : ""}`}
                    type="button"
                    onClick={() => selectExample(example)}
                  >
                    <span className="option-item-name">{example.label}</span>
                    <span className="finding-family">{example.family}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
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
              onChange={(event) => setSource(event.target.value)}
            />
          </div>
        </section>

        <AuditResultPanel profile={profile} result={result} />
      </div>

      <section className="bento-card output-card">
        <div className="output-header">
          <div className="editor-header-title">
            <p className="card-kicker">Changed-only CI</p>
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

function SegmentedControl<T extends string>(props: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="form-group">
      <span className="form-label">{props.label}</span>
      <div
        className={`segmented-control segments-${props.options.length}`}
        role="group"
        aria-label={props.label}
      >
        {props.options.map((option) => (
          <button
            key={option}
            className={`segment-button ${props.value === option ? "active" : ""}`}
            type="button"
            onClick={() => props.onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function AuditResultPanel(props: { profile: Profile; result: AuditResult }) {
  return (
    <section className="bento-card result-panel">
      <div className="card-header result-heading">
        <div>
          <p className="card-kicker">Doctor report</p>
          <h2>{props.result.ok ? "Ready for CI" : "Action required"}</h2>
        </div>
        <div className={`status-badge ${props.result.ok ? "passing" : "failing"}`}>
          <span className="status-dot" />
          <span>{props.result.ok ? "passing" : "failing"}</span>
        </div>
      </div>
      <div className="metrics-row doctor-metrics">
        <Metric label="profile" value={props.profile} />
        <Metric label="paths" value={props.result.paths.length} />
        <Metric label="protected" value={props.result.protected} />
        <Metric label="coverage" value={`${props.result.coverage}%`} />
      </div>
      <div className="analysis-block">
        <p className="findings-title">Transaction paths</p>
        <div className="findings-container">
          {props.result.paths.map((entry) => (
            <article
              className={`finding-card path-${entry.status}`}
              key={`${entry.marker}-${entry.line}`}
            >
              <div className="finding-info">
                <span className="finding-reason">
                  {entry.ruleId ? `${entry.ruleId} · ` : ""}
                  {entry.status}
                </span>
                <span className="finding-meta">
                  line {entry.line} near {entry.marker}
                </span>
                {entry.suggestion ? (
                  <span className="finding-suggestion">{entry.suggestion}</span>
                ) : null}
              </div>
              <span className="finding-family">{entry.family}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric(props: { label: string; value: number | string }) {
  return (
    <div className="metric-item">
      <p className="metric-label">{props.label}</p>
      <p className="metric-value">{props.value}</p>
    </div>
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

function auditSource(
  source: string,
  family: Family,
  builderCode: string,
  profile: Profile,
): AuditResult {
  const candidates = findCandidates(source, family);
  const discoveredCodes: string[] = source.match(/\bbc_[A-Za-z0-9._:-]+\b/g) ?? [];
  const hasExpectedCode = builderCode.length > 0 && discoveredCodes.includes(builderCode);
  const wrongCode = discoveredCodes.find((code) => code !== builderCode);
  const helper = attributionEvidence(source, family);
  const paths = candidates.map((candidate): AuditPath => {
    if (wrongCode && !hasExpectedCode)
      return {
        ...candidate,
        status: "wrong-code",
        ruleId: "BAO002",
        suggestion: "Use the configured Builder Code.",
      };
    if (helper && hasExpectedCode) return { ...candidate, status: "protected" };
    if (helper)
      return {
        ...candidate,
        status: "unresolved",
        ruleId: "BAO003",
        suggestion: "Expose the Builder Code to strict CI.",
      };
    if (family === "wallet")
      return {
        ...candidate,
        status: "missing",
        ruleId: "BAO005",
        suggestion: "Use capability-aware Smart Wallet Attribution Kit middleware.",
      };
    if (family === "x402")
      return {
        ...candidate,
        status: "missing",
        ruleId: "BAO006",
        suggestion: "Register the official Builder Code extension.",
      };
    return {
      ...candidate,
      status: "missing",
      ruleId: "BAO001",
      suggestion: "Add dataSuffix or a BAO helper.",
    };
  });
  const protectedCount = paths.filter((entry) => entry.status === "protected").length;
  const failures = paths.filter(
    (entry) =>
      entry.status === "missing" ||
      entry.status === "wrong-code" ||
      (entry.status === "unresolved" && profiles[profile].unresolvedFails),
  );
  return {
    ok: profile === "local" || failures.length === 0,
    coverage: paths.length === 0 ? 100 : Math.round((protectedCount / paths.length) * 100),
    protected: protectedCount,
    paths,
  };
}

function findCandidates(source: string, family: Family): Omit<AuditPath, "status">[] {
  const patterns =
    family === "x402"
      ? [{ marker: "x402Client", regex: /\bnew\s+x402Client\s*\(/g }]
      : family === "wallet"
        ? [
            { marker: "sendCalls", regex: /\bsendCalls\s*\(/g },
            { marker: "sendAttributedCalls", regex: /\bsendAttributedCalls\s*\(/g },
          ]
        : family === "rpc"
          ? [{ marker: "eth_sendTransaction", regex: /["']eth_sendTransaction["']/g }]
          : [
              { marker: "sendTransaction", regex: /\bsendTransaction\s*\(/g },
              { marker: "writeContract", regex: /\bwriteContract\s*\(/g },
            ];
  return patterns.flatMap(({ marker, regex }) =>
    Array.from(source.matchAll(regex), (match) => ({
      family,
      marker,
      line: lineNumberAtIndex(source, match.index ?? 0),
    })),
  );
}

function attributionEvidence(source: string, family: Family): boolean {
  if (family === "x402") return /\bBuilderCodeClientExtension\b/.test(source);
  if (family === "wallet")
    return /\b(?:createAttributionProvider|sendAttributedCalls|withUserOperationAttribution)\b/.test(
      source,
    );
  if (family === "rpc") return /\b(?:appendDataSuffix|DATA_SUFFIX|dataSuffix)\b/.test(source);
  return /\b(?:appendDataSuffix|createDataSuffix|dataSuffix|useAttributionSuffix|withViemDataSuffix)\b/.test(
    source,
  );
}

function lineNumberAtIndex(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function createActionYaml(builderCode: string, profile: Profile): string {
  return `name: Attribution Doctor

on:
  pull_request:

jobs:
  attribution:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: horn111/base-attribution-os/packages/github-action@main
        with:
          builder-code: ${builderCode || "bc_abc123"}
          profile: ${profile}
          changed-only: true
          sarif-output: bao.sarif`;
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
