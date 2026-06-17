# Vercel Demo

The docs app is a live scanner playground for Base Attribution OS. It mirrors
the `bao scan-repo` developer workflow in the browser so teams can try Builder
Code enforcement before installing the packages.

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
