#!/usr/bin/env tsx
/**
 * Export TypeBox schemas to JSON Schema files
 *
 * This script processes schemas from @paradoc/schemas,
 * finds exported TypeBox schemas, converts them to JSON Schema format,
 * and writes them to packages/schemas/schemas preserving the folder structure
 */

// NOTE: This script is obsolete - schemas are now exported by @paradoc/schemas package itself
// Keeping for reference but it will not work with the current architecture

import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
// import * as schemas from '@paradoc/schemas' // No longer exports TypeBox schemas

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CORE_DIR = join(__dirname, '..')
const OUTPUT_DIR = join(CORE_DIR, '..', 'schemas', 'schemas')

interface SchemaExport {
  name: string
  schema: unknown
  category: string // artifacts, blocks, primitives
}

/**
 * Check if an object is a TypeBox schema
 */
function isTypeBoxSchema(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string | symbol, unknown>
  // TypeBox schemas have these properties
  const typeBoxKind = Symbol.for('TypeBox.Kind')
  return typeof obj.type === 'string' || (typeBoxKind in obj && obj[typeBoxKind] !== undefined)
}

/**
 * Convert TypeBox schema name to filename
 * e.g., "AddressFieldSchema" -> "address-field.schema.json"
 */
function toFilename(name: string): string {
  // Remove "Schema" suffix if present
  const baseName = name.replace(/Schema$/, '')
  return (
    baseName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '') + '.schema.json'
  )
}

/**
 * Map schema names to categories based on naming patterns
 */
function getCategory(name: string): string {
  // Artifacts
  if (['FormSchema', 'CaseSchema', 'PacketSchema', 'ChecklistSchema', 'ChecklistItemSchema',
       'EnclosureSchema', 'TemplateSchema', 'ArtifactSchema', 'PacketContentItemSchema',
       'CaseContentItemSchema'].includes(name)) {
    return 'artifacts'
  }
  // Blocks
  if (['FieldSchema', 'AnnexSchema', 'PartySchema', 'FieldsetSchema', 'BindingsSchema',
       'TemplateSpecSchema', 'InlineTemplateSchema', 'FileTemplateSchema'].includes(name)) {
    return 'blocks'
  }
  // Default to primitives
  return 'primitives'
}

/**
 * Main export function
 */
async function main() {
  console.log('🔄 Exporting TypeBox schemas to JSON Schema...\n')

  const allSchemas: SchemaExport[] = []

  // Extract schemas from @paradoc/schemas
  // NOTE: This code is disabled as @paradoc/schemas no longer exports TypeBox schemas
  // This script is obsolete - schemas are now exported by @paradoc/schemas package itself
  const schemasObj: Record<string, unknown> = {}
  for (const [exportName, exportValue] of Object.entries(schemasObj)) {
    if (isTypeBoxSchema(exportValue)) {
      allSchemas.push({
        name: exportName,
        schema: exportValue,
        category: getCategory(exportName),
      })
    }
  }

  // Group by category for logging
  const byCategory = allSchemas.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`📦 ${category}: ${count} schemas`)
  }

  console.log(`\n✨ Total schemas found: ${allSchemas.length}\n`)

  // Export each schema, preserving folder structure
  let exported = 0
  let skipped = 0

  for (const { name, schema, category } of allSchemas) {
    try {
      // Create category directory in output
      const categoryOutputDir = join(OUTPUT_DIR, category)
      await mkdir(categoryOutputDir, { recursive: true })

      const filename = toFilename(name)
      const outputPath = join(categoryOutputDir, filename)

      // Convert to JSON Schema and write
      const jsonSchema = JSON.stringify(schema, null, 2)
      await writeFile(outputPath, jsonSchema, 'utf-8')

      console.log(`✓ ${category}/${name} → ${category}/${filename}`)
      exported++
    } catch (error) {
      console.error(`✗ Failed to export ${name}:`, error)
      skipped++
    }
  }

  console.log(`\n🎉 Export complete!`)
  console.log(`   Exported: ${exported}`)
  if (skipped > 0) {
    console.log(`   Skipped: ${skipped}`)
  }
  console.log(`   Output: ${relative(CORE_DIR, OUTPUT_DIR)}`)
}

main().catch(console.error)
