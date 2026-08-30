# `@base-attribution-os/scanner`

AST-backed analysis for finding Base transaction paths and checking whether Builder Code attribution protects them.

```bash
pnpm add @base-attribution-os/scanner
```

```ts
import { analyzeProject } from "@base-attribution-os/scanner";

const report = await analyzeProject({
  root: process.cwd(),
  builderCodes: ["bc_example"],
  profile: "strict",
  workspace: { roots: ["apps/*", "packages/*"] },
});
```

Workspace settings are optional. Standard npm/pnpm workspaces and
`tsconfig*.json` aliases are discovered automatically.

[Scanner documentation](https://github.com/horn111/base-attribution-os/blob/main/docs/configuration.md) · [Issues](https://github.com/horn111/base-attribution-os/issues)
