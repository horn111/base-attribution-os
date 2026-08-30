import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";

export const rpcClient = createWalletClient({
  dataSuffix: builderCodeDataSuffix("bc_abc123"),
});
