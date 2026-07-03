# Fallow Pre-Grant Audit Summary

Date: July 3, 2026

Fallow version: `2.104.0`

Purpose: run a one-time static quality audit before submitting Base Attribution
OS for Base/Coinbase ecosystem-style funding.

## Commands

Raw reports were generated outside the repository in `C:\tmp\bao-fallow`:

```powershell
corepack pnpm@9.15.4 dlx fallow audit --format json --quiet > C:\tmp\bao-fallow\audit.json
corepack pnpm@9.15.4 dlx fallow health --score --hotspots --targets --format json --quiet > C:\tmp\bao-fallow\health.json
corepack pnpm@9.15.4 dlx fallow dead-code --format json --quiet > C:\tmp\bao-fallow\dead-code.json
```

Raw JSON reports are not committed. This file is the reviewer-facing summary.

## Results

| Check                    | Result                                                                      |
| ------------------------ | --------------------------------------------------------------------------- |
| Audit gate               | Pass                                                                        |
| Files analyzed           | 45                                                                          |
| Functions analyzed       | 158                                                                         |
| Average maintainability  | 95.1                                                                        |
| Unresolved imports       | 0                                                                           |
| Circular dependencies    | 0                                                                           |
| Unused files             | 0                                                                           |
| Initial dead-code issues | 5 findings: 2 unused exports and 3 unused example dependencies              |
| Hotspots                 | Docs demo page and CLI scanner are the main files to watch during iteration |

## Fixed

- Removed the unused public export marker from `SCAN_PROFILES` while preserving
  the exported `ScanProfile` type.
- Made internal `bytesToHex` non-exported; it is still used by `stringToHex`.
- Removed unused example dependencies from the Next/wagmi example:
  `@tanstack/react-query`, `viem`, and `wagmi`.
- Updated the lockfile importer for the example workspace.

## Accepted

- `apps/docs/app/page.tsx` remains a known demo hotspot. It is intentionally a
  compact client-side playground for grant reviewers and should be split only
  after the grant-facing demo stabilizes.
- `packages/cli/src/commands/scan-repo.ts` remains a scanner hotspot. It already
  has focused CLI tests; AST-backed scanning and parser extraction are better
  follow-up work than a rushed pre-submit refactor.
- Generated GitHub Action bundle output is not treated as audit source.

## Follow-Up

- Re-run Fallow after this cleanup if a final machine-verifiable report is
  needed for the grant packet.
- Split the demo page into smaller components once the scanner UI stops changing
  weekly.
- Extract scanner pattern definitions and matching utilities before expanding
  beyond regex-based detection.

## Final Status

The audit found no unresolved imports, no circular dependencies, no unused files,
and high average maintainability. The actionable dead-code findings were fixed.
Remaining items are documented maintenance follow-ups, not blockers for grant
submission.
