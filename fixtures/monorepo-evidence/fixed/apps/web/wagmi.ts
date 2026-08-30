import { useWriteContract } from "wagmi";
import { wagmiClient } from "@fixture/attribution";

void useWriteContract;
wagmiClient.writeContract({ address, abi, functionName: "mint" });
