"use client";

import { useMemo, useState, type ChangeEvent } from "react";

type DemoMode = "scanner" | "migration";
type Profile = "local" | "ci" | "strict";
type Family = "agent" | "ethers" | "viem" | "wagmi" | "wallet";
type Reason = "missing-attribution" | "wrong-builder-code";
type ProjectType = "app" | "game";
type BackendTarget = "custom" | "nakama" | "next" | "supabase";
type MonetizationUnit = "credits" | "entitlement" | "tickets";

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

interface Option<T extends string> {
  value: T;
  label: string;
  note: string;
}

interface MigrationPlan {
  title: string;
  flow: string[];
  verification: string[];
  attributionStep: string;
  adapterPath: string;
  catalog: {
    packageId: string;
    projectType: ProjectType;
    backend: BackendTarget;
    unit: MonetizationUnit;
    amount: number;
    priceUsd: string;
    builderCode: string;
    fulfillment: string;
  };
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

const projectTypeOptions: Option<ProjectType>[] = [
  {
    value: "app",
    label: "App",
    note: "credits, paid features, exports",
  },
  {
    value: "game",
    label: "Game",
    note: "tickets, continues, boosts",
  },
];

const backendOptions: Option<BackendTarget>[] = [
  {
    value: "nakama",
    label: "Nakama",
    note: "game backend adapter",
  },
  {
    value: "next",
    label: "Next.js",
    note: "route handlers",
  },
  {
    value: "supabase",
    label: "Supabase",
    note: "SQL + edge functions",
  },
  {
    value: "custom",
    label: "Custom API",
    note: "Express, Hono, or any backend",
  },
];

const unitOptions: Option<MonetizationUnit>[] = [
  {
    value: "credits",
    label: "Credits",
    note: "usage packs",
  },
  {
    value: "tickets",
    label: "Tickets",
    note: "game actions",
  },
  {
    value: "entitlement",
    label: "Entitlement",
    note: "premium unlock",
  },
];

const builderCodeRegex = /\bbc_[A-Za-z0-9._:-]+\b/g;
const attributionHelperRegex =
  /\b(?:appendDataSuffix|attributeSendCalls|builderCodeDataSuffix|createAttributionSigner|createDataSuffix|dataSuffix|ethersBuilderCodeDataSuffix|useAttributionSuffix|withAttributionSuffix|withEthersAttribution|withViemDataSuffix)\b/;
const ethersSourceRegex =
  /\bfrom\s+["'`]ethers["'`]|\bimport\s+["'`]ethers["'`]|\b(?:BrowserProvider|ContractRunner|JsonRpcSigner|new\s+Wallet)\b/;

export default function Page() {
  const [mode, setMode] = useState<DemoMode>("scanner");
  const [builderCode, setBuilderCode] = useState("bc_abc123");
  const [profile, setProfile] = useState<Profile>("ci");
  const [activeExample, setActiveExample] = useState(examples[0]);
  const [source, setSource] = useState(examples[0].source);
  const [projectType, setProjectType] = useState<ProjectType>("app");
  const [backend, setBackend] = useState<BackendTarget>("next");
  const [unit, setUnit] = useState<MonetizationUnit>("credits");
  const [packageName, setPackageName] = useState("starter_credits_100");
  const [packagePrice, setPackagePrice] = useState("0.99");
  const [copied, setCopied] = useState<string | undefined>();

  const result = useMemo(
    () => scanSource(source, builderCode.trim(), profile),
    [builderCode, profile, source],
  );
  const actionYaml = useMemo(
    () => createActionYaml(builderCode.trim(), profile),
    [builderCode, profile],
  );
  const migrationPlan = useMemo(
    () =>
      createMigrationPlan({
        backend,
        builderCode: builderCode.trim() || "bc_abc123",
        packageName: packageName.trim() || defaultPackageName(unit),
        packagePrice: packagePrice.trim() || "0.99",
        projectType,
        unit,
      }),
    [backend, builderCode, packageName, packagePrice, projectType, unit],
  );
  const statusLabel = result.ok ? "passing" : "failing";
  const statusTone = result.ok ? "good" : "bad";
  const catalogJson = JSON.stringify(migrationPlan.catalog, null, 2);
  const introTitle = mode === "scanner" ? "Builder Codes in CI" : "App & game migration";
  const introCopy =
    mode === "scanner"
      ? "Try attribution checks across ethers, viem, wagmi, wallet batches, and agent transaction tools."
      : "Plan Base Pay purchases, internal credits or tickets, server verification, and Builder Code attribution.";

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
          <p className="eyebrow">Live OSS demo</p>
          <h1>{introTitle}</h1>
        </div>
        <div className="intro-actions">
          <div className="mode-tabs" role="tablist" aria-label="Demo mode">
            <button
              aria-selected={mode === "scanner"}
              className={mode === "scanner" ? "is-active" : undefined}
              role="tab"
              type="button"
              onClick={() => setMode("scanner")}
            >
              Scanner
            </button>
            <button
              aria-selected={mode === "migration"}
              className={mode === "migration" ? "is-active" : undefined}
              role="tab"
              type="button"
              onClick={() => setMode("migration")}
            >
              Migration
            </button>
          </div>
          <p className="lede">{introCopy}</p>
        </div>
      </section>

      {mode === "scanner" ? (
        <>
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
                <button
                  className="copy-button"
                  type="button"
                  onClick={() => copyText("code", source)}
                >
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
        </>
      ) : (
        <>
          <section className="migration-grid" aria-label="Base migration planner demo">
            <aside className="panel control-panel migration-controls">
              <div className="panel-heading">
                <p className="panel-kicker">Inputs</p>
                <h2>Migration setup</h2>
              </div>

              <label className="field">
                <span>Builder Code</span>
                <input value={builderCode} onChange={handleBuilderCode} spellCheck={false} />
              </label>

              <div className="field">
                <span>Project</span>
                <div className="option-grid">
                  {projectTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      className={option.value === projectType ? "is-active" : undefined}
                      type="button"
                      onClick={() => setProjectType(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.note}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span>Backend</span>
                <div className="option-grid">
                  {backendOptions.map((option) => (
                    <button
                      key={option.value}
                      className={option.value === backend ? "is-active" : undefined}
                      type="button"
                      onClick={() => setBackend(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.note}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span>Unit</span>
                <div className="option-grid compact-options">
                  {unitOptions.map((option) => (
                    <button
                      key={option.value}
                      className={option.value === unit ? "is-active" : undefined}
                      type="button"
                      onClick={() => {
                        setUnit(option.value);
                        setPackageName(defaultPackageName(option.value));
                      }}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.note}</small>
                    </button>
                  ))}
                </div>
              </div>

              <label className="field">
                <span>Starter package</span>
                <input
                  value={packageName}
                  onChange={(event) => setPackageName(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Price, USDC</span>
                <input
                  inputMode="decimal"
                  value={packagePrice}
                  onChange={(event) => setPackagePrice(event.target.value)}
                />
              </label>
            </aside>

            <section className="panel flow-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Generated flow</p>
                  <h2>{migrationPlan.title}</h2>
                </div>
              </div>

              <ol className="flow-list">
                {migrationPlan.flow.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <article className="attribution-card">
                <p className="panel-kicker">Builder Code attribution</p>
                <strong>{migrationPlan.attributionStep}</strong>
              </article>

              <article className="attribution-card">
                <p className="panel-kicker">Adapter path</p>
                <strong>{migrationPlan.adapterPath}</strong>
              </article>
            </section>

            <section className="panel result-panel">
              <div className="panel-heading">
                <p className="panel-kicker">Server checklist</p>
                <h2>
                  <span className="status-dot good" aria-hidden="true" />
                  replay-safe plan
                </h2>
              </div>

              <div className="check-list">
                {migrationPlan.verification.map((item) => (
                  <article key={item}>
                    <span aria-hidden="true">OK</span>
                    <p>{item}</p>
                  </article>
                ))}
              </div>

              <a className="repo-cta" href="https://github.com/horn111/base-attribution-os">
                Star the repo if this should become an installable SDK
              </a>
            </section>
          </section>

          <section className="action-panel migration-output">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Catalog preview</p>
                <h2>package-catalog.json</h2>
              </div>
              <button
                className="copy-button"
                type="button"
                onClick={() => copyText("catalog", catalogJson)}
              >
                {copied === "catalog" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre>
              <code>{catalogJson}</code>
            </pre>
          </section>
        </>
      )}
    </main>
  );
}

function createMigrationPlan(input: {
  backend: BackendTarget;
  builderCode: string;
  packageName: string;
  packagePrice: string;
  projectType: ProjectType;
  unit: MonetizationUnit;
}): MigrationPlan {
  const amount = defaultUnitAmount(input.unit);
  const projectLabel = input.projectType === "game" ? "game" : "app";
  const unitLabel = unitCopy(input.unit);
  const backendName = backendLabel(input.backend);

  return {
    title: `${backendName} ${projectLabel} with ${unitLabel}`,
    flow: [
      `Define ${input.packageName} as a Base Pay USDC purchase.`,
      `Send the payment with Builder Code ${input.builderCode} attached as the data suffix.`,
      "Verify payment status on the server before fulfillment.",
      `Credit ${amount} ${unitLabel} to the user's internal balance or entitlement ledger.`,
      "Let the product consume the internal balance offchain with fast UX.",
      "Keep the onchain payment visible for attribution, analytics, and future CI checks.",
    ],
    verification: [
      "Require completed Base Pay status from getPaymentStatus.",
      "Check sender, recipient, amount, currency, and order id.",
      "Store a unique payment id before issuing value.",
      "Make fulfillment idempotent for retries and webhooks.",
      "Record every credit, ticket, or entitlement change in an internal ledger.",
      "Keep internal balances non-transferable and non-withdrawable by default.",
    ],
    attributionStep: `The onchain purchase carries ${input.builderCode}; internal ${unitLabel} spends stay offchain.`,
    adapterPath: adapterPath(input.backend, input.projectType),
    catalog: {
      packageId: input.packageName,
      projectType: input.projectType,
      backend: input.backend,
      unit: input.unit,
      amount,
      priceUsd: input.packagePrice,
      builderCode: input.builderCode,
      fulfillment: fulfillmentCopy(input.unit),
    },
  };
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
      - uses: horn111/base-attribution-os/packages/github-action@v0
        with:
          builder-code: ${builderCode || "bc_abc123"}
          paths: "src,app,packages"
          profile: "${profile}"`;
}

function backendLabel(backend: BackendTarget): string {
  const labels: Record<BackendTarget, string> = {
    custom: "Custom API",
    nakama: "Nakama",
    next: "Next.js",
    supabase: "Supabase",
  };

  return labels[backend];
}

function defaultPackageName(unit: MonetizationUnit): string {
  const names: Record<MonetizationUnit, string> = {
    credits: "starter_credits_100",
    entitlement: "premium_unlock",
    tickets: "starter_tickets_20",
  };

  return names[unit];
}

function defaultUnitAmount(unit: MonetizationUnit): number {
  const amounts: Record<MonetizationUnit, number> = {
    credits: 100,
    entitlement: 1,
    tickets: 20,
  };

  return amounts[unit];
}

function unitCopy(unit: MonetizationUnit): string {
  const labels: Record<MonetizationUnit, string> = {
    credits: "credits",
    entitlement: "entitlements",
    tickets: "tickets",
  };

  return labels[unit];
}

function fulfillmentCopy(unit: MonetizationUnit): string {
  const labels: Record<MonetizationUnit, string> = {
    credits: "credit_balance",
    entitlement: "account_unlock",
    tickets: "ticket_balance",
  };

  return labels[unit];
}

function adapterPath(backend: BackendTarget, projectType: ProjectType): string {
  if (backend === "nakama") {
    return "First adapter target: Nakama RPCs for order creation, verification, balance reads, and spends.";
  }

  if (backend === "supabase") {
    return "Future app adapter: Supabase SQL tables, unique payment constraints, and edge functions.";
  }

  if (backend === "next") {
    return "Future app adapter: Next.js route handlers around payments-core and entitlements-core.";
  }

  return projectType === "game"
    ? "Custom game backend path: call shared core from your authoritative server."
    : "Custom app backend path: call shared core from Express, Hono, or your existing API.";
}
