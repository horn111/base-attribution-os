# Attribution Doctor Demo Script

1. Open Attribution Doctor and select the broken `Wagmi` fixture.
2. Point to the coverage strip: one transaction path found, zero protected.
3. Show the `BAO001` finding on the exact `writeContract` callsite.
4. Toggle to the fixed fixture and show coverage move to `1 / 1`.
5. Repeat with `Privy`, `smart wallet`, `raw RPC`, `x402 buyer`, and `agent`
   fixtures to show framework coverage.
6. Switch between `local`, `ci`, and `strict` to explain incremental adoption.
7. Show the generated changed-files GitHub Action and SARIF upload step.
8. End on: "Find every transaction path. Prove every Builder Code."
