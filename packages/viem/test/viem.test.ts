import { describe, expect, it } from "vitest";
import { createDataSuffix } from "@base-attribution-os/core";
import { builderCodeDataSuffix, withAttributionSuffix, withViemDataSuffix } from "../src/index.js";

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
});
