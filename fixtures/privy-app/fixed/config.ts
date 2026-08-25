import { createDataSuffix } from "@base-attribution-os/core";
import { dataSuffix } from "@privy-io/react-auth";

export const privyConfig = {
  plugins: [dataSuffix(createDataSuffix({ codes: ["bc_abc123"] }))],
};
