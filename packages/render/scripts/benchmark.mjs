import { performance } from 'node:perf_hooks'
import { readFile } from 'node:fs/promises'
import { renderDocx } from '../dist/docx.js'
import { inspectAcroFormFields, renderPdf } from '../dist/pdf.js'
import { renderText } from '../dist/text.js'

const textIterations = Number(process.env.PARADOC_BENCHMARK_ITERATIONS ?? 1_000)
const binaryIterations = Number(process.env.PARADOC_BINARY_BENCHMARK_ITERATIONS ?? 100)
const pdf = new Uint8Array(await readFile(new URL('../tests/fixtures/pet-addendum-2.pdf', import.meta.url)))
const docx = new Uint8Array(await readFile(new URL('../tests/fixtures/pet-addendum.docx', import.meta.url)))

function measure(iterations, operation) {
  const started = performance.now()
  for (let index = 0; index < iterations; index += 1) operation()
  return (performance.now() - started) / iterations
}

async function measureAsync(iterations, operation) {
  const started = performance.now()
  for (let index = 0; index < iterations; index += 1) await operation()
  return (performance.now() - started) / iterations
}

console.log(JSON.stringify({
  iterations: { text: textIterations, binary: binaryIterations },
  text_render_ms: measure(textIterations, () => {
    renderText({ template: 'Hello {{person.name}}', data: { person: { name: 'Ada' } } })
  }),
  pdf_inspect_ms: await measureAsync(binaryIterations, () => inspectAcroFormFields(pdf)),
  pdf_render_ms: await measureAsync(binaryIterations, () => renderPdf({
    template: pdf,
    data: { name: 'Ada' },
    bindings: { pet_name: 'name' },
  })),
  docx_render_ms: await measureAsync(binaryIterations, () => renderDocx({
    template: docx,
    data: { tenantName: 'Ada' },
  })),
  historical_baseline: './benchmarks/legacy-baseline.json',
}, null, 2))
