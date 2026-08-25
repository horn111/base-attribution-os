# Smart Wallet Attribution Kit

`@base-attribution-os/wallet` adds ERC-8021 attribution to EIP-5792 batches and
ERC-4337 UserOperations. It checks wallet capabilities before sending and uses
strict delivery by default.

```bash
pnpm add @base-attribution-os/wallet
```

## App-side `wallet_sendCalls`

```ts
import { sendAttributedCalls } from "@base-attribution-os/wallet";

const sent = await sendAttributedCalls(
  provider,
  {
    version: "1.0",
    chainId: "0x2105",
    from: account,
    calls: [{ to, value: "0x0", data: callData }],
  },
  { codes: ["bc_app"] },
);
```

The helper calls `wallet_getCapabilities` for the account and chain before it
calls `wallet_sendCalls`. A supported wallet receives a required
`capabilities.dataSuffix`; an unsupported or unavailable wallet fails before
submission.

For an EIP-1193 provider wrapper:

```ts
import { createAttributionProvider } from "@base-attribution-os/wallet";

const attributedProvider = createAttributionProvider(provider, {
  codes: ["bc_app"],
});
```

`best-effort` is opt-in. It sends an unchanged, explicitly unattributed batch
only when capability discovery cannot confirm support. BAO never retries a
failed `wallet_sendCalls` request and never appends the suffix to individual
inner calls.

```ts
const result = await sendAttributedCalls(provider, request, {
  codes: ["bc_app"],
  fallback: "best-effort",
});

if (result.attribution.delivery === "unattributed") {
  reportAttributionGap(result.attribution.support);
}
```

## Base Account

Use the EIP-1193 provider returned by the Base Account SDK:

```ts
import { createBaseAccountSDK } from "@base-org/account";
import { createAttributionProvider } from "@base-attribution-os/wallet";

const provider = createBaseAccountSDK().getProvider();
const wallet = createAttributionProvider(provider, { codes: ["bc_app"] });
```

The same flow supports Base mainnet (`0x2105`) and Base Sepolia (`0x14a34`).

## Privy

Privy React SDK `3.22.0+` supplies its own plugin for EOA and smart-wallet
transactions. Configure the real plugin rather than a top-level `dataSuffix`
field:

```tsx
import { PrivyProvider, dataSuffix } from "@privy-io/react-auth";
import { createDataSuffix } from "@base-attribution-os/core";

const suffix = createDataSuffix({ codes: ["bc_app"] });

<PrivyProvider appId={appId} config={{ plugins: [dataSuffix(suffix)] }}>
  {children}
</PrivyProvider>;
```

When Privy exposes a Base Account EIP-1193 provider for direct
`wallet_sendCalls`, wrap that provider with `createAttributionProvider`.

## Wallet-side ERC-4337 middleware

Wallets must append attribution to the final `userOp.callData`, after account
execution calldata has been assembled and before the UserOperation is signed.

```ts
import { withUserOperationAttribution } from "@base-attribution-os/wallet";

const buildAttributedUserOperation = withUserOperationAttribution(buildUserOperation, {
  walletCodes: ["bc_wallet"],
});
```

The middleware reads the app `dataSuffix` capability, merges wallet codes before
app codes, removes duplicates, and emits one trailing suffix. Conflicting
schemas or custom registries fail instead of silently dropping a code.

## Verify a UserOperation

```bash
bao check-user-op --input user-op.json --expect bc_wallet,bc_app
```

The input may be a top-level UserOperation or a JSON-RPC object containing it in
`result`. `bao check-tx` continues to inspect UserOperations nested in ERC-4337
v0.6 and v0.7 `handleOps` calldata.

References: [EIP-5792](https://eips.ethereum.org/EIPS/eip-5792),
[Base dataSuffix](https://docs.base.org/base-account/reference/core/capabilities/dataSuffix),
[Base wallet integration](https://docs.base.org/apps/builder-codes/wallet-developers), and
[Privy Builder Codes](https://docs.privy.io/recipes/evm/base-builder-codes).
