# Contributing

Thanks for helping make Base Builder Code attribution harder to miss.

## Good first contributions

- Add framework examples for real Base apps.
- Improve `bao scan-repo` detection for viem, wagmi, wallets, and agent flows.
- Add tests for calldata captured from real transactions.
- Improve README snippets so teams can integrate in under ten minutes.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## Package workflow

Use Changesets for public package changes:

```bash
pnpm changeset
```

Every PR should explain which attribution path it affects:

- SDK append
- CLI validation
- CI enforcement
- wallet middleware
- agent flow
- docs or launch material

## Attribution cases

If you submit a real-world case, include:

- framework and wallet stack
- Base chain target
- expected Builder Code
- failing transaction or calldata sample, if public
- whether this affects production attribution, local validation, or CI
