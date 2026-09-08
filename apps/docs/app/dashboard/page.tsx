import type { Metadata } from "next";
import { SiteHeader } from "../_components/site-header";
import { dashboardProjects } from "./registry";
import { Dashboard } from "./view";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "Attribution Dashboard | BAO",
  description:
    "See which published Base transactions carry a project's Builder Code. Explore real attribution evidence from Stack the Bag and BAO.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; network?: string }>;
}) {
  const query = await searchParams;
  const project =
    dashboardProjects.find((item) => item.code === query.project) ??
    dashboardProjects.find((item) => item.code === "bc_4pe6m33m") ??
    dashboardProjects[0];
  const network = query.network === "8453" || query.network === "84532" ? query.network : "all";

  return (
    <main className="app-container dashboard-page">
      <SiteHeader current="dashboard" />
      <Dashboard
        key={`${project.code}:${network}`}
        projects={dashboardProjects}
        initialProject={project.code}
        initialNetwork={network}
      />
    </main>
  );
}
