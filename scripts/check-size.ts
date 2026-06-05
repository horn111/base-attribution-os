import { promises as fs } from "node:fs";
import path from "node:path";

const packagesDir = path.resolve("packages");
const entries = await fs.readdir(packagesDir, { withFileTypes: true }).catch(() => []);

for (const entry of entries) {
  if (!entry.isDirectory()) {
    continue;
  }

  const distDir = path.join(packagesDir, entry.name, "dist");
  const files = await fs.readdir(distDir).catch(() => []);
  const jsFiles = files.filter((file) => file.endsWith(".js") || file.endsWith(".cjs"));

  console.log(`${entry.name}: ${jsFiles.length} built JS file(s)`);
}
