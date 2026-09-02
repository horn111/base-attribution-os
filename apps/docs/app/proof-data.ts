import {
  parseAttributionProofSet,
  type AttributionProofSet,
  type AttributionReplayTransaction,
} from "@base-attribution-os/core";
import stackProofSet from "../../../proofs/sets/bc_4pe6m33m.json";
import baoProofSet from "../../../proofs/sets/bc_vwmzy653.json";

export const publishedProofSets: AttributionProofSet[] = [
  parseAttributionProofSet(baoProofSet),
  parseAttributionProofSet(stackProofSet),
].sort((left, right) => left.title.localeCompare(right.title));

const publishedProofs = new Map(
  publishedProofSets.map((proofSet) => [proofSet.builderCode, proofSet] as const),
);

export const featuredProof = getPublishedProof("bc_vwmzy653") ?? publishedProofSets[0];

const observatoryTransactions = publishedProofSets.flatMap((proofSet) =>
  getPublishedProofTransactions(proofSet).map((entry) => ({
    ...entry,
    builderCode: proofSet.builderCode,
  })),
);
const observatoryAttributed = observatoryTransactions.filter(
  ({ transaction }) => transaction.status === "attributed",
).length;
const observatoryVerified = observatoryTransactions.filter(
  ({ transaction }) => transaction.verified,
).length;
const observatoryVerifiedAttributed = observatoryTransactions.filter(
  ({ transaction }) => transaction.verified && transaction.status === "attributed",
).length;

export const observatorySummary = {
  proofSets: publishedProofSets.length,
  reports: publishedProofSets.reduce((total, proofSet) => total + proofSet.summary.reports, 0),
  transactions: observatoryTransactions.length,
  attributed: observatoryAttributed,
  verified: observatoryVerified,
  verifiedAttributed: observatoryVerifiedAttributed,
  coverage:
    observatoryTransactions.length === 0
      ? 0
      : Math.round((observatoryVerifiedAttributed / observatoryTransactions.length) * 100),
  networks: Array.from(
    new Set(
      publishedProofSets.flatMap((proofSet) =>
        proofSet.summary.networks.map((network) => network.network),
      ),
    ),
  ).sort(),
};

export function getPublishedProof(code: string): AttributionProofSet | undefined {
  return publishedProofs.get(code);
}

export function getPublishedProofTransactions(proofSet: AttributionProofSet) {
  const unique = new Map<
    string,
    { chainId: number; network: string; transaction: AttributionReplayTransaction }
  >();
  for (const report of proofSet.reports) {
    for (const transaction of report.transactions) {
      const key = `${report.chainId}:${transaction.hash.toLowerCase()}`;
      const current = unique.get(key);
      if (!current || (transaction.verified && !current.transaction.verified)) {
        unique.set(key, { chainId: report.chainId, network: report.network, transaction });
      }
    }
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.chainId - right.chainId ||
      left.transaction.hash.toLowerCase().localeCompare(right.transaction.hash.toLowerCase()),
  );
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
