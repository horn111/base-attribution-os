import { describe, expect, it } from "vitest";
import { formatBlock, summarizeTransactions, type DashboardTransaction } from "./data";
import { dashboardProjects } from "./registry";

const transaction: DashboardTransaction = {
  hash: `0x${"1".repeat(64)}`,
  chainId: 8453,
  network: "Base mainnet",
  source: "Test",
  status: "attributed",
  verified: true,
  codes: ["bc_test"],
};

describe("dashboard evidence", () => {
  it("does not claim 0% or 100% coverage when no evidence is published", () => {
    expect(summarizeTransactions([])).toMatchObject({ total: 0, coverage: null, needsReview: 0 });
  });

  it("keeps unavailable, missing, wrong, invalid and unverified transactions in the denominator", () => {
    const result = summarizeTransactions([
      transaction,
      { ...transaction, verified: false },
      { ...transaction, status: "missing-attribution" },
      { ...transaction, status: "wrong-builder-code" },
      { ...transaction, status: "invalid-attribution" },
      { ...transaction, status: "unavailable", verified: false },
    ]);
    expect(result).toMatchObject({
      total: 6,
      confirmed: 1,
      attributed: 2,
      verified: 4,
      needsReview: 5,
    });
    expect(result.coverage).toBeCloseTo(100 / 6);
  });

  it("keeps the game testnet sample separate from mainnet activity and omits calldata", () => {
    const stack = dashboardProjects.find((project) => project.code === "bc_4pe6m33m")!;
    expect(stack.transactions).toHaveLength(2);
    expect(stack.transactions.every((tx) => tx.chainId === 84532)).toBe(true);
    expect(stack.transactions.filter((tx) => tx.chainId === 8453)).toHaveLength(0);
    expect(summarizeTransactions(stack.transactions)).toMatchObject({ total: 2, coverage: 100 });
    expect(stack.transactions.every((tx) => !("calldata" in tx))).toBe(true);
  });

  it("formats hex and numeric block numbers without loss of precision", () => {
    expect(formatBlock("0x2dd765d")).toBe(BigInt("0x2dd765d").toLocaleString("en-US"));
    expect(formatBlock(45830947)).toBe("45,830,947");
    expect(formatBlock("9007199254740993")).toBe("9,007,199,254,740,993");
    expect(formatBlock(undefined)).toBe("Not recorded");
    expect(formatBlock("invalid")).toBe("Not recorded");
  });

  it("keeps the real source audit distinct from onchain sample counts", () => {
    const game = dashboardProjects.find((project) => project.code === "bc_4pe6m33m")!;
    expect(game.audit?.summary.total).toBe(3);
    expect(game.transactions).toHaveLength(2);
    expect(game.audit?.families.reduce((total, family) => total + family.total, 0)).toBe(
      game.audit?.summary.total,
    );
    expect(game.audit?.summary.protected).toBe(
      game.audit?.families.reduce((total, family) => total + family.protected, 0),
    );
    expect(JSON.stringify(game.audit)).not.toContain("C:");
    expect(
      dashboardProjects.find((project) => project.code === "bc_vwmzy653")?.audit,
    ).toBeUndefined();
  });
});
