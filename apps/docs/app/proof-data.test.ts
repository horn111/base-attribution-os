import { describe, expect, it } from "vitest";
import proofSetSnapshot from "../../../proofs/sets/bc_vwmzy653.json";
import {
  getPublishedProof,
  getPublishedProofTransactions,
  observatorySummary,
  publishedProofSets,
} from "./proof-data.js";

describe("published proof registry", () => {
  it("returns only explicitly published Builder Codes", () => {
    expect(getPublishedProof("bc_vwmzy653")?.builderCode).toBe("bc_vwmzy653");
    expect(getPublishedProof("__proto__")).toBeUndefined();
    expect(getPublishedProof("constructor")).toBeUndefined();
  });

  it("loads both explicit static manifests", () => {
    expect(publishedProofSets.map((proofSet) => proofSet.builderCode).sort()).toEqual([
      "bc_4pe6m33m",
      "bc_vwmzy653",
    ]);
    expect(observatorySummary).toMatchObject({
      proofSets: 2,
      reports: 3,
      transactions: 3,
      attributed: 3,
      verified: 3,
      verifiedAttributed: 3,
      coverage: 100,
    });
  });

  it("derives the public transaction from the canonical proof set", () => {
    const proof = getPublishedProof(proofSetSnapshot.builderCode);
    const transactions = proof ? getPublishedProofTransactions(proof) : [];

    expect(transactions[0]?.transaction).toMatchObject({
      hash: proofSetSnapshot.reports[0].transactions[0].hash,
      codes: proofSetSnapshot.reports[0].transactions[0].codes,
      explorerUrl: proofSetSnapshot.reports[0].transactions[0].explorerUrl,
    });
  });

  it("keeps the Stack direct and nested wallet evidence public", () => {
    const proof = getPublishedProof("bc_4pe6m33m");
    expect(proof?.summary).toMatchObject({ reports: 2, total: 2, verified: 2 });
    expect(
      proof ? getPublishedProofTransactions(proof).map((entry) => entry.transaction.source) : [],
    ).toEqual([
      "Stack the Bag · Coinbase Smart Wallet/ERC-4337 mint",
      "Stack the Bag · direct batch mint",
    ]);
  });
});
