import { getPublishedProofTransactions, publishedProofSets } from "../proof-data";
import type { DashboardProject } from "./data";
import stackAudit from "../../../../proofs/audits/bc_4pe6m33m.json";

// Keep calldata server-side. Serialize only public evidence metadata.
export const dashboardProjects: DashboardProject[] = publishedProofSets.map((proof) => ({
  code: proof.builderCode,
  title: proof.title,
  generatedAt: proof.generatedAt,
  reports: proof.reports.length,
  audit: proof.builderCode === stackAudit.builderCode ? stackAudit : undefined,
  transactions: getPublishedProofTransactions(proof).map(({ chainId, network, transaction }) => ({
    hash: transaction.hash,
    chainId,
    network,
    source: transaction.source ?? "Published transaction",
    status: transaction.status,
    verified: transaction.verified === true,
    codes: transaction.codes,
    blockNumber: transaction.blockNumber,
    timestamp: transaction.timestamp,
    explorerUrl: transaction.explorerUrl,
  })),
}));
