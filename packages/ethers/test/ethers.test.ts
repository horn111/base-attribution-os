import { describe, expect, it } from "vitest";
import { createDataSuffix } from "@base-attribution-os/core";
import {
  createAttributionSigner,
  ethersBuilderCodeDataSuffix,
  withEthersAttribution,
} from "../src/index.js";

describe("@base-attribution-os/ethers", () => {
  it("creates suffixes for a Builder Code", () => {
    expect(ethersBuilderCodeDataSuffix("baseapp")).toBe(createDataSuffix({ codes: ["baseapp"] }));
  });

  it("appends attribution to ethers transaction data", () => {
    const request = withEthersAttribution({ data: "0x1234", to: "0x0" }, { codes: ["baseapp"] });

    expect(request.to).toBe("0x0");
    expect(request.data.startsWith("0x1234")).toBe(true);
    expect(request.data).toContain("80218021802180218021802180218021");
  });

  it("wraps signer transaction methods", async () => {
    const sent: unknown[] = [];
    const signer = createAttributionSigner(
      {
        sendTransaction: (request) => {
          sent.push(request);
          return { hash: "0xabc" };
        },
      },
      { codes: ["baseapp"] },
    );

    await signer.sendTransaction?.({ data: "0x", value: 1n });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      value: 1n,
    });
    expect((sent[0] as { data: string }).data).toContain("80218021802180218021802180218021");
  });
});
