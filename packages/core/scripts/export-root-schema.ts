#!/usr/bin/env tsx
/**
 * Export the root Paradoc schema to JSON Schema format
 *
 * This script imports the Paradoc schema from @paradoc/schemas,
 * converts it to JSON Schema format, and writes it to packages/schemas/schemas/paradoc.schema.json
 */

// NOTE: This script is obsolete - schemas are now exported by @paradoc/schemas package itself
// Keeping for reference but it will not work with the current architecture

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
// import { Paradoc, ParadocModule } from "@paradoc/schemas"; // No longer exported

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CORE_DIR = join(__dirname, "..");
const OUTPUT_DIR = join(CORE_DIR, "..", "schemas", "schemas");
const OUTPUT_FILE = join(OUTPUT_DIR, "paradoc.schema.json");

/**
 * Main export function
 */
async function main() {
  console.log("🔄 Exporting Paradoc root schema to JSON Schema...\n");

  try {
    // NOTE: This script is obsolete - schemas are now exported by @paradoc/schemas package itself
    throw new Error("This script is obsolete. Use '@paradoc/schemas' package's export:root-schema script instead.");
  } catch (error) {
    console.error("✗ Failed to export Paradoc schema:", error);
    process.exit(1);
  }
}

main().catch(console.error);
