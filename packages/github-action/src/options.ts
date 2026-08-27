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
