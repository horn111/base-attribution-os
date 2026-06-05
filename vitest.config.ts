import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@base-attribution-os/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
      "@base-attribution-os/viem": fileURLToPath(
        new URL("./packages/viem/src/index.ts", import.meta.url),
      ),
      "@base-attribution-os/wagmi": fileURLToPath(
        new URL("./packages/wagmi/src/index.ts", import.meta.url),
      ),
      "@base-attribution-os/cli": fileURLToPath(
        new URL("./packages/cli/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    include: ["packages/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
