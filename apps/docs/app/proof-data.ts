export interface PublishedProofTransaction {
  hash: string;
  timestamp: string;
  status: "attributed";
  codes: string[];
  explorerUrl: string;
  source: string;
}

export interface PublishedProofReport {
  builderCode: string;
  chainId: number;
  network: string;
  generatedAt: string;
  coverage: number;
  total: number;
  attributed: number;
  missing: number;
  transactions: PublishedProofTransaction[];
}

const snapshotTransaction = proofSnapshot.transactions[0];
if (!proofSnapshot.ok || !snapshotTransaction || snapshotTransaction.status !== "attributed") {
  throw new Error("Published proof snapshot must contain one verified attributed transaction.");
}

const publishedProof: PublishedProofReport = {
  builderCode: proofSnapshot.builderCode,
  chainId: proofSnapshot.chainId,
  network: proofSnapshot.network,
  generatedAt: proofSnapshot.generatedAt,
  coverage: proofSnapshot.coverage,
  total: proofSnapshot.total,
  attributed: proofSnapshot.attributed,
  missing: proofSnapshot.missing,
  transactions: [
    {
      hash: snapshotTransaction.hash,
      timestamp: `Verified in block ${snapshotTransaction.blockNumber}`,
      status: "attributed",
      codes: snapshotTransaction.codes,
      explorerUrl: snapshotTransaction.explorerUrl,
      source: "BAO onchain proof snapshot",
    },
  ],
};

const publishedProofs: Record<string, PublishedProofReport> = {
  [publishedProof.builderCode]: publishedProof,
};

export const featuredProof = publishedProof;

export function getPublishedProof(code: string): PublishedProofReport | undefined {
  return Object.hasOwn(publishedProofs, code) ? publishedProofs[code] : undefined;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
import proofSnapshot from "../../../proofs/bc_vwmzy653.json";
