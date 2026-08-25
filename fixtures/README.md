# Attribution Doctor Fixtures

Each fixture captures a transaction path in both `broken` and `fixed` form.
They are test inputs, integration references, and public evidence for BAO's
scanner rules.

| Fixture                  | Transaction path       | Expected fix                       |
| ------------------------ | ---------------------- | ---------------------------------- |
| `wagmi-app`              | Wagmi send transaction | client or call-level `dataSuffix`  |
| `privy-app`              | Privy embedded wallet  | Privy `dataSuffix` configuration   |
| `smart-wallet-sendcalls` | EIP-5792 batch         | `capabilities.dataSuffix`          |
| `base-account-sendcalls` | Base Account provider  | capability-aware wallet middleware |
| `wallet-user-operation`  | ERC-4337 submission    | suffix on `userOp.callData`        |
| `multi-code-userop`      | app + wallet codes     | one merged ERC-8021 suffix         |
| `raw-rpc`                | `eth_sendTransaction`  | suffix appended to calldata        |
| `x402-buyer`             | x402 paid fetch        | `BuilderCodeClientExtension`       |
| `agent-transaction-tool` | autonomous send        | attributed transaction wrapper     |
