import { promises as fs } from "node:fs";
import path from "node:path";

const MAX_JS_BYTES: Record<string, number> = {
  cli: 40 * 1024,
  core: 40 * 1024,
  ethers: 10 * 1024,
  "github-action": 12 * 1024 * 1024,
  scanner: 40 * 1024,
  viem: 10 * 1024,
  wagmi: 8 * 1024,
  wallet: 40 * 1024,
};

async function main(): Promise<void> {
  const packagesDir = path.resolve("packages");
  const entries = await fs.readdir(packagesDir, { withFileTypes: true });
  const failures: string[] = [];

  for (const [packageName, budget] of Object.entries(MAX_JS_BYTES)) {
    const entry = entries.find(
      (candidate) => candidate.isDirectory() && candidate.name === packageName,
    );
    if (!entry) {
      failures.push(`${packageName}: package directory is missing`);
      continue;
    }

    const distDir = path.join(packagesDir, packageName, "dist");
    const files = await fs.readdir(distDir, { withFileTypes: true }).catch(() => []);
    const jsFiles = files.filter(
      (file) => file.isFile() && (file.name.endsWith(".js") || file.name.endsWith(".cjs")),
    );
    const sizes = await Promise.all(
      jsFiles.map(async (file) => (await fs.stat(path.join(distDir, file.name))).size),
    );
    const total = sizes.reduce((sum, size) => sum + size, 0);

    console.log(`${packageName}: ${formatBytes(total)} / ${formatBytes(budget)}`);

    if (jsFiles.length === 0) failures.push(`${packageName}: no built JavaScript files found`);
    if (total > budget) failures.push(`${packageName}: bundle exceeds its size budget`);
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
