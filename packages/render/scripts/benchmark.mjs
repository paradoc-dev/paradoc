import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

import { renderDocx as renderLegacyDocx } from '@paradoc/renderer-docx'
import { inspectAcroFormFields as inspectLegacyPdf, renderPdf as renderLegacyPdf } from '@paradoc/renderer-pdf'
import { renderText as renderLegacyText } from '@paradoc/renderer-text'
import { PDFDocument } from 'pdf-lib'
import { inspectAcroFormFields, inspectPdf, renderPdf } from '../dist/pdf.js'
import { renderDocx } from '../dist/docx.js'
import { renderText } from '../dist/text.js'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pdfFixturePath = resolve(packageRoot, '../renderer-pdf/tests/fixtures/pet-addendum-2.pdf')
const docxFixturePath = resolve(packageRoot, '../renderer-docx/tests/fixtures/pet-addendum.docx')
const pdfTemplate = new Uint8Array(readFileSync(pdfFixturePath))
const docxTemplate = new Uint8Array(readFileSync(docxFixturePath))

const textOptions = {
  template: [
    'Hello {{person.name}}',
    '{{#if (gte count 2)}}many{{else}}few{{/if}}',
    '{{#each items}}{{@index}}={{this}}{{#unless @last}},{{/unless}}{{/each}}',
  ].join('\n'),
  data: {
    person: { name: 'Ada' },
    count: 2,
    items: ['one', 'two', 'three'],
  },
}

const pdfForm = {
  kind: 'form',
  name: 'pet',
  version: '1.0.0',
  title: 'Pet',
  fields: {
    name: { type: 'text' },
    species: { type: 'enum', enum: [{ value: 'dog' }, { value: 'cat' }] },
    weight: { type: 'number' },
    hasVaccination: { type: 'boolean' },
  },
}

const pdfOptions = {
  template: pdfTemplate,
  form: pdfForm,
  data: { name: 'Pixel', species: 'cat', weight: 12, hasVaccination: true },
  bindings: {
    pet_name: 'name',
    SPECIES: 'species',
    petWeight: 'weight',
    is_vaccinated: 'hasVaccination',
  },
}

const docxOptions = {
  template: docxTemplate,
  data: { petName: 'Pixel & Co', petSpecies: 'cat', petWeight: 12, isVaccinated: true },
  bindings: { name: 'petName', species: 'petSpecies', weight: 'petWeight', hasVaccination: 'isVaccinated' },
}

const warmups = 2
const iterations = Number.parseInt(process.env.PARADOC_BENCHMARK_ITERATIONS ?? '8', 10)
const sizeOnly = process.argv.includes('--size-only')

function byteLength(value) {
  if (typeof value === 'string') return Buffer.byteLength(value)
  if (value instanceof Uint8Array) return value.byteLength
  return undefined
}

function percentile(samples, fraction) {
  const sorted = [...samples].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  return sorted[index]
}

async function measure(name, operation, count = iterations) {
  for (let index = 0; index < warmups; index += 1) await operation()

  const samples = []
  let output
  for (let index = 0; index < count; index += 1) {
    const start = performance.now()
    output = await operation()
    samples.push(performance.now() - start)
  }

  return {
    name,
    iterations: count,
    average_ms: Number((samples.reduce((sum, sample) => sum + sample, 0) / samples.length).toFixed(3)),
    p50_ms: Number(percentile(samples, 0.5).toFixed(3)),
    p95_ms: Number(percentile(samples, 0.95).toFixed(3)),
    output_bytes: byteLength(output),
  }
}

function coldImport(specifier) {
  const source = [
    'const start = performance.now()',
    `await import(${JSON.stringify(specifier)})`,
    'console.log((performance.now() - start).toFixed(3))',
  ].join(';')
  const value = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return Number.parseFloat(value.trim())
}

