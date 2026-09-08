# Public attribution dashboard

The main question is whether Builder Code attribution survives the application's
transaction paths and releases. Base analytics remains the activity dashboard.
BAO adds supported-source-path audits, CI enforcement, and reusable onchain
evidence. Base provides automatic attribution inside Base App; outside it,
builders can integrate directly without BAO. See the
[official app integration guide](https://docs.base.org/specifications/builder-codes/for-app-developers).

The docs app serves `/dashboard` using the canonical manifests in `proofs/sets/`.
It defaults to Stack the Bag and also supports BAO's own published evidence.
Project and network selections are encoded in the share URL. Search and the
review filter apply only to the transaction table; summary metrics and the JSON
export describe the full selected project/network sample.

## What the dashboard measures

- Published transactions: unique chain ID and transaction hash pairs.
- RPC-verified evidence: records marked verified in the published proof set.
- Builder Code found: records decoded with the expected Builder Code.
- Coverage: verified and attributed records divided by all selected records.
- Needs review: any selected record that is not both verified and attributed.

Empty selections display no percentage. Missing, invalid, unavailable,
differently attributed, and unverified records remain in the denominator.
Testnet records are labeled and can be excluded with the Base mainnet filter.
The snapshot date comes from the manifest, not the browser's current time.

These are sample statistics, not full-project analytics. RPC verification does
not certify contract security, deployment readiness, or successful game actions.
The dashboard never infers revenue, unique players, social referrals, season
membership, or daily activity from the published sample.

## Update the public evidence

The source-audit section uses an allowlisted snapshot in `proofs/audits/`,
registered by Builder Code in `apps/docs/app/dashboard/registry.ts`. Regenerate it
from a local project with:

```bash
pnpm exec tsx scripts/export-dashboard-audit.ts --path <project> --builder-code bc_abc123 --output proofs/audits/bc_abc123.json
```

This runs a strict source audit without rewriting the application, disabling
rules, or applying a findings baseline. Only aggregate counts, framework
families, date, and revision metadata are exported. It omits paths, source text,
and raw findings. Review the public snapshot before publication. Its findings
describe a local source audit, not a hosted CI run. The source audit is project
wide and does not change with the onchain network filter.

Use the existing replay and proof-set workflow described in
[Attribution Proof Loop](attribution-proof-loop.md). Replace the project's
canonical manifest in `proofs/sets/` with the new public proof set, then rebuild
and redeploy the docs app. An additional project must be explicitly registered
in `apps/docs/app/proof-data.ts`.

The dashboard does not run runtime RPC requests or background ingestion.
Its client receives metadata only; calldata remains in the canonical proof
sets and existing proof pages. The JSON export contains public metadata for
the selected sample and includes its scope and snapshot date.

## Connect Stack the Bag seasons

The currently published game sample contains two historical Base Sepolia
transactions. It does not establish that the current game release has been
deployed. Keep season metrics in the explicit not-connected state until there
is an active deployment and a complete collection process.

A season feed needs:

1. The current chain ID, contract address, and deployment block.
2. The season ID mapping used by the game. Its collectible contract emits
   `ClaimConsumed` with indexed player and season ID fields.
3. An index of those events through a recorded, confirmed block. Deduplicate
   events by chain ID, transaction hash, and log index. Count transactions and
   claim events separately: a batch can emit multiple claims.
4. Attribution verification for the corresponding transaction path. For smart
   wallets, inspect the relevant UserOperation calldata, not an unrelated
   operation in the same EntryPoint transaction.
5. A public snapshot with the scanned block range, update timestamp, season
   membership, completeness state, and errors. Retain unattributed activity in
   the denominator and never render a failed or partial scan as an empty season.

Use the event's player for participating wallets; the transaction sender can be
a bundler. Wallet counts are not counts of people. Game sessions and offchain
play require an explicitly defined game data source. An onchain Builder Code
alone cannot identify which X post brought a player to the game.
