# `@base-attribution-os/viem`

Builder Code suffix helpers and a transparent attributed client wrapper for viem.

```bash
pnpm add @base-attribution-os/viem viem
```

```ts
import { createAttributionClient } from "@base-attribution-os/viem";

const attributedClient = createAttributionClient(client, {
  codes: ["bc_example"],
});
```

The wrapper preserves the original client's prototype and method context while adding attribution to transaction data.

[Integration guide](https://github.com/horn111/base-attribution-os/blob/main/docs/integrations.md) · [Issues](https://github.com/horn111/base-attribution-os/issues)
