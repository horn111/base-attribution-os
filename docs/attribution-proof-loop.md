# Attribution Proof Loop

Attribution Proof Loop connects BAO's pre-deploy audit with post-deploy Base
transaction evidence:

```text
source audit -> pull request enforcement -> Base transaction -> replay -> public proof
```

The workflow does not replace Base.dev analytics or Dune. It produces a small,
portable report that links the transaction set you provide to decoded ERC-8021
calldata and explorer URLs.

## Replay a Dune export

Run [`dune/builder-code-replay.sql`](../dune/builder-code-replay.sql), set the
`builder_code` query parameter, and export the results as JSON or CSV.

```bash
pnpm exec bao replay \
  --builder-code bc_abc123 \
  --input dune-export.csv
```

Generate a publishable Markdown artifact:

```bash
pnpm exec bao replay \
  --builder-code bc_abc123 \
  --input dune-export.json \
  --format markdown \
  --output proof.md
```

The replay query returns transactions already decoded with the requested code.
To measure coverage, provide the complete transaction set that was expected to
carry attribution. BAO uses every supplied row as the denominator and does not
claim coverage over transactions that were not included.

## Replay transaction hashes over RPC

When an input row has no calldata, or when hashes are passed directly, BAO uses
one JSON-RPC batch to call `eth_getTransactionByHash`:

```bash
pnpm exec bao replay \
  --builder-code bc_abc123 \
  --hashes 0xabc...,0xdef... \
  --rpc-url https://mainnet.base.org
```

Base mainnet (`8453`) is the default network. Use `--chain-id 84532` for Base
Sepolia. Public Base RPC endpoints are rate limited; use a production RPC for
large or automated replays.

## Create a single-transaction proof

`bao proof` is the focused form of replay. It defaults to Markdown output:

```bash
pnpm exec bao proof \
  --hash 0xabc... \
  --rpc-url https://mainnet.base.org \
  --expect bc_abc123 \
  --output proof.md
```

The command exits with a non-zero status when the transaction is unavailable,
the ERC-8021 suffix is missing or invalid, or a different Builder Code is
decoded.

## Input contract

JSON input may be an array or an object containing `transactions`, `rows`, or
`data`. CSV and JSON rows accept common RPC and Dune column names:

| Value        | Accepted columns                       |
| ------------ | -------------------------------------- |
| Transaction  | `hash`, `tx_hash`, `transaction_hash`  |
| Calldata     | `calldata`, `input`, `data`, `tx_data` |
| Time         | `timestamp`, `block_time`, `time`      |
| Block number | `blockNumber`, `block_number`          |
| Source label | `source`                               |

`hash` is required. `calldata` is optional only when `--rpc-url` is provided.

## Report statuses

| Status                | Meaning                                                    |
| --------------------- | ---------------------------------------------------------- |
| `attributed`          | Expected Builder Code was decoded                          |
| `missing-attribution` | No ERC-8021 suffix was found                               |
| `wrong-builder-code`  | A suffix exists, but it does not contain the expected code |
| `invalid-attribution` | Calldata or the suffix cannot be decoded                   |
| `unavailable`         | RPC or input data did not provide transaction calldata     |

Use `--fail-on-missing false` for observational jobs that should publish a
report without failing the process. The report's own `ok` field remains false
until every supplied transaction is attributed.

## Public proof pages

The demo publishes verified reports at `/proof/<builder-code>` and links them
from `/observatory`. Public reports should contain only transaction hashes,
decoded Builder Codes, timestamps, network metadata, and explorer URLs. Never
include RPC credentials, private keys, unpublished customer data, or internal
repository paths.

BAO's own published example is:

```text
https://base-attribution-os.vercel.app/proof/bc_vwmzy653
```

The dynamic Open Graph image for each proof page is designed for a shareable
verification card.
