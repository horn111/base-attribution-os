import { agentClient } from "@fixture/attribution";

export const agentTransactionTool = () => agentClient.sendTransaction({ to, data: "0x" });
