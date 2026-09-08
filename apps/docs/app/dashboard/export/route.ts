import { dashboardProjects } from "../registry";
import { summarizeTransactions } from "../data";

export function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const project = dashboardProjects.find((item) => item.code === query.get("project"));
  const network = query.get("network") ?? "all";
  if (!project || !["all", "8453", "84532"].includes(network)) {
    return Response.json(
      { error: "Select a published project and supported network." },
      { status: 400 },
    );
  }
  const transactions = project.transactions.filter(
    (tx) => network === "all" || String(tx.chainId) === network,
  );
  return Response.json(
    {
      project: project.title,
      builderCode: project.code,
      snapshotAt: project.generatedAt,
      scope: "Published proof sample only; not all project activity.",
      network,
      summary: summarizeTransactions(transactions),
      transactions,
      sourceAudit: project.audit,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="bao-${project.code}-${network}.json"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
