# Fixture Lab

The public fixtures under `fixtures/` contain broken and fixed versions of Base
transaction paths. They serve three purposes:

1. Regression tests for scanner rules.
2. Copyable integration examples for builders.
3. Public evidence that a BAO finding maps to a concrete code change.

Current coverage includes Wagmi, Privy, raw RPC, EIP-5792 smart-wallet calls,
x402 buyers, and agent transaction tools.

Run the fixture suite:

```bash
pnpm test:fixtures
```

New fixtures should include `broken/` and `fixed/` directories, use
`bc_abc123`, and add an assertion to the scanner test table.
