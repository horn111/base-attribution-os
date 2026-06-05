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

## wallets

Wallet middleware should wrap the point where `sendTransaction`, `sendCalls`, or
batched calldata is assembled.

## agents

Agent frameworks should keep Builder Code config near their transaction tool
definition. This makes autonomous actions visible and easier to audit.
