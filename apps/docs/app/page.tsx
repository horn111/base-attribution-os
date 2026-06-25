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

  const catalogJson = JSON.stringify(migrationPlan.catalog, null, 2);
  const introTitle = mode === "scanner" ? "Builder Codes in CI" : "App & game migration";
  const introCopy =
    mode === "scanner"
      ? "Try attribution checks across ethers, viem, wagmi, wallet batches, and agent transaction tools."
      : "Plan Base Pay purchases, internal credits or tickets, server verification, and Builder Code attribution.";
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
          <div className="mode-tabs" role="tablist" aria-label="Demo mode">
            <button
              aria-selected={mode === "scanner"}
              className={`tab-button ${mode === "scanner" ? "active" : ""}`}
              role="tab"
              type="button"
              onClick={() => setMode("scanner")}
            >
              Scanner
            </button>
            <button
              aria-selected={mode === "migration"}
              className={`tab-button ${mode === "migration" ? "active" : ""}`}
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

      <div className="bento-grid">
        <aside className="bento-card input-card">
          {mode === "scanner" ? (
            <ScannerInputs
              activeExample={activeExample}
              builderCode={builderCode}
              copied={copied}
              profile={profile}
              onBuilderCodeChange={handleBuilderCode}
              onExampleSelect={selectExample}
              onProfileChange={setProfile}
            />
          ) : (
            <MigrationInputs
              backend={backend}
              builderCode={builderCode}
              packageName={packageName}
              packagePrice={packagePrice}
              projectType={projectType}
              unit={unit}
              onBackendChange={setBackend}
              onBuilderCodeChange={handleBuilderCode}
              onPackageNameChange={setPackageName}
              onPackagePriceChange={setPackagePrice}
              onProjectTypeChange={setProjectType}
              onUnitChange={(nextUnit) => {
                setUnit(nextUnit);
                setPackageName(defaultPackageName(nextUnit));
              }}
            />
          )}
        </aside>

        {mode === "scanner" ? (
          <>
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
          </>
        ) : (
          <>
            <section className="bento-card flow-card">
              <div className="card-header">
                <p className="card-kicker">Generated flow</p>
                <h2>{migrationPlan.title}</h2>
              </div>
              <div className="flow-steps">
                {migrationPlan.flow.map((step, index) => (
                  <div className="flow-step-item" key={step}>
                    <span className="flow-step-num">{index + 1}</span>
                    <p className="flow-step-content">{step}</p>
                  </div>
                ))}
              </div>
              <div className="migration-card">
                <p className="migration-card-label">Builder Code attribution</p>
                <strong className="migration-card-value">{migrationPlan.attributionStep}</strong>
              </div>
              <div className="migration-card">
                <p className="migration-card-label">Adapter path</p>
                <strong className="migration-card-value">{migrationPlan.adapterPath}</strong>
              </div>
            </section>

            <MigrationChecklist items={migrationPlan.verification} />
          </>
        )}
      </div>

      {mode === "scanner" ? (
        <section className="bento-card output-card">
          <div className="output-header">
            <div className="editor-header-title">
              <p className="card-kicker">GitHub Action</p>
              <h2>validate-attribution.yml</h2>
            </div>
            <CopyButton
              copied={copied === "action"}
              onClick={() => copyText("action", actionYaml)}
            />
          </div>
          <div className="output-code-container">
            <pre>
              <code>{actionYaml}</code>
            </pre>
          </div>
        </section>
      ) : (
        <section className="bento-card output-card">
          <div className="output-header">
            <div className="editor-header-title">
              <p className="card-kicker">Catalog preview</p>
              <h2>package-catalog.json</h2>
            </div>
            <CopyButton
              copied={copied === "catalog"}
              onClick={() => copyText("catalog", catalogJson)}
            />
          </div>
          <div className="output-code-container">
            <pre>
              <code>{catalogJson}</code>
            </pre>
          </div>
        </section>
      )}
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

function MigrationInputs(props: {
  backend: BackendTarget;
  builderCode: string;
  packageName: string;
  packagePrice: string;
  projectType: ProjectType;
  unit: MonetizationUnit;
  onBackendChange: (backend: BackendTarget) => void;
  onBuilderCodeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPackageNameChange: (value: string) => void;
  onPackagePriceChange: (value: string) => void;
  onProjectTypeChange: (projectType: ProjectType) => void;
  onUnitChange: (unit: MonetizationUnit) => void;
}) {
  return (
    <>
      <div className="card-header">
        <p className="card-kicker">Inputs</p>
        <h2>Migration setup</h2>
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
          <span className="form-label">Project</span>
          <div className="option-grid">
            {projectTypeOptions.map((option) => (
              <button
                key={option.value}
                className={`grid-option-item ${option.value === props.projectType ? "active" : ""}`}
                type="button"
                onClick={() => props.onProjectTypeChange(option.value)}
              >
                <span className="grid-option-title">{option.label}</span>
                <span className="grid-option-desc">{option.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <span className="form-label">Backend</span>
          <div className="option-grid">
            {backendOptions.map((option) => (
              <button
                key={option.value}
                className={`grid-option-item ${option.value === props.backend ? "active" : ""}`}
                type="button"
                onClick={() => props.onBackendChange(option.value)}
              >
                <span className="grid-option-title">{option.label}</span>
                <span className="grid-option-desc">{option.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <span className="form-label">Unit</span>
          <div className="option-grid">
            {unitOptions.map((option) => (
              <button
                key={option.value}
                className={`grid-option-item ${option.value === props.unit ? "active" : ""}`}
                type="button"
                onClick={() => props.onUnitChange(option.value)}
              >
                <span className="grid-option-title">{option.label}</span>
                <span className="grid-option-desc">{option.note}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="form-group">
          <span className="form-label">Starter package</span>
          <input
            className="text-input"
            value={props.packageName}
            onChange={(event) => props.onPackageNameChange(event.target.value)}
          />
        </label>

        <label className="form-group">
          <span className="form-label">Price, USDC</span>
          <input
            className="text-input"
            inputMode="decimal"
            value={props.packagePrice}
            onChange={(event) => props.onPackagePriceChange(event.target.value)}
          />
        </label>
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

function MigrationChecklist(props: { items: string[] }) {
  return (
    <section className="bento-card result-panel">
      <div className="card-header">
        <p className="card-kicker">Server checklist</p>
        <div className="status-badge passing">
          <span className="status-dot" />
          <span>replay-safe plan</span>
        </div>
      </div>

      <div className="checklist-container">
        {props.items.map((item) => (
          <article className="checklist-item" key={item}>
            <span className="checklist-icon" aria-hidden="true">
              <CheckIcon />
            </span>
            <p className="checklist-text">{item}</p>
          </article>
        ))}
      </div>

      <a className="cta-link" href="https://github.com/horn111/base-attribution-os">
        Star the repo for custom SDK access
      </a>
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

function CheckIcon() {
  return (
    <svg aria-hidden="true" height="12" viewBox="0 0 24 24" width="12">
      <polyline points="20 6 9 17 4 12" />
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
