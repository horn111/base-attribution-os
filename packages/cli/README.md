# `@base-attribution-os/cli`

Command-line validation for Base Builder Code attribution in source code, calldata, transactions, and UserOperations.

```bash
pnpm add -D @base-attribution-os/cli
pnpm exec bao init --builder-code bc_example
pnpm exec bao scan-repo --config bao.config.json --profile strict
pnpm exec bao doctor
pnpm exec bao proof-set --builder-code bc_example --title "Example project" --input proof-a.json,proof-b.json
```

`bao proof-set` validates and combines replay JSON into a deterministic manifest. Use
`--format markdown` for a calldata-free public summary. Run `pnpm exec bao --help`
for the full command list.

[CLI documentation](https://github.com/horn111/base-attribution-os#quickstart) · [Issues](https://github.com/horn111/base-attribution-os/issues)
