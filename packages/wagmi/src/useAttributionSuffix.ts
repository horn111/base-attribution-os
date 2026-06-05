import { useMemo } from "react";
import { createDataSuffix, type AttributionInput, type Hex } from "@base-attribution-os/core";

export function useAttributionSuffix(attribution: AttributionInput): Hex {
  const key = JSON.stringify(attribution);
  return useMemo(() => createDataSuffix(attribution), [key]);
}
