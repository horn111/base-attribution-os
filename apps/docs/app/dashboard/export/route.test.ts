import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("public dashboard export", () => {
  it("exports only the selected public sample and distinguishes empty mainnet data", async () => {
    const response = GET(
      new Request("https://example.com/dashboard/export?project=bc_4pe6m33m&network=8453"),
    );
    expect(response.headers.get("Content-Disposition")).toContain("bao-bc_4pe6m33m-8453.json");
    const data = await response.json();
    expect(data.transactions).toEqual([]);
    expect(data.summary.coverage).toBeNull();
    expect(data.sourceAudit.summary.total).toBe(3);
  });
  it("rejects unknown projects and networks instead of falling back to unrelated data", () => {
    expect(
      GET(new Request("https://example.com/dashboard/export?project=constructor")).status,
    ).toBe(400);
    expect(
      GET(new Request("https://example.com/dashboard/export?project=bc_4pe6m33m&network=1")).status,
    ).toBe(400);
  });
  it("exports two real game transactions without raw calldata", async () => {
    const response = GET(
      new Request("https://example.com/dashboard/export?project=bc_4pe6m33m&network=all"),
    );
    const data = await response.json();
    expect(data.transactions).toHaveLength(2);
    expect(data.transactions.every((tx: object) => !("calldata" in tx))).toBe(true);
  });
});
