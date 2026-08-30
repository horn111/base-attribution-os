import { sellerExtension } from "@fixture/attribution";
import { paymentMiddleware } from "@x402/express";

paymentMiddleware({ extensions: [sellerExtension] });
