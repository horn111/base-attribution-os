# @base-attribution-os/cli

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
