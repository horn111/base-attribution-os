# Published Attribution Proofs

This directory contains public, reproducible Attribution Proof Loop artifacts.
Each JSON file records the exact transaction set supplied to `bao proof` or
`bao replay`. Explorer links and transaction calldata are public onchain data.

Reproduce the BAO project proof:

```bash
pnpm exec bao proof \
  --hash 0x6573344cfb346c886806804fb8f8b6cc510c30d7974a1a69c11452a5f8fe4926 \
  --rpc-url https://mainnet.base.org \
  --expect bc_vwmzy653 \
  --format json
```

Do not publish RPC credentials, private keys, customer data, or non-public
repository metadata in proof artifacts.
