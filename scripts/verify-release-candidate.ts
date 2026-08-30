import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  { dir: "packages/wallet", packageName: "@base-attribution-os/wallet" },
  { dir: "packages/scanner", packageName: "@base-attribution-os/scanner" },
  { dir: "packages/viem", packageName: "@base-attribution-os/viem" },
  { dir: "packages/wagmi", packageName: "@base-attribution-os/wagmi" },
  { dir: "packages/ethers", packageName: "@base-attribution-os/ethers" },
  { dir: "packages/cli", packageName: "@base-attribution-os/cli" },
  {
    dir: "packages/github-action",
    packageName: "@base-attribution-os/github-action",
  },
];

const workspace = mkdtempSync(path.join(tmpdir(), "bao-release-candidate-"));
const packDir = path.join(workspace, "packs");
const consumerDir = path.join(workspace, "consumer");

mkdirSync(packDir, { recursive: true });
mkdirSync(consumerDir, { recursive: true });

try {
  log(`workspace: ${workspace}`);
  for (const packageInfo of packagesToVerify) {
    run("pnpm", ["--filter", packageInfo.packageName, "build"], repoRoot);
  }

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
        workspaces: ["apps/*", "packages/*"],
        dependencies: dependencySpecs,
        pnpm: {
          overrides: dependencySpecs,
        },
      },
      null,
      2,
    ),
  );

  run("pnpm", ["install"], consumerDir);
  writeFileSync(
    path.join(consumerDir, "sdk-smoke.mjs"),
    `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { ethersBuilderCodeDataSuffix } from "@base-attribution-os/ethers";
import { createAttributionConfig } from "@base-attribution-os/wagmi";
import { attributeUserOperation, sendAttributedCalls } from "@base-attribution-os/wallet";

const code = "bc_abc123";
const viemSuffix = builderCodeDataSuffix(code);
const ethersSuffix = ethersBuilderCodeDataSuffix(code);
const wagmiSuffix = createAttributionConfig({ builderCode: code }).dataSuffix;

if (viemSuffix !== ethersSuffix || viemSuffix !== wagmiSuffix) {
  throw new Error("SDK adapters produced different Builder Code suffixes");
}

const calls = [];
const provider = {
  async request(request) {
    calls.push(request);
    if (request.method === "wallet_getCapabilities") {
      return { "0x2105": { dataSuffix: { supported: true } } };
    }
    return "0xbatch";
  },
};
const sent = await sendAttributedCalls(
  provider,
  {
    chainId: "0x2105",
    from: "0x1111111111111111111111111111111111111111",
    calls: [{ to: "0x2222222222222222222222222222222222222222", data: "0x" }],
  },
  { codes: [code] },
);
const userOperation = attributeUserOperation(
  { callData: "0x1234" },
  { walletCodes: ["bc_wallet"], appDataSuffix: viemSuffix },
);

if (
  sent.attribution.delivery !== "dataSuffix" ||
  calls.map((request) => request.method).join(",") !==
    "wallet_getCapabilities,wallet_sendCalls" ||
  !userOperation.callData.endsWith("80218021802180218021802180218021")
) {
  throw new Error("Smart Wallet Attribution Kit smoke failed");
}

console.log("SDK adapter smoke passed");
`,
  );
  run("node", ["sdk-smoke.mjs"], consumerDir);
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
    path.join(consumerDir, "user-op.json"),
    JSON.stringify({ result: { callData: `0x1234${suffix.slice(2)}` } }, null, 2),
  );
  run(
    "pnpm",
    ["exec", "bao", "check-user-op", "--input", "user-op.json", "--expect", "bc_abc123"],
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

  mkdirSync(path.join(consumerDir, "packages/attribution/src"), { recursive: true });
  mkdirSync(path.join(consumerDir, "apps/web"), { recursive: true });
  writeFileSync(
    path.join(consumerDir, "packages/attribution/package.json"),
    JSON.stringify(
      {
        name: "@smoke/attribution",
        exports: { ".": "./src/index.ts", "./*": "./src/*.ts" },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(consumerDir, "packages/attribution/src/index.ts"),
    'export { attributedClient } from "./client";\n',
  );
  writeFileSync(
    path.join(consumerDir, "packages/attribution/src/client.ts"),
    `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";

export const attributedClient = createWalletClient({
  dataSuffix: builderCodeDataSuffix("bc_abc123"),
});
`,
  );
  writeFileSync(
    path.join(consumerDir, "apps/web/package-import.ts"),
    `import { attributedClient } from "@smoke/attribution";
attributedClient.sendTransaction({ to, data: "0x" });
`,
  );
  writeFileSync(
    path.join(consumerDir, "apps/web/alias-import.ts"),
    `import { attributedClient } from "@smoke/config/client";
attributedClient.writeContract({ address, abi, functionName: "mint" });
`,
  );
  writeFileSync(
    path.join(consumerDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          baseUrl: ".",
          paths: { "@smoke/config/*": ["packages/attribution/src/*"] },
        },
      },
      null,
      2,
    ),
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
        include: ["attributed.ts", "apps", "packages"],
        workspace: {
          roots: ["packages/*"],
          tsconfig: ["tsconfig.json"],
        },
      },
      null,
      2,
    ),
  );
  run(
    "pnpm",
    ["exec", "bao", "scan-repo", "--path", consumerDir, "--config", "bao.config.json"],
    consumerDir,
  );
  run("pnpm", ["exec", "bao", "doctor"], consumerDir);

  const actionSummary = path.join(consumerDir, "action-summary.md");
  const actionOutput = path.join(consumerDir, "action-output.txt");
  writeFileSync(actionSummary, "");
  writeFileSync(actionOutput, "");
  run("node", ["node_modules/@base-attribution-os/github-action/dist/index.cjs"], consumerDir, {
    GITHUB_OUTPUT: actionOutput,
    GITHUB_STEP_SUMMARY: actionSummary,
    "INPUT_BASE-REF": "",
    INPUT_BASELINE: "",
    "INPUT_BUILDER-CODE": "",
    "INPUT_CHANGED-ONLY": "false",
    INPUT_CONFIG: "bao.config.json",
    "INPUT_FAIL-ON-MISSING": "true",
    INPUT_PATH: consumerDir,
    INPUT_PATHS: "",
    INPUT_PROFILE: "",
    "INPUT_SARIF-OUTPUT": "action-results.sarif",
  });

  if (!existsSync(path.join(consumerDir, "action-results.sarif"))) {
    throw new Error("GitHub Action smoke did not create SARIF output");
  }
  if (!readFileSync(actionOutput, "utf8").includes("strict")) {
    throw new Error("GitHub Action smoke did not apply the config profile");
  }

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

function run(
  command: string,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
): { stdout: string } {
  log(`${command} ${args.join(" ")}`);
  const invocation = resolveCommand(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "true",
      ...extraEnv,
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