function coldImportReport(specifier) {
  const samples = Array.from({ length: 3 }, () => coldImport(specifier))
  return {
    package: specifier,
    samples_ms: samples.map((sample) => Number(sample.toFixed(3))),
    median_ms: Number(percentile(samples, 0.5).toFixed(3)),
  }
}

function browserBundleSize(entry) {
  const directory = mkdtempSync(join(tmpdir(), 'paradoc-render-benchmark-'))
  try {
    execFileSync('pnpm', [
      'exec',
      'tsup',
      `src/${entry}.ts`,
      '--format=esm',
      '--minify',
      '--no-dts',
      '--no-splitting',
      '--clean=false',
      `--out-dir=${directory}`,
    ], { cwd: packageRoot, stdio: 'ignore' })
    return statSync(join(directory, `${entry}.js`)).size
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function packageSize(directory = packageRoot, includeFiles = true) {
  const result = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }))[0]

  const size = {
    tarball_bytes: result.size,
    unpacked_bytes: result.unpackedSize,
    file_count: result.files.length,
  }
  if (includeFiles) {
    size.files = result.files.map((file) => ({ path: file.path, bytes: file.size }))
  }
  return size
}

const pdfInspectInput = () => inspectAcroFormFields(pdfTemplate)
const legacyPdfInspectInput = () => inspectLegacyPdf(pdfTemplate)
const pdfPageInspectInput = () => inspectPdf(pdfTemplate)
const pdfLibInspectInput = async () => {
  const document = await PDFDocument.load(pdfTemplate)
  return { pageCount: document.getPageCount() }
}

const measurements = sizeOnly ? [] : [
  await measure('text.new', () => renderText(textOptions)),
  await measure('text.legacy', () => renderLegacyText(textOptions)),
  await measure('pdf.inspect.new', pdfInspectInput),
  await measure('pdf.inspect.legacy', legacyPdfInspectInput),
  await measure('pdf.inspect-pages.new', pdfPageInspectInput),
  await measure('pdf.inspect-pages.legacy-pdf-lib', pdfLibInspectInput),
  await measure('pdf.fill.new', () => renderPdf(pdfOptions)),
  await measure('pdf.fill.legacy', () => renderLegacyPdf(pdfOptions)),
  await measure('pdf.overlay.new', () => renderPdf({
    template: pdfTemplate,
    data: { recipient: { name: 'Ada' } },
    overlays: [
      { page: 1, x: 24, y: 250, text: 'Prepared for' },
      { page: 1, x: 24, y: 230, field: 'recipient.name', fontSize: 14 },
    ],
  })),
  await measure('docx.new', () => renderDocx(docxOptions), 4),
  await measure('docx.legacy', () => renderLegacyDocx(docxOptions), 4),
]

const coldImports = sizeOnly ? [] : [
  coldImportReport('@paradoc/render/text'),
  coldImportReport('@paradoc/renderer-text'),
  coldImportReport('@paradoc/render/pdf'),
  coldImportReport('@paradoc/renderer-pdf'),
  coldImportReport('@paradoc/render/docx'),
  coldImportReport('@paradoc/renderer-docx'),
]

const size = {
  dist_bytes: Object.fromEntries(['index', 'text', 'pdf', 'docx'].map((entry) => [
    `${entry}.js`, statSync(resolve(packageRoot, `dist/${entry}.js`)).size,
  ])),
  browser_bundle_bytes: Object.fromEntries(['text', 'pdf', 'docx'].map((entry) => [entry, browserBundleSize(entry)])),
  package: packageSize(),
  legacy_packages: Object.fromEntries([
    ['@paradoc/renderer-text', '../renderer-text'],
    ['@paradoc/renderer-pdf', '../renderer-pdf'],
    ['@paradoc/renderer-docx', '../renderer-docx'],
  ].map(([name, directory]) => [name, packageSize(resolve(packageRoot, directory), false)])),
}

console.log(JSON.stringify({
  package: '@paradoc/render',
  node: process.version,
  warmups,
  iterations,
  measurements,
  cold_imports: coldImports,
  size,
}, null, 2))
