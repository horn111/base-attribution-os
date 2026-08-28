# @base-attribution-os/scanner

## 0.3.0

### Minor Changes

- a9c6951: Harden attribution before the next public release: enforce the Base Builder Code
  format, require a chain ID for custom registries, preserve adapter prototype and
  method context, validate scanner configuration, stabilize baselines, respect
  rule severity in SARIF, and verify the packed GitHub Action in release smoke
  tests. Recognize the public `withDataSuffixCapability` wallet helper during
  strict scans.

### Patch Changes

- Updated dependencies [a9c6951]
  - @base-attribution-os/core@0.3.0

## 0.2.0

### Minor Changes

- 6a538e3: Add capability-aware EIP-5792 middleware, ERC-4337 UserOperation attribution,
  multi-code merging, UserOperation CLI validation, and stricter smart-wallet
  Doctor coverage.

### Patch Changes

- Updated dependencies [731d226]
  - @base-attribution-os/core@0.2.0

## 0.1.0

### Minor Changes

- Publish the first public Base Attribution OS release with ERC-8021 SDK helpers,
  Attribution Doctor, CLI validation, and GitHub Action enforcement.

### Patch Changes

- Updated dependencies
  - @base-attribution-os/core@0.1.0
