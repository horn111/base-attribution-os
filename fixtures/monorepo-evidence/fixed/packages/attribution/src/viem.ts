import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";

export const viemClient = createWalletClient({
  dataSuffix: builderCodeDataSuffix("bc_abc123"),
});
