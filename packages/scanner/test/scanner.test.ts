import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  analyzeProject,
  analyzeSource,
  loadBaoConfig,
  reportToSarif,
  writeBaseline,
  type RuleId,
  type ScanProfile,
} from "../src/index.js";

const execFile = promisify(execFileCallback);

describe("@base-attribution-os/scanner", () => {
  it("reports every transaction path in a source file", () => {
    const paths = analyzeSource(
      `import { createWalletClient } from "viem";
wallet.sendTransaction({ to, data: "0x" });
wallet.writeContract({ address, abi, functionName: "mint" });`,
      { builderCodes: ["bc_abc123"], profile: "ci" },
    );

    expect(paths).toHaveLength(2);
    expect(paths.map((entry) => entry.marker)).toEqual(["sendTransaction", "writeContract"]);
    expect(paths.every((entry) => entry.ruleId === "BAO001")).toBe(true);
  });

  it("does not let an unused helper protect unrelated calls in the same file", () => {
    const paths = analyzeSource(
      `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
const dataSuffix = builderCodeDataSuffix("bc_abc123");
wallet.sendTransaction({ to, data: "0x" });`,
      { builderCodes: ["bc_abc123"], profile: "ci" },
    );

    expect(paths[0]).toMatchObject({ status: "missing", ruleId: "BAO001" });
  });

  it.each([
    'const note = "bc_abc123";',
    '/* "bc_abc123" */',
    'const unrelatedSuffix = "62635f616263313233090080218021802180218021802180218021";',
  ])("does not let unlinked evidence protect a dynamic call: %s", (unlinkedEvidence) => {
    const paths = analyzeSource(
      `${unlinkedEvidence}
const dataSuffix = getSuffixAtRuntime();
wallet.sendTransaction({ to, data: "0x", dataSuffix });`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );

    expect(paths[0]).toMatchObject({
      status: "unresolved",
      ruleId: "BAO003",
      severity: "error",
    });
  });

  it.each(['note: "bc_abc123"', 'note: "62635f616263313233090080218021802180218021802180218021"'])(
    "does not accept unrelated evidence inside a transaction call: %s",
    (unlinkedField) => {
      const paths = analyzeSource(
        `const dataSuffix = getSuffixAtRuntime();
wallet.sendTransaction({ to, data: "0x", dataSuffix, ${unlinkedField} });`,
        { builderCodes: ["bc_abc123"], profile: "strict" },
      );

      expect(paths[0]).toMatchObject({
        status: "unresolved",
        ruleId: "BAO003",
        severity: "error",
      });
    },
  );

  it("does not accept an unrelated field in a linked dataSuffix object", () => {
    const paths = analyzeSource(
      `const dataSuffix = { value: getSuffixAtRuntime(), note: "bc_abc123" };
wallet.sendTransaction({ to, data: "0x", dataSuffix });`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );

    expect(paths[0]).toMatchObject({
      status: "unresolved",
      ruleId: "BAO003",
      severity: "error",
    });
  });

  it("follows a linked local suffix alias to the configured Builder Code", () => {
    const paths = analyzeSource(
      `const configuredCode = "bc_abc123";
const dataSuffix = createDataSuffix({ codes: [configuredCode] });
wallet.sendTransaction({ to, data: "0x", dataSuffix });`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );

    expect(paths[0]).toMatchObject({ status: "protected", confidence: "medium" });
  });

  it("rejects a dataSuffix literal with bytes after the ERC-8021 marker", () => {
    const paths = analyzeSource(
      `wallet.sendTransaction({
  to,
  data: "0x",
  dataSuffix: "0x62635f616263313233090080218021802180218021802180218021ff",
});`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );

    expect(paths[0]).toMatchObject({ status: "unresolved", ruleId: "BAO003" });
  });

  it("recognizes an attributed smart-wallet call", () => {
    const paths = analyzeSource(
      `await wallet.request({ method: "wallet_getCapabilities", params: [account] });
await wallet.sendCalls({
  calls,
  capabilities: {
    dataSuffix: { value: createDataSuffix({ codes: ["bc_abc123"] }), optional: false },
  },
});`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );

    expect(paths[0]).toMatchObject({
      family: "wallet",
      marker: "sendCalls",
      status: "protected",
      confidence: "high",
    });
  });

  it("recognizes the public dataSuffix capability helper", () => {
    const paths = analyzeSource(
      `import { withDataSuffixCapability } from "@base-attribution-os/wallet";
provider.request({
  method: "wallet_sendCalls",
  params: [withDataSuffixCapability(request, { codes: ["bc_abc123"] })],
});`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );

    expect(paths[0]).toMatchObject({ family: "wallet", status: "protected" });
  });

  it("does not accept an unnegotiated dataSuffix capability", () => {
    const paths = analyzeSource(
      `await wallet.sendCalls({
  calls,
  capabilities: {
    dataSuffix: { value: createDataSuffix({ codes: ["bc_abc123"] }), optional: true },
  },
});`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );

    expect(paths[0]).toMatchObject({ status: "missing", ruleId: "BAO005" });
  });

  it("does not accept an optional dataSuffix capability as strict protection", () => {
    const paths = analyzeSource(
      `await wallet.request({ method: "wallet_getCapabilities", params: [account] });
await wallet.sendCalls({
  calls,
  capabilities: {
    dataSuffix: { value: createDataSuffix({ codes: ["bc_abc123"] }), optional: true },
  },
});`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );

    expect(paths[0]).toMatchObject({ status: "missing", ruleId: "BAO005" });
  });

  it("reports non-prefixed wrong Builder Codes as BAO002", () => {
    const paths = analyzeSource(
      `wallet.sendTransaction({
  to,
  dataSuffix: createDataSuffix({ codes: ["morpho"] }),
});`,
      { builderCodes: ["baseapp"], profile: "ci" },
    );

    expect(paths[0]).toMatchObject({ status: "wrong-code", ruleId: "BAO002", severity: "error" });
  });

  it("does not trust a locally declared no-op attribution helper", () => {
    const paths = analyzeSource(
      `function createDataSuffix() { return "0x"; }
wallet.sendTransaction({
  to,
  dataSuffix: createDataSuffix({ codes: ["bc_abc123"] }),
});`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );

    expect(paths[0]).toMatchObject({ status: "unresolved", ruleId: "BAO003" });
  });

  it("recognizes Smart Wallet Attribution Kit helpers and UserOperation sends", () => {
    const helper = analyzeSource(
      `await sendAttributedCalls(provider, request, { codes: ["bc_abc123"] });`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );
    const rawUserOperation = analyzeSource(
      `await provider.request({ method: "eth_sendUserOperation", params: [userOp] });`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );

    expect(helper[0]).toMatchObject({ family: "wallet", status: "protected" });
    expect(rawUserOperation[0]).toMatchObject({
      family: "wallet",
      marker: "eth_sendUserOperation",
      status: "missing",
      ruleId: "BAO005",
    });
  });

  it("uses the smart-wallet rule for missing capabilities", () => {
    const paths = analyzeSource("await wallet.sendCalls({ calls });", {
      builderCodes: ["bc_abc123"],
      profile: "ci",
    });

    expect(paths[0]).toMatchObject({ status: "missing", ruleId: "BAO005" });
  });

  it("recognizes the project-level Privy dataSuffix plugin", async () => {
    const root = await createProject({
      "src/config.ts": `import { PrivyProvider, dataSuffix } from "@privy-io/react-auth";
const suffix = createDataSuffix({ codes: ["bc_abc123"] });
export const config = { plugins: [dataSuffix(createDataSuffix({ codes: ["bc_abc123"] }))] };`,
      "src/send.ts": `import { usePrivy } from "@privy-io/react-auth";
export async function send(wallet) { return wallet.sendTransaction({ to, data: "0x" }); }`,
    });
    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "ci" });

    expect(report.frameworks).toContain("privy");
    expect(report.transactionPaths[0]).toMatchObject({
      family: "privy",
      status: "protected",
      confidence: "medium",
    });
  });

  it("fails strict Privy scans when project configuration is not linked to the provider", async () => {
    const root = await createProject({
      "src/config.ts": `import { dataSuffix } from "@privy-io/react-auth";
export const config = { plugins: [dataSuffix(createDataSuffix({ codes: ["bc_abc123"] }))] };`,
      "src/send.ts": `import { usePrivy } from "@privy-io/react-auth";
export async function send(wallet) { return wallet.sendTransaction({ to, data: "0x" }); }`,
    });
    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "strict" });

    expect(report.ok).toBe(false);
    expect(report.transactionPaths[0]).toMatchObject({
      family: "privy",
      status: "unresolved",
      ruleId: "BAO004",
      severity: "error",
    });
  });

  it("recognizes a strict Privy path linked through its configured provider", async () => {
    const root = await createProject({
      "src/config.ts": `import { dataSuffix } from "@privy-io/react-auth";
import { createDataSuffix } from "@base-attribution-os/core";
export const privyConfig = {
  plugins: [dataSuffix(createDataSuffix({ codes: ["bc_abc123"] }))],
};`,
      "src/app.tsx": `import { PrivyProvider, usePrivy as useAuth } from "@privy-io/react-auth";
import { privyConfig } from "./config";
function SendButton() {
  const { sendTransaction } = useAuth();
  return <button onClick={() => sendTransaction({ to, data: "0x" })}>Send</button>;
}
export function App() {
  return <PrivyProvider appId={appId} config={privyConfig}><SendButton /></PrivyProvider>;
}`,
    });
    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "strict" });

    expect(report.ok).toBe(true);
    expect(report.transactionPaths[0]).toMatchObject({
      family: "privy",
      status: "protected",
      confidence: "medium",
    });
  });

  it("does not let an unrelated export from an evidence file configure Privy", async () => {
    const root = await createProject({
      "src/config.ts": `import { dataSuffix } from "@privy-io/react-auth";
export const privyConfig = {
  plugins: [dataSuffix(createDataSuffix({ codes: ["bc_abc123"] }))],
};
export const unrelated = {};`,
      "src/app.tsx": `import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { unrelated } from "./config";
function SendButton() {
  const { sendTransaction } = usePrivy();
  return <button onClick={() => sendTransaction({ to, data: "0x" })}>Send</button>;
}
export function App() {
  return <PrivyProvider appId={appId} config={unrelated}><SendButton /></PrivyProvider>;
}`,
    });
    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "strict" });

    expect(report.ok).toBe(false);
    expect(report.transactionPaths[0]).toMatchObject({
      status: "unresolved",
      ruleId: "BAO004",
      severity: "error",
    });
  });

  it("recognizes a namespace Privy hook linked through its configured provider", async () => {
    const root = await createProject({
      "src/config.ts": `import { dataSuffix } from "@privy-io/react-auth";
export const privyConfig = {
  plugins: [dataSuffix(createDataSuffix({ codes: ["bc_abc123"] }))],
};`,
      "src/app.tsx": `import { PrivyProvider } from "@privy-io/react-auth";
import * as Privy from "@privy-io/react-auth";
import { privyConfig } from "./config";
function SendButton() {
  const { sendTransaction } = Privy.usePrivy();
  return <button onClick={() => sendTransaction({ to, data: "0x" })}>Send</button>;
}
export function App() {
  return <PrivyProvider appId={appId} config={privyConfig}><SendButton /></PrivyProvider>;
}`,
    });
    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "strict" });

    expect(report.ok).toBe(true);
    expect(report.transactionPaths[0]).toMatchObject({ status: "protected" });
  });

  it("does not link an x402 extension registered on a shadowed client", () => {
    const paths = analyzeSource(
      `import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { BuilderCodeClientExtension } from "@x402/extensions/builder-code";
export function createPaidFetch() {
  const client = new x402Client();
  return wrapFetchWithPayment(fetch, client);
}
export function configureOtherClient(otherClient) {
  const client = otherClient;
  client.registerExtension(new BuilderCodeClientExtension("bc_abc123"));
}`,
      { builderCodes: ["bc_abc123"], profile: "strict" },
    );

    expect(paths).toHaveLength(2);
    expect(paths.every((entry) => entry.status === "missing" && entry.ruleId === "BAO006")).toBe(
      true,
    );
  });

  it("fails strict scans when attribution exists only in another file", async () => {
    const root = await createProject({
      "src/config.ts": `import { createWalletClient } from "viem";
export const client = createWalletClient({ dataSuffix: createDataSuffix({ codes: ["bc_abc123"] }) });`,
      "src/send.ts": `import { createWalletClient } from "viem";
wallet.sendTransaction({ to, data: "0x" });`,
    });
    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "strict" });

    expect(report.ok).toBe(false);
    expect(report.transactionPaths[0]).toMatchObject({
      status: "unresolved",
      ruleId: "BAO004",
      severity: "error",
    });
  });

  it("flags raw RPC calls without an appended suffix", () => {
    const paths = analyzeSource(
      `await window.ethereum.request({
  method: "eth_sendTransaction",
  params: [{ from, to, data: "0x" }],
});`,
      { builderCodes: ["bc_abc123"], profile: "ci" },
    );

    expect(paths[0]).toMatchObject({
      family: "rpc",
      marker: "eth_sendTransaction",
      status: "missing",
      ruleId: "BAO001",
    });
  });

  it("detects aliased, destructured, imported, and computed transaction entrypoints", () => {
    const sources = [
      `const submit = wallet.sendTransaction; submit({ to, data: "0x" });`,
      `const { sendTransaction: submit } = wallet; submit({ to, data: "0x" });`,
      `import { sendTransaction as submit } from "viem/actions"; submit(client, { to, data: "0x" });`,
      `wallet["sendTransaction"]({ to, data: "0x" });`,
    ];

    for (const source of sources) {
      expect(
        analyzeSource(source, { builderCodes: ["bc_abc123"], profile: "strict" })[0],
      ).toMatchObject({
        marker: "sendTransaction",
        status: "missing",
        ruleId: "BAO001",
        severity: "error",
      });
    }
  });

  it("treats dynamic attribution as a warning in CI and an error in strict mode", () => {
    const source = `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
const dataSuffix = builderCodeDataSuffix(process.env.BUILDER_CODE ?? "");
wallet.sendTransaction({ to, data: "0x", dataSuffix });`;
    const ci = analyzeSource(source, { builderCodes: ["bc_abc123"], profile: "ci" });
    const strict = analyzeSource(source, { builderCodes: ["bc_abc123"], profile: "strict" });

    expect(ci[0]).toMatchObject({ status: "unresolved", severity: "warning" });
    expect(strict[0]).toMatchObject({ status: "unresolved", severity: "error" });
  });

  it("fails closed when a source file exceeds the scanner size limit", async () => {
    const root = await createProject({
      "src/huge.ts": `// ${"x".repeat(2 * 1024 * 1024)}`,
    });

    await expect(
      analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "strict" }),
    ).rejects.toThrow("2 MiB source file limit");
  });

  it("suppresses existing findings with a baseline", async () => {
    const root = await createProject({
      "src/send.ts": 'wallet.sendTransaction({ to, data: "0x" });',
    });
    const initial = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "ci" });
    await writeBaseline(initial, ".bao-baseline.json");
    const report = await analyzeProject({
      root,
      builderCodes: ["bc_abc123"],
      profile: "ci",
      baseline: ".bao-baseline.json",
    });

    expect(report.ok).toBe(true);
    expect(report.summary.baseline).toBe(1);
    expect(report.transactionPaths[0].baseline).toBe(true);
  });

  it("keeps baseline fingerprints stable when lines move", async () => {
    const root = await createProject({
      "src/send.ts": 'wallet.sendTransaction({ to, data: "0x" });',
    });
    const initial = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "ci" });
    await writeBaseline(initial, ".bao-baseline.json");
    await writeFile(
      path.join(root, "src/send.ts"),
      '// moved by a comment\nwallet.sendTransaction({ to, data: "0x" });',
    );
    const report = await analyzeProject({
      root,
      builderCodes: ["bc_abc123"],
      profile: "ci",
      baseline: ".bao-baseline.json",
    });

    expect(report.transactionPaths[0].baseline).toBe(true);
  });

  it("gives identical call sites distinct baseline fingerprints", () => {
    const paths = analyzeSource(
      `wallet.sendTransaction({ to, data: "0x" });
wallet.sendTransaction({ to, data: "0x" });`,
      { builderCodes: ["bc_abc123"], profile: "ci" },
    );

    expect(new Set(paths.map((entry) => entry.fingerprint)).size).toBe(2);
  });

  it("emits SARIF with BAO rule IDs and source locations", async () => {
    const root = await createProject({
      "src/send.ts": "wallet.sendCalls({ calls });",
    });
    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "ci" });
    const sarif = reportToSarif(report) as {
      runs: Array<{ results: Array<{ ruleId: string }> }>;
    };

    expect(sarif.runs[0].results[0].ruleId).toBe("BAO005");
  });

  it("omits disabled findings from SARIF", async () => {
    const root = await createProject({
      "src/send.ts": 'wallet.sendTransaction({ to, data: "0x" });',
    });
    const report = await analyzeProject({
      root,
      builderCodes: ["bc_abc123"],
      profile: "strict",
      rules: { "missing-attribution": "off" },
    });
    const sarif = reportToSarif(report) as { runs: Array<{ results: unknown[] }> };

    expect(sarif.runs[0].results).toEqual([]);
  });

  it("writes and reads a project configuration", async () => {
    const root = await createProject({ "src/index.ts": "export {};" });
    await writeFile(
      path.join(root, "bao.config.json"),
      JSON.stringify({ builderCodes: ["bc_abc123"], profile: "ci" }),
    );

    const loaded = await loadBaoConfig(root);
    expect(loaded?.config.builderCodes).toEqual(["bc_abc123"]);
  });

  it("rejects malformed project configuration", async () => {
    const root = await createProject({
      "bao.config.json": JSON.stringify({ builderCodes: [123], profile: "production" }),
    });

    await expect(loadBaoConfig(root)).rejects.toThrow("builderCodes");
  });

  it("matches root files with a double-star exclude", async () => {
    const root = await createProject({
      "send.test.ts": 'wallet.sendTransaction({ to, data: "0x" });',
    });
    const report = await analyzeProject({
      root,
      builderCodes: ["bc_abc123"],
      profile: "ci",
      exclude: ["**/*.test.*"],
    });

    expect(report.checkedFiles).toBe(0);
  });

  it("links workspace package evidence through a re-export barrel", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ private: true, workspaces: ["apps/*", "packages/*"] }),
      "apps/web/src/send.ts": `import { attributedClient } from "@acme/attribution";
attributedClient.sendTransaction({ to, data: "0x" });`,
      "packages/attribution/package.json": JSON.stringify({
        name: "@acme/attribution",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/attribution/src/index.ts": `export { attributedClient } from "./client";`,
      "packages/attribution/src/client.ts": `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";
export const attributedClient = createWalletClient({
  dataSuffix: builderCodeDataSuffix("bc_abc123"),
});`,
    });

    const report = await analyzeProject({
      root,
      builderCodes: ["bc_abc123"],
      profile: "strict",
    });

    expect(report.transactionPaths).toHaveLength(1);
    expect(report.transactionPaths[0]).toMatchObject({ status: "protected", family: "viem" });
    expect(report.transactionPaths[0].evidence[0].file).toBe("packages/attribution/src/client.ts");
  });

  it("links project evidence through a tsconfig path alias", async () => {
    const root = await createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@config/*": ["packages/config/src/*"] } },
      }),
      "src/send.ts": `import { attributedClient } from "@config/client";
attributedClient.writeContract({ address, abi, functionName: "mint" });`,
      "packages/config/src/client.ts": `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";
export const attributedClient = createWalletClient({ dataSuffix: builderCodeDataSuffix("bc_abc123") });`,
    });

    const report = await analyzeProject({
      root,
      builderCodes: ["bc_abc123"],
      profile: "strict",
    });

    expect(report.transactionPaths[0]).toMatchObject({ status: "protected", family: "viem" });
  });

  it("rejects workspace overrides that escape the scan root", async () => {
    const root = await createProject({ "src/index.ts": "export {};" });

    await expect(
      analyzeProject({
        root,
        builderCodes: ["bc_abc123"],
        workspace: { roots: ["../outside"] },
      }),
    ).rejects.toThrow("inside the scan root");
  });

  it("expands changed-since to workspace dependencies and consumers", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "src/send.ts": `import { attributedClient } from "@acme/config";
attributedClient.sendTransaction({ to, data: "0x" });`,
      "packages/config/package.json": JSON.stringify({
        name: "@acme/config",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/config/src/index.ts": `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";
export const attributedClient = createWalletClient({ dataSuffix: builderCodeDataSuffix("bc_abc123") });`,
      "src/unrelated.ts": "export const unrelated = 1;",
    });
    await initializeGit(root);
    await writeFile(
      path.join(root, "packages/config/src/index.ts"),
      `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";
export const attributedClient = createWalletClient({ dataSuffix: builderCodeDataSuffix("bc_abc123") });
export const revision = 2;`,
    );
    await git(root, "add", ".");
    await git(root, "commit", "-m", "change shared config");

    const dependencyReport = await analyzeProject({
      root,
      builderCodes: ["bc_abc123"],
      profile: "strict",
      changedSince: "HEAD~1",
    });
    expect(dependencyReport.checkedFiles).toBe(2);
    expect(dependencyReport.transactionPaths[0]).toMatchObject({ status: "protected" });

    await writeFile(path.join(root, "src/unrelated.ts"), "export const unrelated = 2;");
    await git(root, "add", ".");
    await git(root, "commit", "-m", "change unrelated file");
    const unrelatedReport = await analyzeProject({
      root,
      builderCodes: ["bc_abc123"],
      profile: "strict",
      changedSince: "HEAD~1",
    });
    expect(unrelatedReport.checkedFiles).toBe(1);
    expect(unrelatedReport.transactionPaths).toEqual([]);
  });

  it("reports a linked workspace configuration with the wrong Builder Code as BAO002", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/config/package.json": JSON.stringify({
        name: "@acme/config",
        exports: "./src/index.ts",
      }),
      "packages/config/src/index.ts": `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";
export const client = createWalletClient({ dataSuffix: builderCodeDataSuffix("bc_wrong") });`,
      "src/send.ts": `import { client } from "@acme/config";
client.sendTransaction({ to, data: "0x" });`,
    });

    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "strict" });
    expect(report.transactionPaths[0]).toMatchObject({ status: "wrong-code", ruleId: "BAO002" });
  });

  it("keeps linked dynamic workspace evidence fail-closed", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/config/package.json": JSON.stringify({
        name: "@acme/config",
        exports: "./src/index.ts",
      }),
      "packages/config/src/index.ts": `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";
export const client = createWalletClient({ dataSuffix: builderCodeDataSuffix(process.env.CODE ?? "") });`,
      "src/send.ts": `import { client } from "@acme/config";
client.sendTransaction({ to, data: "0x" });`,
    });

    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "strict" });
    expect(report.transactionPaths[0]).toMatchObject({ status: "unresolved", ruleId: "BAO003" });
  });

  it("handles cyclic star re-exports without losing linked evidence", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/config/package.json": JSON.stringify({
        name: "@acme/config",
        exports: "./src/a.ts",
      }),
      "packages/config/src/a.ts": `export * from "./b";`,
      "packages/config/src/b.ts": `export * from "./a";
export { client } from "./client";`,
      "packages/config/src/client.ts": `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";
export const client = createWalletClient({ dataSuffix: builderCodeDataSuffix("bc_abc123") });`,
      "src/send.ts": `import { client } from "@acme/config";
client.sendTransaction({ to, data: "0x" });`,
    });

    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "strict" });
    expect(report.transactionPaths[0]).toMatchObject({ status: "protected" });
  });

  it("rejects duplicate workspace package names", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/a/package.json": JSON.stringify({ name: "@acme/duplicate" }),
      "packages/a/src/index.ts": "export {};",
      "packages/b/package.json": JSON.stringify({ name: "@acme/duplicate" }),
      "packages/b/src/index.ts": "export {};",
    });

    await expect(analyzeProject({ root, builderCodes: ["bc_abc123"] })).rejects.toThrow(
      "Duplicate workspace package name",
    );
  });

  it("rejects malformed discovered tsconfig files", async () => {
    const root = await createProject({
      "tsconfig.json": "{ invalid",
      "src/index.ts": "export {};",
    });

    await expect(analyzeProject({ root, builderCodes: ["bc_abc123"] })).rejects.toThrow(
      "Invalid tsconfig",
    );
  });

  it("reports computed workspace imports as BAO004 in strict mode", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/config/package.json": JSON.stringify({
        name: "@acme/config",
        exports: "./src/index.ts",
      }),
      "packages/config/src/index.ts": `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";
export const client = createWalletClient({ dataSuffix: builderCodeDataSuffix("bc_abc123") });`,
      "src/send.ts": `const moduleName = "@acme/config";
const { client } = await import(moduleName);
client.sendTransaction({ to, data: "0x" });`,
    });

    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"], profile: "strict" });
    expect(report.transactionPaths[0]).toMatchObject({ status: "unresolved", ruleId: "BAO004" });
  });

  it("rejects malformed pnpm workspace package declarations", async () => {
    const root = await createProject({
      "pnpm-workspace.yaml": "packages: { invalid: true }",
      "src/index.ts": "export {};",
    });

    await expect(analyzeProject({ root, builderCodes: ["bc_abc123"] })).rejects.toThrow(
      "YAML string array",
    );
  });

  it("accepts an empty inline pnpm workspace package array", async () => {
    const root = await createProject({
      "pnpm-workspace.yaml": "packages: []\n\noverrides:\n  example: 1.0.0",
      "src/index.ts": "export {};",
    });

    const report = await analyzeProject({ root, builderCodes: ["bc_abc123"] });
    expect(report.checkedFiles).toBe(1);
  });

  it("rejects explicitly scoped files outside the scan root", async () => {
    const root = await createProject({ "src/index.ts": "export {};" });
    await expect(
      analyzeProject({
        root,
        builderCodes: ["bc_abc123"],
        files: [path.join(root, "..", "outside.ts")],
      }),
    ).rejects.toThrow("inside the scan root");
  });

  const publicFixtures: Array<{
    fixture: string;
    profile: ScanProfile;
    expectedRule: RuleId;
  }> = [
    { fixture: "wagmi-app", profile: "ci", expectedRule: "BAO001" },
    { fixture: "privy-app", profile: "ci", expectedRule: "BAO001" },
    { fixture: "smart-wallet-sendcalls", profile: "ci", expectedRule: "BAO005" },
    { fixture: "base-account-sendcalls", profile: "ci", expectedRule: "BAO005" },
    { fixture: "wallet-user-operation", profile: "ci", expectedRule: "BAO005" },
    { fixture: "multi-code-userop", profile: "ci", expectedRule: "BAO005" },
    { fixture: "multi-file-wallet", profile: "strict", expectedRule: "BAO004" },
    { fixture: "raw-rpc", profile: "ci", expectedRule: "BAO001" },
    { fixture: "x402-buyer", profile: "ci", expectedRule: "BAO006" },
    { fixture: "x402-seller", profile: "ci", expectedRule: "BAO006" },
    { fixture: "agent-transaction-tool", profile: "ci", expectedRule: "BAO001" },
    { fixture: "monorepo-evidence", profile: "strict", expectedRule: "BAO004" },
  ];

  it.each(publicFixtures)("validates the $fixture public fixture", async (fixtureCase) => {
    const { expectedRule, fixture, profile } = fixtureCase;
    const fixturesRoot = fileURLToPath(new URL("../../../fixtures", import.meta.url));
    const builderCodes =
      fixture === "multi-code-userop" ? ["bc_abc123", "bc_partner"] : ["bc_abc123"];
    const broken = await analyzeProject({
      root: path.join(fixturesRoot, fixture, "broken"),
      builderCodes,
      profile,
    });
    const fixed = await analyzeProject({
      root: path.join(fixturesRoot, fixture, "fixed"),
      builderCodes,
      profile,
    });

    expect(broken.ok).toBe(false);
    expect(broken.transactionPaths.some((entry) => entry.ruleId === expectedRule)).toBe(true);
    expect(fixed.ok).toBe(true);
    expect(fixed.summary.protected).toBeGreaterThan(0);
  });
});

async function createProject(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "bao-doctor-"));

  for (const [file, source] of Object.entries(files)) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source);
  }

  return root;
}

async function initializeGit(root: string): Promise<void> {
  await git(root, "init");
  await git(root, "config", "user.email", "scanner@example.test");
  await git(root, "config", "user.name", "BAO Scanner Tests");
  await git(root, "add", ".");
  await git(root, "commit", "-m", "initial");
}

async function git(root: string, ...args: string[]): Promise<void> {
  await execFile("git", args, { cwd: root });
}
