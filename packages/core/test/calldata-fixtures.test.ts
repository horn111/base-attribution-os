import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeAttributionFromCalldata, validateAttribution, type Hex } from "../src/index.js";

interface CalldataFixture {
  source: {
    builderCode: string;
    chainId: number;
    hash: string;
  };
  cases: Array<{
    calldata: Hex;
    expect: string;
    id: string;
    outcome: "attributed" | "invalid" | "missing" | "wrong-code";
    provenance: "derived" | "onchain";
  }>;
}

const fixturePath = fileURLToPath(
  new URL("../../../fixtures/calldata/base-mainnet.json", import.meta.url),
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as CalldataFixture;

describe("Base mainnet calldata fixtures", () => {
  it("keeps the onchain case bound to the published BAO proof", () => {
    const attributed = fixture.cases.find((entry) => entry.id === "attributed");

    expect(fixture.source).toMatchObject({
      builderCode: "bc_vwmzy653",
      chainId: 8453,
      hash: "0x6573344cfb346c886806804fb8f8b6cc510c30d7974a1a69c11452a5f8fe4926",
    });
    expect(attributed?.provenance).toBe("onchain");
    expect(decodeAttributionFromCalldata(attributed!.calldata)?.codes).toEqual([
      fixture.source.builderCode,
    ]);
  });

  it.each(fixture.cases)("classifies $id calldata as $outcome", (entry) => {
    const result = validateAttribution({ calldata: entry.calldata, expect: entry.expect });

    if (entry.outcome === "attributed") {
      expect(result).toMatchObject({ ok: true, codes: [entry.expect], schemaId: 0 });
    } else if (entry.outcome === "wrong-code") {
      expect(result.ok).toBe(false);
      expect(result.codes).toEqual(["bc_other"]);
      expect(result.errors).toContain(`expected Builder Code "${entry.expect}" was not found`);
    } else if (entry.outcome === "missing") {
      expect(result.ok).toBe(false);
      expect(result.errors).toContain("missing ERC-8021 marker");
    } else {
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toContain("even number of digits");
    }
  });
});
