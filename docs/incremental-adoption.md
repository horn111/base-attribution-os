# Incremental Adoption

Existing applications may have attribution debt. BAO offers two ways to prevent
new regressions without requiring a one-day rewrite.

## Impacted workspace files

```bash
bao doctor --changed-since origin/main
```

The GitHub Action exposes the same mode:

```yaml
- uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
  with:
    fetch-depth: 0
- uses: horn111/base-attribution-os/packages/github-action@v0.5.0
  with:
    builder-code: bc_abc123
    changed-only: "true"
```

BAO builds the bounded workspace import graph before filtering. A change to a
shared wrapper or attribution config therefore checks both its dependencies
and transaction-path consumers. Unrelated source files remain outside the
impacted closure.

## Baseline

Record existing findings:

```bash
bao doctor --write-baseline .bao-baseline.json
```

Then reference the file in `bao.config.json`:

```json
{
  "builderCodes": ["bc_abc123"],
  "profile": "ci",
  "baseline": ".bao-baseline.json"
}
```

Baseline findings remain visible in reports but do not fail CI. New findings do.
Regenerate the baseline only after reviewing the diff.
