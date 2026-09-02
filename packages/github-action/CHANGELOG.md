# @base-attribution-os/github-action

## 0.2.1

### Patch Changes

- Updated dependencies [a9fe1ee]
  - @base-attribution-os/cli@0.4.0
  - @base-attribution-os/scanner@0.4.1

## 0.2.0

### Minor Changes

- da51f38: Resolve Builder Code evidence across bounded monorepo imports, workspace packages, tsconfig aliases, and re-export chains, including dependency-aware changed-only scans.

### Patch Changes

- 61f0b9f: Reject malformed ERC-8021 code lists and require transaction-linked attribution evidence in strict repository scans.
- Updated dependencies [61f0b9f]
- Updated dependencies [da51f38]
  - @base-attribution-os/scanner@0.4.0
  - @base-attribution-os/cli@0.3.0

## 0.1.2

### Patch Changes

- a9c6951: Harden attribution before the next public release: enforce the Base Builder Code
  format, require a chain ID for custom registries, preserve adapter prototype and
  method context, validate scanner configuration, stabilize baselines, respect
  rule severity in SARIF, and verify the packed GitHub Action in release smoke
  tests.
- Updated dependencies [a9c6951]
  - @base-attribution-os/scanner@0.3.0
  - @base-attribution-os/cli@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [edf4656]
- Updated dependencies [731d226]
- Updated dependencies [6a538e3]
  - @base-attribution-os/cli@0.2.0
  - @base-attribution-os/scanner@0.2.0

## 0.1.0

### Minor Changes

- Publish the first public Base Attribution OS release with ERC-8021 SDK helpers,
  Attribution Doctor, CLI validation, and GitHub Action enforcement.
- Run the Action as a CommonJS bundle on the Node.js 24 runtime.

### Patch Changes

- 0506a04: Add ethers attribution helpers and scanner profiles for local, CI, and strict enforcement.
- 949eba7: Add scanner v0.2 patterns for viem, wagmi, wallet sendCalls, and agent transaction tools.
- Updated dependencies [0506a04]
- Updated dependencies
- Updated dependencies [949eba7]
  - @base-attribution-os/cli@0.1.0
  - @base-attribution-os/scanner@0.1.0
