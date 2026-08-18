import { x402Client } from "@x402/fetch";
import { BuilderCodeClientExtension } from "@x402/extensions/builder-code";

export const client = new x402Client();
client.registerExtension(new BuilderCodeClientExtension("bc_abc123"));
