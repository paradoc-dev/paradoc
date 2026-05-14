/**
 * Tests for filesystem resolver
 */

import { describe, test, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFsResolver } from "../src/fs/index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

describe("createFsResolver", () => {
  beforeAll(() => {
    // Create fixtures directory
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Create test files
    fs.writeFileSync(path.join(fixturesDir, "test.txt"), "Hello, World!");
    fs.writeFileSync(
      path.join(fixturesDir, "test.json"),
      JSON.stringify({ foo: "bar" })
    );
    fs.writeFileSync(
      path.join(fixturesDir, "test-file.md"),
      "# Test File\n\nThis is a test fixture for the resolvers package."
    );

    // Create subdirectory with file
    const subDir = path.join(fixturesDir, "subdir");
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
    fs.writeFileSync(path.join(subDir, "nested.txt"), "Nested content");
  });


  test("reads a text file from root", async () => {
    const resolver = createFsResolver({ root: fixturesDir });
    const bytes = await resolver.read("/test.txt");

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes)).toBe("Hello, World!");
  });

  test("reads a JSON file and returns Uint8Array", async () => {
    const resolver = createFsResolver({ root: fixturesDir });
    const bytes = await resolver.read("/test.json");

    expect(bytes).toBeInstanceOf(Uint8Array);
    const content = new TextDecoder().decode(bytes);
    expect(JSON.parse(content)).toEqual({ foo: "bar" });
  });

  test("reads a nested file from subdirectory", async () => {
    const resolver = createFsResolver({ root: fixturesDir });
    const bytes = await resolver.read("/subdir/nested.txt");

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes)).toBe("Nested content");
  });

  test("throws error for non-existent file", async () => {
    const resolver = createFsResolver({ root: fixturesDir });

    await expect(resolver.read("/nonexistent.txt")).rejects.toThrow();
  });

  test("prevents path traversal attacks", async () => {
    const resolver = createFsResolver({ root: fixturesDir });

    // Attempt to escape root directory via path traversal
    await expect(
      resolver.read("/../../../package.json")
    ).rejects.toThrow("Path traversal detected");

    await expect(
      resolver.read("/../../package.json")
    ).rejects.toThrow("Path traversal detected");

    await expect(
      resolver.read("../package.json")
    ).rejects.toThrow("Path traversal detected");
  });

  test("allows valid paths that look suspicious but stay within root", async () => {
    const resolver = createFsResolver({ root: fixturesDir });

    // Going into subdir then back should still work
    const bytes = await resolver.read("/subdir/../test.txt");
    expect(new TextDecoder().decode(bytes)).toBe("Hello, World!");
  });
});
