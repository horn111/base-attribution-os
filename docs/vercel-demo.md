# Vercel Demo

The docs app is a live playground for Base Attribution OS. It includes the
scanner workflow for Builder Code enforcement across x402, SDK, wallet, and
agent transaction paths.

Production demo: https://base-attribution-os.vercel.app

## Reviewer path

Use this path for grant reviewers:

1. Open the Scanner playground.
2. Select `x402 client` to show a missing Builder Code extension.
3. Select `x402 seller` to show a passing official Builder Code extension.
4. Select ethers, viem, wagmi, wallet, and agent examples to show scanner
   coverage.
5. Switch `local`, `ci`, and `strict` profiles to show rollout controls.
6. Copy the GitHub Action YAML.

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
