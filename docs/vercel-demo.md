# Vercel Demo

The docs app is a live playground for Base Attribution OS. It includes the
scanner workflow for Builder Code enforcement and a Migration Planner preview
for Base Pay, internal credits or tickets, entitlements, and attribution.

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
