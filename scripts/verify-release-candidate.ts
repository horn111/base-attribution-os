import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

type PackedPackage = {
  dir: string;
  packageName: string;
  path: string;
};

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packagesToVerify = [
  { dir: "packages/core", packageName: "@base-attribution-os/core" },
  { dir: "packages/scanner", packageName: "@base-attribution-os/scanner" },
  { dir: "packages/viem", packageName: "@base-attribution-os/viem" },
  { dir: "packages/cli", packageName: "@base-attribution-os/cli" },
];

const workspace = mkdtempSync(path.join(tmpdir(), "bao-release-candidate-"));
const packDir = path.join(workspace, "packs");
const consumerDir = path.join(workspace, "consumer");

mkdirSync(packDir, { recursive: true });
mkdirSync(consumerDir, { recursive: true });

try {
  log(`workspace: ${workspace}`);
  run("pnpm", ["--filter", "@base-attribution-os/core", "build"], repoRoot);
  run("pnpm", ["--filter", "@base-attribution-os/scanner", "build"], repoRoot);
  run("pnpm", ["--filter", "@base-attribution-os/viem", "build"], repoRoot);
  run("pnpm", ["--filter", "@base-attribution-os/cli", "build"], repoRoot);

  const packed = packagesToVerify.map((packageInfo) => packPackage(packageInfo));
  const dependencySpecs = Object.fromEntries(
    packed.map((entry) => [entry.packageName, toFileDependency(entry.path)]),
  );

  writeFileSync(
    path.join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "bao-release-candidate-consumer",
        private: true,
        type: "module",
        dependencies: dependencySpecs,
        pnpm: {
          overrides: {
            "@base-attribution-os/core": dependencySpecs["@base-attribution-os/core"],
            "@base-attribution-os/scanner": dependencySpecs["@base-attribution-os/scanner"],
          },
        },
      },
      null,
      2,
    ),
  );

  run("pnpm", ["install"], consumerDir);
  run("pnpm", ["exec", "bao", "encode", "--code", "bc_abc123"], consumerDir);

  const encoded = run(
    "pnpm",
    ["exec", "bao", "encode", "--code", "bc_abc123", "--json"],
    consumerDir,
  );
  const suffix = readSuffix(encoded.stdout);
  run(
    "pnpm",
    [
      "exec",
      "bao",
      "check-calldata",
      "--calldata",
      `0x1234${suffix.slice(2)}`,
      "--expect",
      "bc_abc123",
    ],
    consumerDir,
  );

  writeFileSync(
    path.join(consumerDir, "attributed.ts"),
    `import { builderCodeDataSuffix } from "@base-attribution-os/viem";

const dataSuffix = builderCodeDataSuffix("bc_abc123");

await walletClient.sendTransaction({
  account,
  to,
  value,
  data: "0x",
  dataSuffix,
});
`,
  );

  run(
    "pnpm",
    [
      "exec",
      "bao",
      "scan-repo",
      "--path",
      consumerDir,
      "--builder-code",
      "bc_abc123",
      "--profile",
      "strict",
      "--paths",
      "attributed.ts",
    ],
    consumerDir,
  );

  writeFileSync(
    path.join(consumerDir, "bao.config.json"),
    JSON.stringify(
      {
        builderCodes: ["bc_abc123"],
        profile: "strict",
        include: ["attributed.ts"],
      },
      null,
      2,
    ),
  );
  run("pnpm", ["exec", "bao", "doctor"], consumerDir);

  log("release candidate smoke passed");
  log(`packed packages: ${packed.map((entry) => entry.packageName).join(", ")}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (process.env.BAO_KEEP_RELEASE_SMOKE !== "1") {
    rmSync(workspace, { force: true, recursive: true });
  } else {
    log(`kept workspace: ${workspace}`);
  }
}

function packPackage(packageInfo: { dir: string; packageName: string }): PackedPackage {
  const before = new Set(readdirSync(packDir));
  run("pnpm", ["pack", "--pack-destination", packDir], path.join(repoRoot, packageInfo.dir));

  const created = readdirSync(packDir).filter(
    (entry) => !before.has(entry) && entry.endsWith(".tgz"),
  );

  if (created.length !== 1) {
    throw new Error(`Expected one tarball for ${packageInfo.dir}, found ${created.length}`);
  }

  return {
    dir: packageInfo.dir,
    packageName: packageInfo.packageName,
    path: path.join(packDir, created[0]),
  };
}

function toFileDependency(filePath: string): string {
  const relativePath = path.relative(consumerDir, filePath).replaceAll("\\", "/");
  return `file:${relativePath.startsWith(".") ? relativePath : `./${relativePath}`}`;
}

function readSuffix(output: string): string {
  const parsed = JSON.parse(output) as { data?: { suffix?: unknown } };
  const suffix = parsed.data?.suffix;

  if (typeof suffix !== "string" || !suffix.startsWith("0x")) {
    throw new Error("bao encode did not return a hex suffix");
  }

  return suffix;
}

function run(command: string, args: string[], cwd: string): { stdout: string } {
  log(`${command} ${args.join(" ")}`);
  const invocation = resolveCommand(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const shouldPrintOutput = process.env.BAO_VERBOSE_RELEASE_SMOKE === "1";
  const failed = Boolean(result.error) || result.status !== 0;

  if (stdout.trim() && (shouldPrintOutput || failed || isBaoCommand(args))) {
    console.log(stdout.trim());
  }

  if (stderr.trim() && (shouldPrintOutput || failed)) {
    console.error(stderr.trim());
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status ?? "null"}`,
    );
  }

  return { stdout };
}

function isBaoCommand(args: string[]): boolean {
  return args[0] === "exec" && args[1] === "bao";
}

function resolveCommand(command: string, args: string[]): { args: string[]; command: string } {
  if (command === "pnpm" && process.env.npm_execpath) {
    return {
      args: [process.env.npm_execpath, ...args],
      command: process.execPath,
    };
  }

  return { args, command };
}

function log(message: string): void {
  console.log(`[release-smoke] ${message}`);
}
