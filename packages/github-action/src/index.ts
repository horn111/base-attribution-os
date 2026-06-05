import * as core from "@actions/core";
import { scanRepo } from "@base-attribution-os/cli";

async function main(): Promise<void> {
  const builderCode = core.getInput("builder-code", { required: true });
  const repoPath = core.getInput("path") || ".";
  const paths = core
    .getInput("paths")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const failOnMissing = core.getInput("fail-on-missing") !== "false";

  const result = await scanRepo({
    path: repoPath,
    paths,
    builderCode,
    failOnMissing,
  });

  core.info(`Checked ${result.checkedFiles} source file(s).`);
  core.info(`Found ${result.candidateFiles} transaction candidate file(s).`);

  for (const finding of result.findings) {
    core.warning(`${finding.reason} in ${finding.file} near ${finding.marker}`);
  }

  core.setOutput("checked-files", String(result.checkedFiles));
  core.setOutput("candidate-files", String(result.candidateFiles));
  core.setOutput("findings", JSON.stringify(result.findings));

  if (!result.ok) {
    core.setFailed(`Base attribution validation failed with ${result.findings.length} finding(s).`);
  }
}

main().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
