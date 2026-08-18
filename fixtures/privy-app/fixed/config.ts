import { createDataSuffix } from "@base-attribution-os/core";
import type { PrivyClientConfig } from "@privy-io/react-auth";

export const privyConfig = {
  dataSuffix: createDataSuffix({ codes: ["bc_abc123"] }),
} satisfies Partial<PrivyClientConfig>;
