import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FontResourceError, resolveFontResource } from "../src/resources";

afterEach(() => vi.unstubAllGlobals());

describe("font resource resolution", () => {
  const bytes = Uint8Array.from([1, 2, 3, 4]);
  const source = `data:font/woff2;base64,${Buffer.from(bytes).toString("base64")}`;
  const integrity = createHash("sha256").update(bytes).digest("hex");

  it("accepts matching integrity and rejects a mismatch", async () => {
    await expect(resolveFontResource({ family: "Match", source, integrity })).resolves.toMatchObject({ identity: integrity });
    await expect(resolveFontResource({ family: "Mismatch", source, integrity: "0".repeat(64) }))
      .rejects.toBeInstanceOf(FontResourceError);
  });

  it("decodes a data URL", async () => {
    const face = await resolveFontResource({ family: "Data", source });
    expect(face.data).toEqual(bytes);
  });

  it("reports an HTTP failure and retries after failure", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(bytes, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const resource = { family: "Remote", source: "https://example.test/font.woff2" };
    await expect(resolveFontResource(resource)).rejects.toBeInstanceOf(FontResourceError);
    await expect(resolveFontResource(resource)).resolves.toMatchObject({ data: bytes });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
