# `@base-attribution-os/wagmi`

Wagmi configuration and React helpers for Base Builder Code attribution.

```bash
pnpm add @base-attribution-os/wagmi wagmi
```

```ts
import { createAttributionConfig } from "@base-attribution-os/wagmi";

const config = createAttributionConfig({
  ...wagmiConfig,
  codes: ["bc_example"],
});
```

[Wagmi guide](https://github.com/horn111/base-attribution-os/blob/main/docs/integrations.md) · [Issues](https://github.com/horn111/base-attribution-os/issues)
