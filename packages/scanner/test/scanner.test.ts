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

  it.each([
    "wagmi-app",
    "privy-app",
    "smart-wallet-sendcalls",
    "base-account-sendcalls",
    "wallet-user-operation",
    "multi-code-userop",
    "raw-rpc",
    "x402-buyer",
    "agent-transaction-tool",
  ])("validates the %s public fixture", async (fixture) => {
    const fixturesRoot = fileURLToPath(new URL("../../../fixtures", import.meta.url));
    const builderCodes =
      fixture === "multi-code-userop" ? ["bc_abc123", "bc_partner"] : ["bc_abc123"];
    const broken = await analyzeProject({
      root: path.join(fixturesRoot, fixture, "broken"),
      builderCodes,
      profile: "ci",
    });
    const fixed = await analyzeProject({
      root: path.join(fixturesRoot, fixture, "fixed"),
      builderCodes,
      profile: "ci",
    });

    expect(broken.ok).toBe(false);
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
