# Architecture

Base Attribution OS is a thin orchestration layer. It avoids becoming a hosted
platform in the MVP and focuses on code that developers can run locally, in
apps, and in CI.

## Layers

- Core: ERC-8021 suffix encode, decode, append, and validate.
- Adapters: tiny helpers for viem and wagmi transaction flows.
- CLI: local validation for calldata, transaction hashes, and repository scans.
- GitHub Action: CI wrapper around `bao scan-repo`.
- Examples: reference integrations for apps, wallets, and agents.

## Data flow

```mermaid
sequenceDiagram
  participant App
  participant SDK
  participant Tx as Base Transaction
  participant CLI
  participant CI

  App->>SDK: Builder Code config
  SDK->>App: ERC-8021 dataSuffix
  App->>Tx: send transaction with suffix
  CLI->>Tx: decode or check calldata
  CI->>CLI: scan repo during PR
```

## Boundaries

The MVP does not make reward eligibility decisions, operate a hosted dashboard,
or replace Base.dev. It helps teams ship attribution correctly and prove that it
is present.
