import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

  it("recognizes an attributed smart-wallet call", () => {
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

  it("treats dynamic attribution as a warning in CI and an error in strict mode", () => {
    const source = `import { builderCodeDataSuffix } from "@base-attribution-os/viem";
const dataSuffix = builderCodeDataSuffix(process.env.BUILDER_CODE ?? "");
wallet.sendTransaction({ to, data: "0x", dataSuffix });`;
    const ci = analyzeSource(source, { builderCodes: ["bc_abc123"], profile: "ci" });
    const strict = analyzeSource(source, { builderCodes: ["bc_abc123"], profile: "strict" });

    expect(ci[0]).toMatchObject({ status: "unresolved", severity: "warning" });
    expect(strict[0]).toMatchObject({ status: "unresolved", severity: "error" });
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
