# `@base-attribution-os/core`

ERC-8021 Builder Code encoding, decoding, validation, replay, and Proof Set helpers for Base applications.

```bash
pnpm add @base-attribution-os/core
```

```ts
import { appendDataSuffix, createDataSuffix } from "@base-attribution-os/core";

const suffix = createDataSuffix({ codes: ["bc_example"] });
const attributedCalldata = appendDataSuffix("0x1234", { codes: ["bc_example"] });
```

Combine one or more replay reports into a canonical manifest:

```ts
import { createAttributionProofSet } from "@base-attribution-os/core";

const proofSet = createAttributionProofSet([mainnetReport, sepoliaReport], {
  title: "Example project",
  builderCode: "bc_example",
});
```

Builder Codes must match the Base registry format: 1-32 lowercase letters, numbers, or underscores.

[Documentation](https://github.com/horn111/base-attribution-os#readme) · [Issues](https://github.com/horn111/base-attribution-os/issues)
