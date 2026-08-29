import { describe, expect, it } from "vitest";
import { createDataSuffix } from "@base-attribution-os/core";
import {
  builderCodeDataSuffix,
  createAttributionClient,
  withAttributionSuffix,
  withViemDataSuffix,
} from "../src/index.js";

describe("@base-attribution-os/viem", () => {
  it("creates dataSuffix values for a Builder Code", () => {
    expect(builderCodeDataSuffix("baseapp")).toBe(createDataSuffix({ codes: ["baseapp"] }));
  });

  it("can append the suffix directly to transaction data", () => {
    const request = withAttributionSuffix({ data: "0x1234" }, { codes: ["baseapp"] });

    expect(request.data.startsWith("0x1234")).toBe(true);
    expect(request.data).toContain("80218021802180218021802180218021");
  });

  it("can set viem-style dataSuffix fields", () => {
    const request = withViemDataSuffix({ data: "0x1234" }, { codes: ["baseapp"] });

    expect(request.data).toBe("0x1234");
    expect(request.dataSuffix).toBe(createDataSuffix({ codes: ["baseapp"] }));
  });

  it("preserves client prototypes and method context", async () => {
    class DemoClient {
      readonly sent: unknown[] = [];

      ping() {
        return this.sent.length;
      }

      sendTransaction(request: unknown) {
        this.sent.push(request);
        return { hash: "0xabc" };
      }
    }

    const client = new DemoClient();
    const wrapped = createAttributionClient(client, { codes: ["baseapp"] });

    await wrapped.sendTransaction({ data: "0x1234" });

    expect(wrapped).toBeInstanceOf(DemoClient);
    expect(wrapped.ping()).toBe(1);
    expect((client.sent[0] as { data: string }).data).toContain("80218021802180218021802180218021");
  });

  it("uses viem dataSuffix for ABI writeContract requests", async () => {
    const written: unknown[] = [];
    const client = {
      writeContract(request: unknown) {
        written.push(request);
        return { hash: "0xabc" };
      },
    };
    const wrapped = createAttributionClient(client, { codes: ["baseapp"] });

    await wrapped.writeContract({
      address: "0x0000000000000000000000000000000000000001",
      abi: [],
      functionName: "mint",
    });

    expect(written[0]).toMatchObject({
      dataSuffix: createDataSuffix({ codes: ["baseapp"] }),
      functionName: "mint",
    });
    expect(written[0]).not.toHaveProperty("data");
  });
});
