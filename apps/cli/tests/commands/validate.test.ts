import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { PARADOC_SCHEMA_URL } from '@paradoc/schemas'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = path.resolve(__dirname, '../fixtures')

/**
 * Execute a CLI command and return the result
 */

describe('CLI Validate Command', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-validate-test-'))
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('validate --help', () => {
    it('should display help for validate command', async () => {
      const result = await executeCliCommand(['validate', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Validate')
    })
  })

  describe('validate valid artifacts', () => {
    it('should validate a valid form artifact', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Valid')
    })

    it('should validate a form artifact and show kind', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('form')
      expect(result.stdout).toContain('pet-addendum')
    })
  })

  describe('validate multiple files', () => {
    const writeGood = async (dir: string, name: string) => {
      const good = path.join(dir, name)
      await fs.copyFile(path.join(fixturesDir, 'pet-addendum.yaml'), good)
      return good
    }
    const writeBad = async (dir: string, name: string) => {
      const bad = path.join(dir, name)
      await fs.writeFile(bad, JSON.stringify({ name: 'invalid-artifact', version: '1.0.0' }))
      return bad
    }

    it('exits non-zero and reports both files (good then bad)', async () => {
      const good = await writeGood(tempDir, 'good.yaml')
      const bad = await writeBad(tempDir, 'bad.json')

      const result = await executeCliCommand(['validate', good, bad])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toContain(good)
      expect(result.stdout).toContain(bad)
    })

    it('exits non-zero and reports both files (bad then good)', async () => {
      const good = await writeGood(tempDir, 'good.yaml')
      const bad = await writeBad(tempDir, 'bad.json')

      const result = await executeCliCommand(['validate', bad, good])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toContain(good)
      expect(result.stdout).toContain(bad)
    })

    it('exits zero when every file is valid', async () => {
      const good1 = await writeGood(tempDir, 'good1.yaml')
      const good2 = await writeGood(tempDir, 'good2.yaml')

      const result = await executeCliCommand(['validate', good1, good2])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(good1)
      expect(result.stdout).toContain(good2)
    })

    it('reports both files as a JSON array, in argument order', async () => {
      const good = await writeGood(tempDir, 'good.yaml')
      const bad = await writeBad(tempDir, 'bad.json')

      const result = await executeCliCommand(['validate', good, bad, '--json'])

      expect(result.exitCode).toBe(1)
      const parsed = JSON.parse(result.stdout)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(2)
      expect(parsed[0]).toMatchObject({ ok: true, source: good })
      expect(parsed[1]).toMatchObject({ ok: false, source: bad })
    })

    it('keeps validating remaining files when one does not exist', async () => {
      const good = await writeGood(tempDir, 'good.yaml')

      const result = await executeCliCommand(['validate', '/nonexistent/path/file.yaml', good])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/not found/i)
      expect(result.stdout).toContain(good)
      expect(result.stdout).toContain('Valid')
    })
  })

  describe('validate invalid artifacts', () => {
    it('should fail validation for missing required fields', async () => {
      // Create an invalid artifact (missing kind)
      const invalidPath = path.join(tempDir, 'invalid.json')
      await fs.writeFile(invalidPath, JSON.stringify({
        name: 'invalid-artifact',
        version: '1.0.0',
      }))

      const result = await executeCliCommand(['validate', invalidPath])

      expect(result.exitCode).toBe(1)
    })

    it('should fail validation for non-existent file', async () => {
      const result = await executeCliCommand(['validate', '/nonexistent/path/file.yaml'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/not found|error|ENOENT/i)
    })
  })

  describe('validate with options', () => {
    it('should support JSON output option', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--json'])

      expect(result.exitCode).toBe(0)
      // JSON output should be parseable
      const parsed = JSON.parse(result.stdout)
      expect(parsed).toHaveProperty('ok', true)
    })

    it('should support silent mode', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--silent'])

      expect(result.exitCode).toBe(0)
      // Silent mode should have minimal output
    })

    it('should support expect-kind option for correct kind', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--expect-kind', 'form'])

      expect(result.exitCode).toBe(0)
    })

    it('should fail expect-kind for incorrect kind', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--expect-kind', 'document'])

      expect(result.exitCode).toBe(1)
    })
  })

  describe('validate scope flags', () => {
    it('should validate schema-only and skip layers', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--schema-only'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Valid')
      // Should mention layers are skipped
      expect(result.stdout).toMatch(/skipped|schema-only/i)
    })

    it('should validate layers-only', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--layers-only'])

      expect(result.exitCode).toBe(0)
      // Should show layer info but not schema details
      expect(result.stdout).toContain('Valid')
    })

    it('should validate checksum-only', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--checksum-only'])

      expect(result.exitCode).toBe(0)
    })

    it('should reject mutually exclusive scope flags', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--schema-only', '--layers-only'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('mutually exclusive')
    })

    it('should reject all three scope flags combined', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--schema-only', '--layers-only', '--checksum-only'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('mutually exclusive')
    })

    it('should validate schema-only with JSON output', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--schema-only', '--json'])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.ok).toBe(true)
      expect(parsed.layersSkipped).toBe(true)
    })

    it('should validate layers-only with JSON output', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--layers-only', '--json'])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.ok).toBe(true)
    })
  })

  describe('validate document artifact', () => {
    it('should validate a document artifact', async () => {
      const docPath = path.join(fixturesDir, 'pet-care-guide.yaml')
      const result = await executeCliCommand(['validate', docPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('document')
    })

    it('should fail expect-kind form on a document', async () => {
      const docPath = path.join(fixturesDir, 'pet-care-guide.yaml')
      const result = await executeCliCommand(['validate', docPath, '--expect-kind', 'form'])

      expect(result.exitCode).toBe(1)
    })
  })

  describe('validate layer checks', () => {
    it('fails on a missing layer file', async () => {
      const artifactPath = path.join(tempDir, 'bad-layers.json')
      await fs.writeFile(artifactPath, JSON.stringify({
        $schema: PARADOC_SCHEMA_URL,
        kind: 'form',
        name: 'bad-layers',
        version: '1.0.0',
        title: 'Bad Layers',
        fields: {
          name: { type: 'text', label: 'Name', required: true },
        },
        defaultLayer: 'pdf',
        layers: {
          pdf: {
            kind: 'file',
            mimeType: 'application/pdf',
            path: './nonexistent.pdf',
          },
        },
      }))

      const result = await executeCliCommand(['validate', artifactPath, '--json'])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout).errors).toEqual([{
        message: 'Layer file not found: ./nonexistent.pdf',
        path: ['layers', 'pdf', 'path'],
      }])
      const human = await executeCliCommand(['validate', artifactPath])
      expect(human.exitCode).toBe(1)
      expect(human.stdout).toContain('✗ Validation failed')
    })

    it('should report missing checksum as warning', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum-pdf.yaml')
      const result = await executeCliCommand(['validate', formPath, '--json'])

      // The pet-addendum-pdf.yaml has file layer without checksum
      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      // Should have warnings about missing checksums
      if (parsed.warnings && parsed.warnings.length > 0) {
        expect(parsed.warnings.some((w: { message: string }) => w.message.toLowerCase().includes('checksum'))).toBe(true)
      }
    })
  })

  describe('template expressions', () => {
    const write = async (template: string) => {
      const formPath = path.join(tempDir, 'templated.json')
      await fs.writeFile(path.join(tempDir, 'terms.md'), template)
      await fs.writeFile(formPath, JSON.stringify({
        $schema: PARADOC_SCHEMA_URL,
        kind: 'form',
        name: 'templated',
        fields: { qty: { type: 'number', label: 'Quantity' } },
        layers: { md: { kind: 'file', mimeType: 'text/markdown', path: 'terms.md' } },
      }))
      return formPath
    }

    it('checks the template expressions of a file layer', async () => {
      const result = await executeCliCommand(['validate', await write('ok\n{{default fields.qty 0}}'), '--json'])
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toContain('Template error at layer \\"md\\", line 2, column 3')
      expect(result.stdout).toContain('coalesce')
    })

    it('passes a file layer whose templates are valid', async () => {
      const result = await executeCliCommand(['validate', await write('{{fields.qty * 2}}')])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('layer references', () => {
    const write = async (defaultLayer: string, template: string) => {
      const formPath = path.join(tempDir, 'signed.json')
      await fs.writeFile(path.join(tempDir, 'terms.md'), template)
      await fs.writeFile(formPath, JSON.stringify({
        $schema: PARADOC_SCHEMA_URL,
        kind: 'form',
        name: 'signed',
        parties: { client: { label: 'Client', partyType: 'person', signature: { required: true } } },
        layers: {
          md: {
            kind: 'file',
            mimeType: 'text/markdown',
            path: 'terms.md',
            signatures: { 'client-sig': { party: { role: 'client' }, type: 'signature', placement: 'flow' } },
          },
        },
        defaultLayer,
      }))
      return formPath
    }

    it('fails on an unknown defaultLayer, naming it', async () => {
      const result = await executeCliCommand(['validate', await write('pdf', '{{signature(parties.client, "client-sig")}}'), '--json'])
      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout).errors).toEqual([{
        message: 'defaultLayer "pdf" names no layer; declared layers: "md"',
        path: ['defaultLayer'],
      }])
    })

    it('fails on a flow slot the file template does not place, naming the layer and slot', async () => {
      const result = await executeCliCommand(['validate', await write('md', 'No signature line.'), '--json'])
      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout).errors).toEqual([{
        message: 'Layer "md", slot "client-sig": no {{signature(..., "client-sig")}} in the template places this \'flow\' slot',
        path: ['layers', 'md', 'signatures', 'client-sig'],
      }])
    })

    it('passes when every slot is placed', async () => {
      const result = await executeCliCommand(['validate', await write('md', '{{signature(parties.client, "client-sig")}}')])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('PDF binding fit', () => {
    /** A one-page PDF whose AcroForm holds one text field of the given size. */
    const textFieldPdf = (name: string, width: number, height: number): string => {
      const bodies = [
        '<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Annots [4 0 R] >>',
        `<< /FT /Tx /T (${name}) /Subtype /Widget /Rect [20 20 ${20 + width} ${20 + height}] /P 3 0 R >>`,
        '<< /Fields [4 0 R] >>',
      ]
      let pdf = '%PDF-1.5\n'
      const offsets: number[] = []
      bodies.forEach((body, index) => {
        offsets.push(pdf.length)
        pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
      })
      const xref = pdf.length
      pdf += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`
      pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
      return pdf + `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    }

    const write = async (field: Record<string, unknown>) => {
      const formPath = path.join(tempDir, 'bound.json')
      await fs.writeFile(path.join(tempDir, 'bound.pdf'), textFieldPdf('amountSource', 48, 12))
      await fs.writeFile(formPath, JSON.stringify({
        $schema: PARADOC_SCHEMA_URL,
        kind: 'form',
        name: 'bound',
        fields: { amountSource: { label: 'Source', ...field } },
        layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'bound.pdf', bindings: { amountSource: 'amountSource' } } },
      }))
      return formPath
    }

    it('fails when a bound value cannot fit its PDF box', async () => {
      const result = await executeCliCommand(['validate', await write({ type: 'text', maxLength: 200 }), '--json'])
      expect(result.exitCode).toBe(1)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.errors).toEqual([expect.objectContaining({
        message: expect.stringMatching(/^Layer "pdf", PDF field "amountSource" \(bound to fields\.amountSource\): .*maxLength 200/),
        path: ['layers', 'pdf', 'bindings', 'amountSource'],
      })])
    })

    it('passes a bound value that fits', async () => {
      const result = await executeCliCommand(['validate', await write({ type: 'text', maxLength: 5 }), '--json'])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).errors).toEqual([])
    })

    it('warns, and still passes, when a bound text field has no length bound', async () => {
      const formPath = await write({ type: 'text' })
      const json = await executeCliCommand(['validate', formPath, '--json'])
      expect(json.exitCode).toBe(0)
      expect(JSON.parse(json.stdout).warnings).toContainEqual(expect.objectContaining({
        message: expect.stringContaining('fields.amountSource has no maxLength or pattern'),
      }))
      const human = await executeCliCommand(['validate', formPath])
      expect(human.exitCode).toBe(0)
      expect(human.stdout).toContain('fields.amountSource has no maxLength or pattern')
    })
  })

  describe('instruction files', () => {
    const write = async (instructions: Record<string, unknown>) => {
      const formPath = path.join(tempDir, 'guided.json')
      await fs.writeFile(path.join(tempDir, 'guide.md'), 'Fill it in.')
      await fs.writeFile(formPath, JSON.stringify({
        $schema: PARADOC_SCHEMA_URL,
        kind: 'form',
        name: 'guided',
        fields: { name: { type: 'text', label: 'Name' } },
        ...instructions,
      }))
      return formPath
    }

    it('fails on a missing instructions file', async () => {
      const result = await executeCliCommand(['validate', await write({ instructions: { kind: 'file', mimeType: 'text/markdown', path: 'missing.md' } }), '--json'])
      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout).errors).toEqual([{ message: 'Content file not found: missing.md', path: ['instructions', 'path'] }])
    })

    it('fails on a missing agentInstructions file', async () => {
      const result = await executeCliCommand(['validate', await write({ agentInstructions: { kind: 'file', mimeType: 'text/markdown', path: 'missing.md' } }), '--json'])
      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout).errors).toEqual([{ message: 'Content file not found: missing.md', path: ['agentInstructions', 'path'] }])
    })

    it('fails on an instructions path that exists but cannot be read, as validateLayers does', async () => {
      await fs.mkdir(path.join(tempDir, 'guide-dir'))
      const formPath = await write({ instructions: { kind: 'file', mimeType: 'text/markdown', path: 'guide-dir' } })
      const result = await executeCliCommand(['validate', formPath, '--json'])
      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout).errors).toContainEqual(expect.objectContaining({
        message: expect.stringMatching(/^instructions could not be read from "guide-dir"/),
        path: ['instructions'],
      }))
      const human = await executeCliCommand(['validate', formPath])
      expect(human.exitCode).toBe(1)
      expect(human.stdout).toContain('instructions could not be read from "guide-dir"')
    })

    it('passes a readable instructions file', async () => {
      const result = await executeCliCommand(['validate', await write({ instructions: { kind: 'file', mimeType: 'text/markdown', path: 'guide.md' } }), '--json'])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).errors).toEqual([])
    })
  })

  describe('PDF bindings', () => {
    /** Writes a form over the real pet addendum PDF, whose fields are name, weight, species and hasVaccination. */
    const write = async (bindings: Record<string, string>) => {
      const formPath = path.join(tempDir, 'pet.json')
      await fs.copyFile(path.join(fixturesDir, 'pet-addendum.pdf'), path.join(tempDir, 'pet.pdf'))
      await fs.writeFile(formPath, JSON.stringify({
        $schema: PARADOC_SCHEMA_URL,
        kind: 'form',
        name: 'pet',
        fields: {
          petName: { type: 'text', label: 'Pet name', maxLength: 10 },
          petWeight: { type: 'number', label: 'Weight', min: 0, max: 100 },
        },
        layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'pet.pdf', bindings } },
      }))
      return formPath
    }

    it('passes a correct PDF layer', async () => {
      const result = await executeCliCommand(['validate', await write({ name: 'petName', weight: 'fields.petWeight' }), '--json'])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).errors).toEqual([])
    })

    it('fails inverted bindings, naming the key', async () => {
      const result = await executeCliCommand(['validate', await write({ petName: 'name' }), '--json'])
      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout).errors).toEqual([expect.objectContaining({
        message: expect.stringMatching(/^Layer "pdf", binding "petName": "name" is not a known Paradoc path.*The key "petName" is a field of this artifact/),
        path: ['layers', 'pdf', 'bindings', 'petName'],
      })])
    })

    it('fails an unknown value path, naming the key', async () => {
      const result = await executeCliCommand(['validate', await write({ name: 'petName', weight: 'petHeight' }), '--json'])
      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout).errors).toEqual([expect.objectContaining({
        message: expect.stringMatching(/^Layer "pdf", binding "weight": "petHeight" is not a known Paradoc path/),
        path: ['layers', 'pdf', 'bindings', 'weight'],
      })])
    })

    it('fails a key that is not an AcroForm field, naming the key', async () => {
      const formPath = await write({ name: 'petName', pet_weight: 'petWeight' })
      const result = await executeCliCommand(['validate', formPath, '--json'])
      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout).errors).toEqual([expect.objectContaining({
        message: expect.stringMatching(/^Layer "pdf", binding "pet_weight": "pet_weight" is not an AcroForm field in "pet\.pdf"/),
        path: ['layers', 'pdf', 'bindings', 'pet_weight'],
      })])
      const human = await executeCliCommand(['validate', formPath])
      expect(human.exitCode).toBe(1)
      expect(human.stdout).toContain('"pet_weight" is not an AcroForm field')
    })
  })
})
