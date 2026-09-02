import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../_components/site-header";
import {
  getPublishedProofTransactions,
  observatorySummary,
  publishedProofSets,
  shortHash,
} from "../proof-data";

export const metadata: Metadata = {
  title: "Attribution Observatory",
  description: "Explore reproducible Base Builder Code proof sets and onchain evidence.",
};

const loop = [
  { step: "01", title: "Audit", detail: "Find every transaction path with bao doctor." },
  { step: "02", title: "Enforce", detail: "Block attribution regressions in pull requests." },
  { step: "03", title: "Ship", detail: "Append ERC-8021 data to real Base transactions." },
  { step: "04", title: "Replay", detail: "Decode Dune exports or fetch calldata over RPC." },
  { step: "05", title: "Aggregate", detail: "Combine replay reports into a proof set." },
] as const;

const ledger = publishedProofSets.flatMap((proofSet) =>
  getPublishedProofTransactions(proofSet).map((entry) => ({
    ...entry,
    builderCode: proofSet.builderCode,
    title: proofSet.title,
  })),
);

export default function ObservatoryPage() {
  return (
    <main className="app-container">
      <SiteHeader current="observatory" />

      <section className="hero observatory-hero">
        <div className="hero-meta">
          <p className="eyebrow">v0.5 · Reproducible Proof Sets</p>
          <h1>Attribution Observatory</h1>
        </div>
        <div className="hero-controls">
          <p className="lede">
            Static proof sets connect source audits with explorer-verifiable Base transactions. No
            hosted ingestion, private telemetry, or mutable analytics backend.
          </p>
          <code className="hero-command">
            bao proof-set --builder-code bc_... --input proof-a.json,proof-b.json
          </code>
        </div>
      </section>

      <section className="coverage-strip" aria-label="Published proof set coverage">
        <div>
          <p className="card-kicker">Published evidence coverage</p>
          <p className="coverage-value">
            {observatorySummary.verifiedAttributed}/{observatorySummary.transactions} transactions
            verified and attributed
          </p>
        </div>
        <div className="coverage-track" aria-hidden="true">
          <span style={{ width: `${observatorySummary.coverage}%` }} />
        </div>
        <strong>{observatorySummary.coverage}%</strong>
      </section>

      <section className="observatory-stats" aria-label="Observatory totals">
        <Metric label="proof sets" value={observatorySummary.proofSets} />
        <Metric label="replay reports" value={observatorySummary.reports} />
        <Metric label="verified txs" value={observatorySummary.verified} />
        <Metric label="networks" value={observatorySummary.networks.length} />
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

      <section className="proof-set-section" aria-labelledby="proof-sets-title">
        <div className="section-heading">
          <p className="card-kicker">Static registry</p>
          <h2 id="proof-sets-title">Published proof sets</h2>
        </div>
        <div className="proof-set-list">
          {publishedProofSets.map((proofSet) => (
            <article className="bento-card proof-set-card" key={proofSet.builderCode}>
              <div className="card-header result-heading">
                <div>
                  <p className="card-kicker">{proofSet.title}</p>
                  <h2>{proofSet.builderCode}</h2>
                </div>
                <div className="status-badge passing">
                  <span className="status-dot" />
                  <span>verified</span>
                </div>
              </div>
              <div className="metrics-row proof-metrics">
                <Metric label="reports" value={proofSet.summary.reports} />
                <Metric label="proofs" value={proofSet.summary.total} />
                <Metric label="networks" value={proofSet.summary.networks.length} />
                <Metric label="coverage" value={`${proofSet.summary.coverage}%`} />
              </div>
              <div className="proof-set-progress" aria-hidden="true">
                <span style={{ width: `${proofSet.summary.coverage}%` }} />
              </div>
              <Link className="primary-link" href={`/proof/${proofSet.builderCode}`}>
                Open proof set
                <span aria-hidden="true">↗</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="bento-card transaction-card">
        <div className="output-header">
          <div className="editor-header-title">
            <p className="card-kicker">Verified transaction ledger</p>
            <h2>Published evidence</h2>
          </div>
          <span className="ledger-count">{ledger.length} proofs</span>
        </div>
        <div className="table-scroll">
          <table className="proof-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Project</th>
                <th>Network</th>
                <th>Builder Code</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(({ builderCode, chainId, network, title, transaction }) => (
                <tr key={`${builderCode}:${chainId}:${transaction.hash}`}>
                  <td>
                    {transaction.explorerUrl ? (
                      <a href={transaction.explorerUrl}>{shortHash(transaction.hash)}</a>
                    ) : (
                      <code>{shortHash(transaction.hash)}</code>
                    )}
                  </td>
                  <td>{title}</td>
                  <td>{network}</td>
                  <td>
                    <code>{builderCode}</code>
                  </td>
                  <td>
                    <span className="table-status">{transaction.status}</span>
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
