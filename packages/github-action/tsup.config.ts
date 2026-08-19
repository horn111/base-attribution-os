import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node24",
  bundle: true,
  clean: true,
  dts: false,
  noExternal: [/.*/],
  outExtension: () => ({ js: ".cjs" }),
});
