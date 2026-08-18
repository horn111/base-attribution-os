import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject, analyzeSource, reportToSarif, writeBaseline } from "../src/index.js";

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
      `await wallet.sendCalls({
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

  it("uses the smart-wallet rule for missing capabilities", () => {
    const paths = analyzeSource("await wallet.sendCalls({ calls });", {
      builderCodes: ["bc_abc123"],
      profile: "ci",
    });

    expect(paths[0]).toMatchObject({ status: "missing", ruleId: "BAO005" });
  });

  it("detects Privy and project-level attribution configuration", async () => {
    const root = await createProject({
      "src/config.ts": `import { PrivyProvider } from "@privy-io/react-auth";
const dataSuffix = createDataSuffix({ codes: ["bc_abc123"] });
export const config = { dataSuffix };`,
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

  it("writes and reads a project configuration", async () => {
    const root = await createProject({ "src/index.ts": "export {};" });
    await writeFile(
      path.join(root, "bao.config.json"),
      JSON.stringify({ builderCodes: ["bc_abc123"], profile: "ci" }),
    );

    const source = await readFile(path.join(root, "bao.config.json"), "utf8");
    expect(source).toContain("bc_abc123");
  });

  it.each([
    "wagmi-app",
    "privy-app",
    "smart-wallet-sendcalls",
    "raw-rpc",
    "x402-buyer",
    "agent-transaction-tool",
  ])("validates the %s public fixture", async (fixture) => {
    const fixturesRoot = fileURLToPath(new URL("../../../fixtures", import.meta.url));
    const broken = await analyzeProject({
      root: path.join(fixturesRoot, fixture, "broken"),
      builderCodes: ["bc_abc123"],
      profile: "ci",
    });
    const fixed = await analyzeProject({
      root: path.join(fixturesRoot, fixture, "fixed"),
      builderCodes: ["bc_abc123"],
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
