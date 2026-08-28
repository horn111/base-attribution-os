import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [{ scheme: "exact", network: "eip155:8453", price: "$0.001", payTo }],
      },
    },
    new x402ResourceServer(facilitatorClient).register("eip155:8453", new ExactEvmScheme()),
  ),
);
