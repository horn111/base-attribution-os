import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendDataSuffix } from "@base-attribution-os/core";
import {
  checkUserOperationCommand,
  checkUserOperationFileCommand,
} from "../src/commands/check-user-op.js";

describe("checkUserOperationCommand", () => {
  it("validates all expected codes in userOp.callData", () => {
    const result = checkUserOperationCommand({
      userOperation: {
        callData: appendDataSuffix("0x1234", { codes: ["bc_wallet", "bc_app"] }),
      },
      expect: ["bc_wallet", "bc_app"],
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      codes: ["bc_wallet", "bc_app"],
      attributionPath: "userOp.callData",
    });
  });

  it("reports malformed and unattributed callData", () => {
    expect(checkUserOperationCommand({ userOperation: { callData: "0x123" } }).ok).toBe(false);
    expect(checkUserOperationCommand({ userOperation: { callData: "0x1234" } }).message).toContain(
      "missing ERC-8021 marker",
    );
  });

  it("reads top-level and JSON-RPC result UserOperations", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bao-user-op-"));
    const callData = appendDataSuffix("0xabcd", { codes: ["bc_app"] });
    const directPath = path.join(root, "direct.json");
    const rpcPath = path.join(root, "rpc.json");
    await writeFile(directPath, JSON.stringify({ sender: "0x1", callData }));
    await writeFile(rpcPath, JSON.stringify({ jsonrpc: "2.0", result: { callData } }));

    await expect(
      checkUserOperationFileCommand({ input: directPath, expect: "bc_app" }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      checkUserOperationFileCommand({ input: rpcPath, expect: "bc_app" }),
    ).resolves.toMatchObject({ ok: true });
  });
});
