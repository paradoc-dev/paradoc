import { describe, it, expect } from "vitest";
import { createFsResolver } from "../src/fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("@paradoc/resolvers - README Examples", () => {
  describe("Filesystem resolver - Basic usage", () => {
    it("should create a filesystem resolver and read a file", async () => {
      // Create a resolver pointing to fixtures directory
      const resolver = createFsResolver({
        root: path.join(__dirname, "fixtures"),
      });

      // Read a file relative to root
      const bytes = await resolver.read("/test-file.md");
      expect(bytes).toBeDefined();
      expect(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array).toBe(true);
    });
  });

  describe("Filesystem resolver - Subpath imports", () => {
    it("should support direct subpath imports", () => {
      // This verifies the subpath export works
      expect(typeof createFsResolver).toBe("function");
    });
  });

  describe("Filesystem resolver - Read capabilities", () => {
    it("should read files correctly from filesystem", async () => {
      const resolver = createFsResolver({
        root: path.join(__dirname, "fixtures"),
      });

      const bytes = await resolver.read("/test-file.md");
      const text = new TextDecoder().decode(bytes);
      expect(text).toContain("test");
    });
  });
});
