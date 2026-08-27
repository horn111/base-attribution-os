---
"@base-attribution-os/core": minor
"@base-attribution-os/scanner": minor
"@base-attribution-os/cli": patch
"@base-attribution-os/ethers": patch
"@base-attribution-os/github-action": patch
"@base-attribution-os/viem": patch
"@base-attribution-os/wagmi": patch
"@base-attribution-os/wallet": patch
---

Harden attribution before the next public release: enforce the Base Builder Code
format, require a chain ID for custom registries, preserve adapter prototype and
method context, validate scanner configuration, stabilize baselines, respect
rule severity in SARIF, and verify the packed GitHub Action in release smoke
tests.
