# x402 Builder Codes in CI

Update 4 adds x402-aware attribution checks to Base Attribution OS. The goal is
simple: x402 teams should be able to use the official Builder Code extensions
and then let CI catch missing attribution before deploy.

Official setup reference:
[Coinbase x402 Builder Codes](https://docs.cdp.coinbase.com/x402/builder-code.skill).

BAO does not replace the x402 SDK. It does not execute payments, verify
facilitator responses, or decide reward eligibility. It scans the repo for x402
buyer and seller payment paths and checks that Builder Code attribution is wired
into those paths.

## Buyer or client path

Official x402 clients can attach a Builder Code with
`BuilderCodeClientExtension`:

```ts
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { BuilderCodeClientExtension } from "@x402/extensions/builder-code";

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));
client.registerExtension(new BuilderCodeClientExtension("bc_abc123"));

export const fetchWithPayment = wrapFetchWithPayment(fetch, client);
```

`bao scan-repo` treats x402 client code as a candidate when it sees markers such
as `x402Client`, `wrapFetchWithPayment`, `registerExtension`, or
`BuilderCodeClientExtension`.

## Seller or resource server path

Official x402 resource servers can declare a Builder Code on paid routes:

```ts
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
```

The scanner treats seller code as a candidate when it sees markers such as
`paymentMiddleware`, `x402ResourceServer`, `BUILDER_CODE`, or
`declareBuilderCodeExtension`.

## CI example

```yaml
name: Validate Attribution

on:
  pull_request:

jobs:
  attribution:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: horn111/base-attribution-os/packages/github-action@v0
        with:
          builder-code: bc_abc123
          paths: "src,app,packages"
          profile: "ci"
```

Use `profile: "ci"` when Builder Codes are environment-driven and the repo only
needs to prove that the official x402 attribution extension is present. Use
`profile: "strict"` when a production path must include the expected literal
Builder Code or suffix in the candidate file.

## What BAO checks

- x402 buyer/client paths should not ship without `BuilderCodeClientExtension`
  or an equivalent recognized attribution helper.
- x402 seller/resource-server paths should not ship without
  `declareBuilderCodeExtension`.
- Literal wrong Builder Codes, such as `bc_wrong` when CI expects `bc_abc123`,
  are reported as `wrong-builder-code`.
- Findings include the file, line, `x402` family, and marker that triggered the
  scan.

## Limitations

- No payment execution.
- No facilitator or settlement verification.
- No hosted payment processor behavior.
- No reward eligibility oracle.
- Regex-based scanning only; AST-backed validation is a future roadmap item.
