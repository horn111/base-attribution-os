# Incremental Adoption

Existing applications may have attribution debt. BAO offers two ways to prevent
new regressions without requiring a one-day rewrite.

## Changed files

```bash
bao doctor --changed-since origin/main
```

The GitHub Action exposes the same mode:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: horn111/base-attribution-os/packages/github-action@main
  with:
    builder-code: bc_abc123
    changed-only: "true"
```

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
