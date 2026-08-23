import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../_components/site-header";
import { getPublishedProof, shortHash } from "../../proof-data";

type ProofPageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: ProofPageProps): Promise<Metadata> {
  const { code } = await params;
  const proof = getPublishedProof(code);
  return {
    title: proof ? `Verified proof · ${code}` : `Proof · ${code}`,
    description: proof
      ? `${proof.attributed} verified Base transaction carries ${code}.`
      : `Publish an Attribution Proof Loop report for ${code}.`,
  };
}

export default async function ProofPage({ params }: ProofPageProps) {
  const { code } = await params;
  const proof = getPublishedProof(code);

  return (
    <main className="app-container">
      <SiteHeader current="proof" />

      <section className="hero proof-hero">
        <div className="hero-meta">
          <p className="eyebrow">Attribution Proof · Base mainnet</p>
          <h1>{code}</h1>
        </div>
        <div className="hero-controls">
          <p className="lede">
            {proof
              ? "A published replay report links this Builder Code to decoded ERC-8021 calldata and an explorer-verifiable transaction."
              : "No public BAO replay has been published for this Builder Code yet. Generate one from transaction hashes or a Dune export."}
          </p>
          <Link className="hero-command command-link" href="/observatory">
            View proof loop
          </Link>
        </div>
      </section>

      {proof ? <VerifiedProof code={code} proof={proof} /> : <EmptyProof code={code} />}
    </main>
  );
}

function VerifiedProof(props: {
  code: string;
  proof: NonNullable<ReturnType<typeof getPublishedProof>>;
}) {
  return (
    <>
      <section className="proof-verdict">
        <div className="proof-seal" aria-hidden="true">
          ✓
        </div>
        <div>
          <p className="card-kicker">Replay verdict</p>
          <h2>Expected Builder Code verified</h2>
          <p>
            {props.proof.attributed} of {props.proof.total} published transactions contain{" "}
            <code>{props.code}</code>.
          </p>
        </div>
        <strong>{props.proof.coverage}%</strong>
      </section>

      <div className="observatory-grid">
        <section className="bento-card">
          <div className="card-header">
            <p className="card-kicker">Proof manifest</p>
            <h2>Verification metadata</h2>
          </div>
          <dl className="proof-manifest">
            <div>
              <dt>Builder Code</dt>
              <dd>{props.proof.builderCode}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>{props.proof.network}</dd>
            </div>
            <div>
              <dt>Chain ID</dt>
              <dd>{props.proof.chainId}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>{new Date(props.proof.generatedAt).toISOString().slice(0, 10)}</dd>
            </div>
          </dl>
        </section>

        <section className="bento-card replay-card">
          <div className="card-header">
            <p className="card-kicker">Reproduce locally</p>
            <h2>Verify the same transaction</h2>
          </div>
          <pre className="compact-code">
            <code>{`pnpm dlx @base-attribution-os/cli proof --hash ${props.proof.transactions[0].hash} --rpc-url https://mainnet.base.org --expect ${props.code}`}</code>
          </pre>
        </section>
      </div>

      <section className="bento-card transaction-card proof-detail-card">
        <div className="output-header">
          <div className="editor-header-title">
            <p className="card-kicker">Transaction evidence</p>
            <h2>Decoded replay</h2>
          </div>
          <span className="status-badge passing compact-badge">verified</span>
        </div>
        <div className="proof-transactions">
          {props.proof.transactions.map((transaction) => (
            <article key={transaction.hash}>
              <div>
                <p className="transaction-label">Transaction hash</p>
                <a href={transaction.explorerUrl}>{shortHash(transaction.hash)}</a>
              </div>
              <div>
                <p className="transaction-label">Decoded codes</p>
                <code>{transaction.codes.join(", ")}</code>
              </div>
              <div>
                <p className="transaction-label">Result</p>
                <span className="table-status">{transaction.status}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function EmptyProof(props: { code: string }) {
  return (
    <section className="bento-card empty-proof">
      <div className="empty-proof-mark">?</div>
      <div>
        <p className="card-kicker">No published replay</p>
        <h2>Create the first proof report</h2>
        <p>
          Export matching transactions from the included Dune query, then commit the generated
          Markdown or JSON report as a public artifact.
        </p>
      </div>
      <pre className="compact-code">
        <code>{`bao replay --builder-code ${props.code} --input dune-export.csv --format markdown --output proof.md`}</code>
      </pre>
    </section>
  );
}
