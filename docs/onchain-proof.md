# Onchain Proof

Status: ready for first attributed Base mainnet transaction.

Base Attribution OS has a registered Builder Code:

```txt
bc_vwmzy653
```

The goal is to make the project prove its own thesis: Builder Code attribution
should be visible, testable, and easy to verify before grant review.

## Proof transaction

Fill these fields after sending the first attributed Base transaction:

| Field        | Value                    |
| ------------ | ------------------------ |
| Builder Code | `bc_vwmzy653`            |
| Network      | Base mainnet             |
| Transaction  | `[PENDING_TX_HASH]`      |
| Explorer     | `[PENDING_BASESCAN_URL]` |
| Verified by  | `bao check-tx`           |

## Create the suffix

Build the workspace, then generate the ERC-8021 suffix:

```bash
pnpm build
node packages/cli/dist/index.js encode --code bc_vwmzy653
```

## Send the transaction

Send a small Base mainnet transaction from the project or maintainer wallet and
append the generated suffix as transaction calldata.

Do not commit private keys, seed phrases, RPC secrets, or wallet config to this
repository.

## Verify the transaction

After the transaction is mined:

```bash
node packages/cli/dist/index.js check-tx \
  --hash 0x... \
  --rpc-url https://mainnet.base.org \
  --expect bc_vwmzy653
```

Expected result: `bao` confirms that the transaction calldata contains the
expected Builder Code attribution suffix.

## Grant reviewer note

This proof is intentionally small. BAO is not trying to create a decorative
contract deployment. The evidence should show that the project can use its own
CLI to verify a real Base transaction attributed with its own Builder Code.
