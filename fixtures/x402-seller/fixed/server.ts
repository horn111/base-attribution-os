import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { BUILDER_CODE, declareBuilderCodeExtension } from "@x402/extensions/builder-code";

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [{ scheme: "exact", network: "eip155:8453", price: "$0.001", payTo }],
        extensions: {
          [BUILDER_CODE]: declareBuilderCodeExtension("bc_abc123"),
        },
      },
    },
    new x402ResourceServer(facilitatorClient).register("eip155:8453", new ExactEvmScheme()),
  ),
);
