# `@base-attribution-os/wallet`

Builder Code attribution middleware for EIP-5792 wallet calls and ERC-4337 UserOperations.

```bash
pnpm add @base-attribution-os/wallet
```

```ts
import { createAttributionProvider } from "@base-attribution-os/wallet";

const provider = createAttributionProvider(walletProvider, {
  codes: ["bc_example"],
});
```

The package can negotiate `dataSuffix` capabilities, apply safe fallbacks, and validate UserOperation attribution.

[Wallet guide](https://github.com/horn111/base-attribution-os/blob/main/docs/smart-wallet-attribution.md) · [Issues](https://github.com/horn111/base-attribution-os/issues)
