# Vercel Demo

The docs app is an interactive Attribution Doctor preview. It shows transaction
path coverage across app, wallet, x402, RPC, and agent fixtures.

Production demo: https://base-attribution-os.vercel.app

## Reviewer path

Use this path for grant reviewers:

1. Open Attribution Doctor and select a broken fixture.
2. Observe its rule ID, transaction path, and suggested fix.
3. Switch to `fixed` and show coverage moving to 100%.
4. Try Wagmi, Privy, smart wallet, raw RPC, x402, and agent fixtures.
5. Switch `local`, `ci`, and `strict` profiles.
6. Copy the changed-only GitHub Action YAML.

The demo does not execute transactions or payment flows. It shows the developer
workflow and the grant direction: make attribution visible, testable, and easier
to adopt before teams ship Base activity.

## Vercel settings

Use these settings when importing `horn111/base-attribution-os` into Vercel:

```txt
Framework Preset: Next.js
Root Directory: apps/docs
Install Command: default
Build Command: pnpm vercel-build
Output Directory: default
Environment Variables: none
```

`apps/docs/vercel.json` also pins the build command to `pnpm vercel-build`.

## Local note

The repository currently lives under a Windows path that contains `!`. Next.js
production builds can fail under that path because webpack treats `!` as loader
syntax. Vercel and GitHub Actions do not use that path, so the deployed build is
not affected.
