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
          fail-on-missing: "true"
```

Scanner MVP rules look for common transaction markers:

- `sendTransaction`
- `writeContract`
- `sendCalls`
- `useSendTransaction`
- `useWriteContract`
- `prepareTransactionRequest`
- `dataSuffix`

The scanner is conservative. It should catch obvious regressions without trying
to replace code review.
