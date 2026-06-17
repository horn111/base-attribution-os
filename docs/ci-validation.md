# CI Validation

The GitHub Action wraps `bao scan-repo` and fails pull requests when transaction
candidate files appear to be missing the expected Builder Code.

```yaml
name: Validate Attribution

on:
  pull_request:

jobs:
  attribution:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: horn111/base-attribution-os/packages/github-action@v0
        with:
          builder-code: bc_abc123
          paths: "src,app,packages,examples"
          profile: "ci"
          fail-on-missing: "true"
```

Use scanner profiles to tune enforcement:

| Profile  | Default behavior                                                 |
| -------- | ---------------------------------------------------------------- |
| `local`  | Reports findings without failing, useful during rollout.         |
| `ci`     | Fails obvious missing or wrong Builder Code usage.               |
| `strict` | Requires the expected Builder Code or suffix in candidate files. |

Scanner v0.3 classifies common transaction markers by family:

| Family   | Markers                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------- |
| `ethers` | `sendTransaction`, `populateTransaction` when ethers usage is detected                                  |
| `viem`   | `sendTransaction`, `writeContract`, `prepareTransactionRequest`                                         |
| `wagmi`  | `useSendTransaction`, `useWriteContract`                                                                |
| `wallet` | `sendCalls`, `wallet_sendCalls`                                                                         |
| `agent`  | `transactionTool`, `agentTransactionTool`, `executeTransaction`, `onchainAction`, `sendTransactionTool` |

Findings include:

- relative file path
- line number
- transaction family
- marker
- reason: `missing-attribution` or `wrong-builder-code`

The scanner is conservative. It should catch obvious regressions without trying
to replace code review.
