import path from "node:path";
import type { ScanProfile } from "@base-attribution-os/scanner";

export function resolveActionProfile(
  input: string,
  configProfile: ScanProfile | undefined,
): ScanProfile | string {
  return input.trim() || configProfile || "ci";
}

export function resolveFailOnMissing(input: string): boolean {
  return input.trim().length === 0 || input.trim().toLowerCase() !== "false";
}

export function resolveWorkspaceOutput(root: string, output: string): string {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, output);
  const relative = path.relative(resolvedRoot, target);

  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("sarif-output must resolve to a file inside the repository.");
  }

  return target;
}
