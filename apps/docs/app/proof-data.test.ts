import { describe, expect, it } from "vitest";
import proofSnapshot from "../../../proofs/bc_vwmzy653.json";
import { getPublishedProof } from "./proof-data.js";

describe("published proof registry", () => {
  it("returns only explicitly published Builder Codes", () => {
    expect(getPublishedProof("bc_vwmzy653")?.builderCode).toBe("bc_vwmzy653");
    expect(getPublishedProof("__proto__")).toBeUndefined();
    expect(getPublishedProof("constructor")).toBeUndefined();
  });

  it("derives the public transaction from the canonical proof snapshot", () => {
    const proof = getPublishedProof(proofSnapshot.builderCode);

    expect(proof?.transactions[0]).toMatchObject({
      hash: proofSnapshot.transactions[0].hash,
      codes: proofSnapshot.transactions[0].codes,
      explorerUrl: proofSnapshot.transactions[0].explorerUrl,
    });
  });
});
