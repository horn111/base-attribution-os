import type { Metadata } from "next";
import { SiteHeader } from "../_components/site-header";

export const metadata: Metadata = {
  title: "Smart Wallet Attribution Kit · Base Attribution OS",
  description:
    "Capability-aware ERC-8021 attribution for EIP-5792 batches and ERC-4337 UserOperations.",
};

const flow = [
  ["01", "Discover", "Check dataSuffix for this account and chain."],
  ["02", "Inject", "Add one required capability without changing inner calls."],
  ["03", "Build", "Merge wallet and app codes into the final userOp.callData."],
  ["04", "Verify", "Decode every expected code before or after submission."],
] as const;

const scenarios = [
  {
    label: "Capability supported",
    status: "attributed",
    detail: "wallet_sendCalls receives a required dataSuffix capability.",
  },
  {
    label: "Unsupported · strict",
    status: "blocked",
    detail: "The request stops before submission. No silent attribution loss.",
  },
  {
    label: "Unsupported · best effort",
    status: "unattributed",
    detail: "The unchanged batch is sent only after an explicit opt-in.",
  },
] as const;

export default function SmartWalletsPage() {
  return (
    <main className="app-container">
      <SiteHeader current="smart-wallets" />

      <section className="hero">
        <div className="hero-meta">
          <p className="eyebrow">Update 8 · EIP-5792 + ERC-4337</p>
          <h1>Smart Wallet Attribution Kit</h1>
        </div>
        <div className="hero-controls">
          <p className="lede">
            Ship Builder Codes through Base Account, Privy, and custom smart wallets without
            guessing whether attribution survived the UserOperation pipeline.
          </p>
          <code className="hero-command">pnpm add @base-attribution-os/wallet</code>
        </div>
      </section>

      <section className="smart-flow" aria-label="Smart wallet attribution flow">
        {flow.map(([step, title, detail]) => (
          <article className="bento-card smart-flow-card" key={step}>
            <p className="card-kicker">{step}</p>
            <h2>{title}</h2>
            <p>{detail}</p>
          </article>
        ))}
      </section>

      <section className="smart-layout">
        <article className="bento-card">
          <div className="card-header">
            <p className="card-kicker">App middleware</p>
            <h2>Capability-aware batches</h2>
          </div>
          <pre className="smart-code">
            <code>{`const sent = await sendAttributedCalls(
  provider,
  { chainId: "0x2105", from, calls },
  { codes: ["bc_app"] },
);`}</code>
          </pre>
          <p>
            BAO checks <code>wallet_getCapabilities</code> before the first send and preserves
            paymaster, atomic, and application-defined capabilities.
          </p>
        </article>

        <article className="bento-card">
          <div className="card-header">
            <p className="card-kicker">Wallet middleware</p>
            <h2>One suffix, every contributor</h2>
          </div>
          <pre className="smart-code">
            <code>{`attributeUserOperation(userOp, {
  walletCodes: ["bc_wallet"],
  appDataSuffix,
});

// decoded: bc_wallet, bc_app`}</code>
          </pre>
          <p>
            Existing suffixes are normalized, duplicates are removed, and the result is appended to
            the final <code>userOp.callData</code> before signing.
          </p>
        </article>
      </section>

      <section className="bento-card smart-outcomes" aria-labelledby="fallback-title">
        <div className="card-header">
          <p className="card-kicker">Fallback contract</p>
          <h2 id="fallback-title">Every downgrade is visible</h2>
        </div>
        <div className="smart-outcome-grid">
          {scenarios.map((scenario) => (
            <article key={scenario.label}>
              <span className={`smart-status ${scenario.status}`}>{scenario.status}</span>
              <h3>{scenario.label}</h3>
              <p>{scenario.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="smart-cta">
        <div>
          <p className="card-kicker">Verify before shipping</p>
          <code>bao check-user-op --input user-op.json --expect bc_wallet,bc_app</code>
        </div>
        <a href="https://github.com/horn111/base-attribution-os/blob/main/docs/smart-wallet-attribution.md">
          Read the integration guide ↗
        </a>
      </section>
    </main>
  );
}
