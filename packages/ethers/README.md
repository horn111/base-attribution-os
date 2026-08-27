# `@base-attribution-os/ethers`

Builder Code suffix helpers and a transparent attributed signer wrapper for ethers v6.

```bash
pnpm add @base-attribution-os/ethers ethers
```

```ts
import { createAttributionSigner } from "@base-attribution-os/ethers";

const attributedSigner = createAttributionSigner(signer, {
  codes: ["bc_example"],
});
```

The wrapper preserves the original signer's prototype and method context while adding attribution to populated and sent transactions.

[Integration guide](https://github.com/horn111/base-attribution-os/blob/main/docs/integrations.md) · [Issues](https://github.com/horn111/base-attribution-os/issues)
