# Integrations

## viem

```ts
import { builderCodeDataSuffix } from "@base-attribution-os/viem";

const dataSuffix = builderCodeDataSuffix("bc_abc123");

await walletClient.sendTransaction({
  account,
  to,
  value,
  data: "0x",
  dataSuffix,
});
```

## wagmi

```tsx
import { useAttributionSuffix } from "@base-attribution-os/wagmi";

const dataSuffix = useAttributionSuffix({ codes: ["bc_abc123"] });
```

## ethers

```ts
import { withEthersAttribution } from "@base-attribution-os/ethers";

await signer.sendTransaction(
  withEthersAttribution({ to, value, data: "0x" }, { codes: ["bc_abc123"] }),
);
```

## wallets

Use `@base-attribution-os/wallet` to negotiate `dataSuffix` before
`wallet_sendCalls` and to append combined app/wallet codes to the final
`userOp.callData`.

```ts
import { sendAttributedCalls } from "@base-attribution-os/wallet";

await sendAttributedCalls(provider, request, { codes: ["bc_abc123"] });
```

See [Smart Wallet Attribution Kit](smart-wallet-attribution.md) for Base Account,
Privy, fallback, middleware, and ERC-4337 verification patterns.

## agents

Agent frameworks should keep Builder Code config near their transaction tool
definition. This makes autonomous actions visible and easier to audit.
