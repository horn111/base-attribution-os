# @base-attribution-os/cli

## 0.3.0

### Minor Changes

- da51f38: Resolve Builder Code evidence across bounded monorepo imports, workspace packages, tsconfig aliases, and re-export chains, including dependency-aware changed-only scans.

### Patch Changes

- 61f0b9f: Reject malformed ERC-8021 code lists and require transaction-linked attribution evidence in strict repository scans.
- Updated dependencies [61f0b9f]
- Updated dependencies [8514766]
- Updated dependencies [da51f38]
  - @base-attribution-os/core@0.3.1
  - @base-attribution-os/scanner@0.4.0
  - @base-attribution-os/wallet@0.1.2

## 0.2.1

### Patch Changes

- a9c6951: Harden attribution before the next public release: enforce the Base Builder Code
  format, require a chain ID for custom registries, preserve adapter prototype and
  method context, validate scanner configuration, stabilize baselines, respect
  rule severity in SARIF, and verify the packed GitHub Action in release smoke
  tests.
- Updated dependencies [a9c6951]
  - @base-attribution-os/core@0.3.0
  - @base-attribution-os/scanner@0.3.0
  - @base-attribution-os/wallet@0.1.1

## 0.2.0

### Minor Changes

- 731d226: Add Attribution Proof Loop reports, Dune JSON and CSV replay, batched RPC
  transaction fetching, Markdown proof output, and the `bao replay` and
  `bao proof` commands.
- 6a538e3: Add capability-aware EIP-5792 middleware, ERC-4337 UserOperation attribution,
  multi-code merging, UserOperation CLI validation, and stricter smart-wallet
  Doctor coverage.

### Patch Changes

- edf4656: Validate ERC-8021 attribution inside ERC-4337 `handleOps` UserOperation calldata.
- Updated dependencies [731d226]
- Updated dependencies [6a538e3]
  - @base-attribution-os/core@0.2.0
  - @base-attribution-os/wallet@0.1.0
  - @base-attribution-os/scanner@0.2.0

## 0.1.0

### Minor Changes

- Publish the first public Base Attribution OS release with ERC-8021 SDK helpers,
  Attribution Doctor, CLI validation, and GitHub Action enforcement.

### Patch Changes

- 0506a04: Add ethers attribution helpers and scanner profiles for local, CI, and strict enforcement.
- 949eba7: Add scanner v0.2 patterns for viem, wagmi, wallet sendCalls, and agent transaction tools.
- Updated dependencies
  - @base-attribution-os/core@0.1.0
  - @base-attribution-os/scanner@0.1.0
