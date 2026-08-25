# Attribution Doctor

Attribution Doctor audits supported transaction paths before they ship. It uses
the TypeScript AST to identify call sites, connect them to Builder Code evidence,
and produce terminal, JSON, or SARIF reports.

## Start

```bash
bao init --builder-code bc_abc123
bao doctor
```

`init` creates `bao.config.json` and reports detected frameworks. It does not
rewrite application code.

`doctor` reports every supported path:

```text
Base Attribution Doctor

Frameworks: smart-wallet, wagmi, x402
Coverage: 3/4 paths protected (75%)

+ wagmi    app/mint.tsx:18 sendTransaction [protected]
+ x402     src/pay.ts:9 x402Client [protected]
! wallet   src/batch.ts:22 sendCalls [missing] BAO005
  Use capability-aware middleware or negotiate wallet_getCapabilities first.
```

## Supported paths

- Privy embedded-wallet transactions and project-level `dataSuffix` config.
- Wagmi and Viem transaction calls and client configuration.
- ethers signers and BAO attribution wrappers.
- raw `eth_sendTransaction` RPC calls.
- Capability-aware EIP-5792 `sendCalls` and `wallet_sendCalls` paths.
- ERC-4337 `eth_sendUserOperation` and BAO UserOperation middleware.
- x402 buyer and seller Builder Code extensions.
- agent transaction tools that send Base transactions.

## Output formats

```bash
bao doctor --format human
bao doctor --format json
bao doctor --format sarif --output bao.sarif
```

Human output is optimized for local work. JSON is the stable automation surface.
SARIF can be uploaded to GitHub Code Scanning.

## Compatibility

`bao scan-repo` remains available for existing workflows. It now delegates to
the Doctor engine and maps the richer report back to the original finding shape.

## Static-analysis boundary

Doctor does not execute application code. Environment-driven attribution is
reported as `unresolved`: a warning in `ci`, and an error in `strict`. This is
deliberate; the scanner reports what it can prove instead of treating any helper
name in the same file as complete coverage.
