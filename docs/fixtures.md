# Fixture Lab

The public fixtures under `fixtures/` contain broken and fixed versions of Base
transaction paths. They serve three purposes:

1. Regression tests for scanner rules.
2. Copyable integration examples for builders.
3. Public evidence that a BAO finding maps to a concrete code change.

Current coverage includes Wagmi, Privy, raw RPC, Base Account and EIP-5792
smart-wallet calls, ERC-4337 UserOperations, app/wallet multi-code attribution,
x402 buyers and sellers, multi-file wallet wrappers, agent transaction tools,
and monorepo evidence links for all eight scanner families. The calldata fixture set anchors decoder tests to public Base mainnet
data while keeping derived negative cases explicit.

Run the fixture suite:

```bash
pnpm test:fixtures
```

New source fixtures should include `broken/` and `fixed/` directories, use
`bc_abc123`, and add an assertion with an expected profile and rule to the
scanner test table. Calldata fixtures must record their onchain provenance and
label every derived case.
