import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../_components/site-header";
import { featuredProof, shortHash } from "../proof-data";

export const metadata: Metadata = {
  title: "Attribution Observatory",
  description: "Follow Base Builder Code attribution from source audit to verified onchain proof.",
};

const loop = [
  { step: "01", title: "Audit", detail: "Find every transaction path with bao doctor." },
  { step: "02", title: "Enforce", detail: "Block attribution regressions in pull requests." },
  { step: "03", title: "Ship", detail: "Append ERC-8021 data to real Base transactions." },
  { step: "04", title: "Replay", detail: "Decode Dune exports or fetch calldata over RPC." },
  { step: "05", title: "Prove", detail: "Publish a durable report with explorer links." },
] as const;

export default function ObservatoryPage() {
  return (
    <main className="app-container">
      <SiteHeader current="observatory" />

      <section className="hero observatory-hero">
        <div className="hero-meta">
          <p className="eyebrow">Update 7 · Source to Mainnet</p>
          <h1>Attribution Observatory</h1>
        </div>
        <div className="hero-controls">
          <p className="lede">
            Attribution Proof Loop connects pre-deploy coverage with the transactions that reached
            Base. Audit the path, replay the calldata, and publish evidence that survives a
            screenshot.
          </p>
          <code className="hero-command">bao replay --builder-code bc_... --input dune.csv</code>
        </div>
      </section>

      <section className="coverage-strip" aria-label="Published attribution proof coverage">
        <div>
          <p className="card-kicker">Published proof coverage</p>
          <p className="coverage-value">
            {featuredProof.attributed}/{featuredProof.total} transactions attributed
          </p>
        </div>
        <div className="coverage-track" aria-hidden="true">
          <span style={{ width: `${featuredProof.coverage}%` }} />
        </div>
        <strong>{featuredProof.coverage}%</strong>
      </section>

      <section className="proof-loop" aria-labelledby="proof-loop-title">
        <div className="section-heading">
          <p className="card-kicker">Closed-loop verification</p>
          <h2 id="proof-loop-title">One workflow, five checkpoints</h2>
        </div>
        <div className="loop-grid">
          {loop.map((item) => (
            <article className="loop-step" key={item.step}>
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="observatory-grid">
        <section className="bento-card proof-summary-card">
          <div className="card-header result-heading">
            <div>
              <p className="card-kicker">Featured public proof</p>
              <h2>{featuredProof.builderCode}</h2>
            </div>
            <div className="status-badge passing">
              <span className="status-dot" />
              <span>verified</span>
            </div>
          </div>
          <div className="metrics-row proof-metrics">
            <Metric label="network" value="Base" />
            <Metric label="chain" value={featuredProof.chainId} />
            <Metric label="proofs" value={featuredProof.total} />
            <Metric label="coverage" value={`${featuredProof.coverage}%`} />
          </div>
          <Link className="primary-link" href={`/proof/${featuredProof.builderCode}`}>
            Open published proof
            <span aria-hidden="true">↗</span>
          </Link>
        </section>

        <section className="bento-card replay-card">
          <div className="card-header">
            <p className="card-kicker">Replay inputs</p>
            <h2>Dune export or RPC batch</h2>
          </div>
          <p>
            Use the included Dune queries for a public dataset, or pass transaction hashes and let
            BAO fetch calldata with one JSON-RPC batch.
          </p>
          <pre className="compact-code">
            <code>
              {
                "bao proof --hash 0x... --rpc-url https://mainnet.base.org --expect bc_... --output proof.md"
              }
            </code>
          </pre>
        </section>
      </div>

      <section className="bento-card transaction-card">
        <div className="output-header">
          <div className="editor-header-title">
            <p className="card-kicker">Verified transaction ledger</p>
            <h2>Published evidence</h2>
          </div>
          <span className="ledger-count">{featuredProof.transactions.length} proof</span>
        </div>
        <div className="table-scroll">
          <table className="proof-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Source</th>
                <th>Builder Code</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {featuredProof.transactions.map((transaction) => (
                <tr key={transaction.hash}>
                  <td>
                    <a href={transaction.explorerUrl}>{shortHash(transaction.hash)}</a>
                  </td>
                  <td>{transaction.source}</td>
                  <td>
                    <code>{transaction.codes.join(", ")}</code>
                  </td>
                  <td>
                    <span className="table-status">attributed</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
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
