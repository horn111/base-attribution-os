# Published Attribution Proofs

This directory contains public, reproducible Attribution Proof Loop artifacts.
Replay reports remain valid inputs to `bao proof-set`; canonical multi-report
manifests live in [`sets/`](sets/) and are published by the Observatory.
Explorer links and transaction calldata are public onchain data.

Reproduce the BAO project proof:

```bash
pnpm exec bao proof \
  --hash 0x6573344cfb346c886806804fb8f8b6cc510c30d7974a1a69c11452a5f8fe4926 \
  --rpc-url https://mainnet.base.org \
  --expect bc_vwmzy653 \
  --format json
```

Build a Proof Set manifest from replay JSON:

```bash
pnpm exec bao proof-set \
  --builder-code bc_vwmzy653 \
  --title "Base Attribution OS" \
  --input proofs/bc_vwmzy653.json \
  --output proof-set.json
```

The registry includes BAO on Base mainnet and the two existing Stack the Bag
Base Sepolia paths. Stack sponsored-call and USDC-payment paths remain disabled
and are not represented as verified evidence.

Do not publish RPC credentials, private keys, customer data, or non-public
repository metadata in proof artifacts.
