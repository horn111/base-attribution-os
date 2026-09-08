"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatBlock, statusLabels, summarizeTransactions, type DashboardProject } from "./data";

const number = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function Dashboard({
  projects,
  initialProject,
  initialNetwork,
}: {
  projects: DashboardProject[];
  initialProject: string;
  initialNetwork: string;
}) {
  const router = useRouter();
  const [projectCode, setProjectCode] = useState(initialProject);
  const [network, setNetwork] = useState(initialNetwork);
  const [search, setSearch] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const project = projects.find((item) => item.code === projectCode) ?? projects[0];
  const audit = project.audit;
  const transactions = project.transactions.filter(
    (tx) => network === "all" || String(tx.chainId) === network,
  );
  const summary = summarizeTransactions(transactions);
  const rows = transactions.filter(
    (tx) =>
      (!reviewOnly || !tx.verified || tx.status !== "attributed") &&
      `${tx.hash} ${tx.source} ${tx.codes.join(" ")}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const sources = Array.from(new Set(transactions.map((tx) => tx.source))).map((source) => {
    const entries = transactions.filter((tx) => tx.source === source);
    return { source, ...summarizeTransactions(entries) };
  });
  const hasTestnet = transactions.some((tx) => tx.chainId === 84532);
  const coverage =
    summary.coverage === null ? "—" : `${number.format(Math.round(summary.coverage * 10) / 10)}%`;

  function changeSelection(code: string, chain: string) {
    setProjectCode(code);
    setNetwork(chain);
    setSearch("");
    setReviewOnly(false);
    setShareStatus("");
    router.replace(`/dashboard?project=${encodeURIComponent(code)}&network=${chain}`, {
      scroll: false,
    });
  }

  async function copyLink() {
    const url = new URL("/dashboard", window.location.origin);
    url.searchParams.set("project", project.code);
    url.searchParams.set("network", network);
    try {
      await navigator.clipboard.writeText(url.href);
      setShareStatus("Link copied");
    } catch {
      setShareStatus("Copy the page address from your browser to share this view.");
    }
  }

  return (
    <>
      <header className="dash-heading">
        <div>
          <h1>Keep your activity attributable.</h1>
          <p>
            A transaction can succeed without your Builder Code. BAO checks for the missing credit.
          </p>
        </div>
        <div className="dash-share">
          <button type="button" className="dash-button" onClick={copyLink}>
            <Icon kind="link" />
            Share dashboard
          </button>
          <span role="status">{shareStatus}</span>
        </div>
      </header>

      <section className="dash-toolbar" aria-label="Dashboard filters">
        <label className="dash-project-select">
          Project
          <select
            value={project.code}
            onChange={(event) => changeSelection(event.target.value, "all")}
          >
            {projects.map((item) => (
              <option key={item.code} value={item.code}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <div className="dash-network" role="group" aria-label="Onchain evidence network">
          {[
            ["all", "All networks"],
            ["8453", "Base mainnet"],
            ["84532", "Base Sepolia"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={network === value}
              onClick={() => changeSelection(project.code, value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="dash-period">
          <Icon kind="snapshot" />
          <span>
            Onchain snapshot
            <br />
            <time dateTime={project.generatedAt}>{date.format(new Date(project.generatedAt))}</time>
          </span>
        </div>
      </section>

      <div className="dash-context">
        <div>
          <span className="dash-code-label">Builder Code</span>
          <code>{project.code}</code>
        </div>
        <span className={`dash-badge ${hasTestnet ? "dash-badge-test" : ""}`}>
          {hasTestnet ? "Includes testnet evidence" : "Published evidence"}
        </span>
      </div>

      <section className="dash-overview" aria-labelledby="dash-coverage-title">
        <div className="dash-coverage">
          <div className="dash-section-head">
            <h2 id="dash-coverage-title">Before release: check the code</h2>
            <span className="dash-badge">{audit ? "Real source audit" : "Not connected"}</span>
          </div>
          <div className="dash-coverage-reading">
            <strong>{audit ? `${audit.summary.protected}/${audit.summary.total}` : "—"}</strong>
            <p>
              <b>{audit ? "supported transaction paths" : "No published source audit"}</b> <br />
              {audit
                ? "carry attribution in source"
                : "Connect a Doctor report to inspect source coverage"}
            </p>
          </div>
          <div className="dash-coverage-track" aria-hidden="true">
            <span style={{ width: `${audit?.summary.coverage ?? 0}%` }} />
          </div>
          <div className="dash-legend">
            <span>
              <i className="dash-dot" />
              Protected paths <b>{audit?.summary.protected ?? "—"}</b>
            </span>
            <span>
              <i className="dash-dot dash-dot-neutral" />
              Gaps or unresolved{" "}
              <b>{audit ? audit.summary.total - audit.summary.protected : "—"}</b>
            </span>
          </div>
          <p className="dash-scope">
            {audit
              ? `${audit.checkedFiles} files checked · ${audit.profile} profile · ${date.format(new Date(audit.generatedAt))} UTC. Static analysis of supported paths; independent of the network filter.`
              : "Source coverage and onchain evidence are separate checks. A successful transaction does not prove every source path is protected."}
          </p>
        </div>
        <aside className="dash-meaning">
          <Icon kind="code" />
          <h2>
            Analytics count activity.
            <br />
            BAO checks attribution.
          </h2>
          <p>
            Keep using Base for users, transactions, and gas. Use BAO to find missing Builder Codes
            in supported source paths and enforce attribution checks in CI.
          </p>
          <p>
            A new wallet flow or refactor can omit attribution without breaking the transaction.
          </p>
          <Link href="/">
            See a missing-code check <Icon kind="arrow" />
          </Link>
        </aside>
      </section>

      <section className="dash-source-results" aria-label="Source audit findings">
        <div>
          <span>Missing attribution</span>
          <strong>{audit?.summary.missing ?? "—"}</strong>
        </div>
        <div>
          <span>Wrong Builder Code</span>
          <strong>{audit?.summary.wrongCode ?? "—"}</strong>
        </div>
        <div>
          <span>Needs manual resolution</span>
          <strong>{audit?.summary.unresolved ?? "—"}</strong>
        </div>
        <Link href="/">
          Run these checks on your app <Icon kind="arrow" />
        </Link>
      </section>

      <section className="dash-assurance" aria-label="Attribution checks by stage">
        <div>
          <h2>Inspect every supported path</h2>
          {audit ? (
            audit.families.map((family) => (
              <p key={family.family}>
                <span>{family.family === "wallet" ? "Smart wallet" : family.family}</span>
                <b>
                  {family.protected}/{family.total} protected
                </b>
              </p>
            ))
          ) : (
            <p>Publish a source audit to see framework-level coverage.</p>
          )}
        </div>
        <div>
          <h2>Catch regressions in a PR</h2>
          <p>
            Run Doctor in strict CI. Missing or unresolved attribution produces a failing check
            before changes ship.
          </p>
          <Link href="/">
            Get the GitHub Action <Icon kind="arrow" />
          </Link>
        </div>
        <div>
          <h2>Check what reached the chain</h2>
          <p>
            Decode the actual transaction or supported smart-wallet UserOperation and match your
            Builder Code.
          </p>
          <Link href={`/proof/${project.code}`}>
            Open the real evidence <Icon kind="arrow" />
          </Link>
        </div>
      </section>

      <div className="dash-onchain-heading">
        <h2>After sending: verify the onchain evidence</h2>
        <p>
          {coverage} verified attribution across this selected sample. {summary.confirmed} of{" "}
          {summary.total} published transactions; not a full activity feed.
        </p>
      </div>
      <dl className="dash-metrics" aria-label="Selected evidence totals">
        <div>
          <dt>Published transactions</dt>
          <dd>
            {number.format(summary.total)}
            <p>Unique transaction hashes</p>
          </dd>
        </div>
        <div>
          <dt>RPC-verified evidence</dt>
          <dd>
            {number.format(summary.verified)}
            <p>Verified when the snapshot was made</p>
          </dd>
        </div>
        <div>
          <dt>Builder Code found</dt>
          <dd>
            {number.format(summary.attributed)}
            <p>Decoded from transaction data</p>
          </dd>
        </div>
        <div>
          <dt>Needs review</dt>
          <dd>
            {number.format(summary.needsReview)}
            <p>Missing attribution or verification</p>
          </dd>
        </div>
      </dl>

      <div className="dash-detail-grid">
        <section className="dash-paths" aria-labelledby="dash-paths-title">
          <div className="dash-section-head">
            <h2 id="dash-paths-title">Where attribution holds</h2>
            <span className="dash-muted">Published transaction paths</span>
          </div>
          {sources.length ? (
            sources.map((item) => (
              <div className="dash-path" key={item.source}>
                <div>
                  <h3>{item.source.replace(`${project.title} · `, "")}</h3>
                  <span>
                    {item.confirmed} / {item.total} verified &amp; attributed
                  </span>
                </div>
                <div className="dash-path-track" aria-hidden="true">
                  <span style={{ width: `${item.coverage ?? 0}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="dash-empty-inline">
              No published paths on this network yet. Choose another network to explore the existing
              evidence.
            </p>
          )}
        </section>
        <section className="dash-seasons" aria-labelledby="dash-seasons-title">
          <div className="dash-section-head">
            <h2 id="dash-seasons-title">
              {project.code === "bc_4pe6m33m"
                ? "What a new season needs"
                : "Before the next release"}
            </h2>
            <span className="dash-badge">Release check</span>
          </div>
          <p>
            Recheck attribution when you add a mint, wallet flow, or payment path. Publish a new
            source audit and onchain evidence for the paths you enable.
          </p>
          <p className="dash-muted">
            {project.code === "bc_4pe6m33m"
              ? "The game’s published testnet evidence is historical. Season activity and current deployment verification are not connected."
              : "This published transaction sample is separate from release checks. It does not establish current deployment readiness."}
          </p>
        </section>
      </div>

      <section className="dash-ledger" aria-labelledby="dash-ledger-title">
        <div className="dash-section-head">
          <div>
            <h2 id="dash-ledger-title">The evidence behind the numbers</h2>
            <p>Open a transaction to check it on the block explorer.</p>
          </div>
          <a
            className="dash-button"
            href={`/dashboard/export?project=${encodeURIComponent(project.code)}&network=${network}`}
            download
          >
            <Icon kind="download" />
            Export full sample
          </a>
        </div>
        <div className="dash-ledger-tools">
          <label className="dash-search">
            <Icon kind="search" />
            <input
              type="search"
              aria-label="Search transactions"
              placeholder="Search transaction or path…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="dash-review-filter">
            <input
              type="checkbox"
              checked={reviewOnly}
              onChange={(event) => setReviewOnly(event.target.checked)}
            />
            Needs review only
          </label>
          <span className="dash-muted" aria-live="polite">
            {rows.length} of {transactions.length} transactions
          </span>
        </div>
        <div
          className="dash-table-scroll"
          role="region"
          aria-label="Transaction evidence"
          tabIndex={0}
        >
          <table className="dash-table">
            <thead>
              <tr>
                <th scope="col">Transaction / path</th>
                <th scope="col">Network</th>
                <th scope="col">Block</th>
                <th scope="col">Attribution</th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr key={`${tx.chainId}:${tx.hash}`}>
                  <td>
                    {tx.explorerUrl ? (
                      <a
                        className="dash-tx-link"
                        href={tx.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Inspect transaction ${tx.hash} on ${tx.network} explorer (opens in new tab)`}
                      >
                        {shortHash(tx.hash)}
                        <Icon kind="arrow" />
                      </a>
                    ) : (
                      <code>{shortHash(tx.hash)}</code>
                    )}
                    <span className="dash-tx-source">
                      {tx.source.replace(`${project.title} · `, "")}
                    </span>
                  </td>
                  <td>
                    <span
                      className={tx.chainId === 84532 ? "dash-network-test" : "dash-network-main"}
                    >
                      {tx.network}
                    </span>
                  </td>
                  <td className="dash-block">{formatBlock(tx.blockNumber)}</td>
                  <td>
                    <span
                      className={`dash-tx-status ${tx.status === "attributed" ? "dash-status-good" : "dash-status-review"}`}
                    >
                      <Icon kind={tx.status === "attributed" ? "check" : "review"} />
                      {statusLabels[tx.status]}
                    </span>
                    <code className="dash-tx-code">{tx.codes.join(", ") || "No decoded code"}</code>
                  </td>
                  <td>{tx.verified ? "RPC verified" : "Not RPC verified"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="dash-empty">
              <h3>
                {!transactions.length
                  ? "No published evidence on this network"
                  : reviewOnly && !summary.needsReview && !search
                    ? "No transactions need review"
                    : "No matching transactions"}
              </h3>
              <p>
                {!transactions.length
                  ? "This does not mean the project has no activity. No transactions from this network are included in its published proof set."
                  : "The totals above still describe the full selected sample."}
              </p>
              {(search || reviewOnly) && (
                <button
                  type="button"
                  className="dash-button"
                  onClick={() => {
                    setSearch("");
                    setReviewOnly(false);
                  }}
                >
                  Clear table filters
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <details className="dash-method">
        <summary>How to read these numbers</summary>
        <div>
          {audit && (
            <p>
              Source audit: {date.format(new Date(audit.generatedAt))} UTC, {audit.profile} profile,{" "}
              {audit.checkedFiles} files. Revision{" "}
              {audit.sourceRevision ? (
                <code>{audit.sourceRevision.slice(0, 12)}</code>
              ) : (
                "not recorded"
              )}
              ; working tree{" "}
              {audit.workingTreeDirty === null
                ? "not recorded"
                : audit.workingTreeDirty
                  ? "modified"
                  : "clean"}
              . This is a local source audit snapshot, not the status of a hosted CI run or a
              complete proof of runtime behavior.
            </p>
          )}
          <p>
            Transactions are deduplicated by network and hash. Coverage counts transactions that are
            both RPC verified and decoded with the expected Builder Code, divided by every
            transaction in the selected published sample. Empty samples have no coverage percentage.
          </p>
          <p>
            Verification describes attribution evidence at snapshot time. It does not certify
            contract security, current deployment readiness, successful game actions, or the source
            of a player’s visit. Missing, invalid, unavailable, differently attributed, and
            unverified records remain in the denominator.
          </p>
          <p>
            Snapshots update when a new proof set is published. This dashboard does not poll the
            blockchain. Season counts, unique players, revenue, and daily activity are not inferred
            from the sample.
          </p>
          <Link href="/observatory">
            Explore all published proof sets <Icon kind="arrow" />
          </Link>
        </div>
      </details>

      <section className="dash-base-context" aria-labelledby="dash-base-title">
        <h2 id="dash-base-title">Use BAO alongside Base analytics</h2>
        <p>
          Base App automatically adds a registered app’s Builder Code. Outside Base App, builders
          integrate attribution themselves. A direct SDK setup can be enough for a simple app.{" "}
          <a
            href="https://docs.base.org/specifications/builder-codes/for-app-developers"
            target="_blank"
            rel="noreferrer"
          >
            Read the Base integration guide
          </a>
          .
        </p>
        <p>
          BAO becomes useful when you want repeatable source checks, failing CI checks for
          attribution regressions, and reusable onchain evidence across supported transaction paths.
          It does not guarantee rewards, recover past unattributed transactions, or measure
          referrals from X.
        </p>
      </section>

      <footer className="dash-footer">
        <div>
          <h2>Make your own activity attributable.</h2>
          <p>Add a Builder Code. Keep it through every transaction path.</p>
        </div>
        <Link className="dash-button dash-button-primary" href="/">
          Try Attribution Doctor <Icon kind="arrow" />
        </Link>
      </footer>
    </>
  );
}

function Icon({
  kind,
}: {
  kind: "link" | "snapshot" | "code" | "arrow" | "download" | "search" | "check" | "review";
}) {
  const paths = {
    link: (
      <>
        <path d="m10 13 4-4M8 15l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M12 5l1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0" />
      </>
    ),
    snapshot: (
      <>
        <rect x="3" y="4" width="14" height="14" rx="2" />
        <path d="M6 2v4m8-4v4M3 9h14m-10 4h6" />
      </>
    ),
    code: (
      <>
        <path d="m6 5-5 5 5 5m8-10 5 5-5 5M12 3 8 17" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 15 15 5M5 5h10v10" />
      </>
    ),
    download: (
      <>
        <path d="M10 2v11m-4-4 4 4 4-4M3 13v5h14v-5" />
      </>
    ),
    search: (
      <>
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="m13 13 4 4" />
      </>
    ),
    check: <path d="m4 10 4 4 8-8" />,
    review: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="M10 5v6m0 3v.1" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[kind]}
    </svg>
  );
}
