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

const publishedProofs: Record<string, PublishedProofReport> = {
  bc_vwmzy653: {
    builderCode: "bc_vwmzy653",
    chainId: 8453,
    network: "Base mainnet",
    generatedAt: "2026-08-19T14:27:20.000Z",
    coverage: 100,
    total: 1,
    attributed: 1,
    missing: 0,
    transactions: [
      {
        hash: "0x6573344cfb346c886806804fb8f8b6cc510c30d7974a1a69c11452a5f8fe4926",
        timestamp: "Verified on Base mainnet",
        status: "attributed",
        codes: ["bc_vwmzy653"],
        explorerUrl:
          "https://basescan.org/tx/0x6573344cfb346c886806804fb8f8b6cc510c30d7974a1a69c11452a5f8fe4926",
        source: "BAO onchain proof",
      },
    ],
  },
};

export const featuredProof = publishedProofs.bc_vwmzy653;

export function getPublishedProof(code: string): PublishedProofReport | undefined {
  return publishedProofs[code];
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
