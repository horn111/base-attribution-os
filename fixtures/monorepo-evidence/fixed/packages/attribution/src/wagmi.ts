import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createConfig } from "wagmi";

export const wagmiClient = createConfig({
  dataSuffix: builderCodeDataSuffix("bc_abc123"),
});
