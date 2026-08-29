# CI Validation

The GitHub Action runs Attribution Doctor and fails pull requests when supported
transaction paths are missing verifiable Builder Code attribution.

```yaml
name: Validate Attribution

on:
  pull_request:

permissions:
  contents: read

jobs:
  attribution:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
        with:
          fetch-depth: 0
      - uses: horn111/base-attribution-os/packages/github-action@v0.3.0
        with:
          builder-code: bc_abc123
          profile: "strict"
          changed-only: "false"
          sarif-output: "bao.sarif"
          fail-on-missing: "true"
```

Use scanner profiles to tune enforcement:

| Profile  | Default behavior                                              |
| -------- | ------------------------------------------------------------- |
| `local`  | Reports findings without failing, useful during rollout.      |
| `ci`     | Fails obvious missing or wrong Builder Code usage.            |
| `strict` | Requires every path to match verifiable attribution evidence. |

Attribution Doctor classifies call sites by family:

| Family   | Main evidence                                              |
| -------- | ---------------------------------------------------------- |
| `privy`  | Privy imports and project-level `dataSuffix` configuration |
| `ethers` | ethers transaction calls and BAO signer wrappers           |
| `viem`   | transaction calls and client-level `dataSuffix`            |
| `wagmi`  | Wagmi transaction calls and config evidence                |
| `rpc`    | `eth_sendTransaction` with an appended suffix              |
| `wallet` | `sendCalls` or `wallet_sendCalls` with capabilities        |
| `agent`  | transaction tools with an attributed send path             |
| `x402`   | official buyer or seller Builder Code extensions           |

Findings include:

- relative file path
- line number
- transaction family
- marker
- attribution status and BAO rule ID
- evidence, confidence, and suggested fix

For large existing repos, use `changed-only` or a baseline only as an explicit rollout mode. See
[incremental-adoption.md](incremental-adoption.md). The Action also writes a
coverage table to GitHub Step Summary and can emit SARIF.
