# SARIF And Code Scanning

Attribution Doctor can emit SARIF 2.1.0 so findings appear alongside other
repository analysis.

```bash
bao doctor --format sarif --output bao.sarif
```

The GitHub Action can create the same file:

```yaml
- uses: horn111/base-attribution-os/packages/github-action@v0.3.0
  with:
    builder-code: bc_abc123
    sarif-output: bao.sarif

- uses: github/codeql-action/upload-sarif@v4
  with:
    sarif_file: bao.sarif
```

The workflow needs `security-events: write` to upload code-scanning results.
Even without SARIF upload, the BAO Action emits inline annotations and a Step
Summary with coverage by transaction family.
