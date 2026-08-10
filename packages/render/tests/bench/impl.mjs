/**
 * Benchmark child process: measures one implementation against one fixture in
 * an isolated process so module-load cost and memory are attributed fairly.
 * Prints a single JSON line. Invoked by run.mjs.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , impl, fixtureName, iterationsRaw] = process.argv
const iterations = Number(iterationsRaw ?? 20)
const here = fileURLToPath(new URL('.', import.meta.url))
const pdf = new Uint8Array(readFileSync(join(here, '../fixtures', fixtureName)))

const gc = globalThis.gc ?? (() => {})

const baselineHeap = (gc(), process.memoryUsage().heapUsed)
const loadStart = performance.now()

let extract
if (impl === 'ours') {
  const module = await import('../../dist/pdf.js')
  extract = module.extractFieldsFromPdf
} else {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  const workerPath = join(require.resolve('pdfjs-dist/package.json'), '../legacy/build/pdf.worker.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = `file://${workerPath}`
  // Extraction subset mirroring the platform extractor: text content walk +
  // decode. Field math is identical between implementations, so the bench
  // measures the PDF-reading engines, which is the part being replaced.
  const { decodeAll } = await import('../../dist/pdf.js')
  extract = async (bytes) => {
    const document = await pdfjs.getDocument({
      data: bytes.slice(),
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
    }).promise
    const fields = []
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber)
        const content = await page.getTextContent()
        let accumulated = ''
        for (const item of content.items) if ('str' in item) accumulated += item.str
        for (const encoding of decodeAll(accumulated)) fields.push({ page: pageNumber, ...encoding })
      }
    } finally {
      await document.destroy()
    }
    return fields
  }
}

const loadMs = performance.now() - loadStart
gc()
const loadedHeap = process.memoryUsage().heapUsed

// Warmup
for (let index = 0; index < 3; index++) await extract(pdf)

let peakHeap = 0
const times = []
let fieldCount = 0
for (let index = 0; index < iterations; index++) {
  const start = performance.now()
  const fields = await extract(pdf)
  times.push(performance.now() - start)
  fieldCount = fields.length
  peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed)
}

gc()
await new Promise((resolve) => setTimeout(resolve, 50))
gc()

times.sort((a, b) => a - b)
console.log(
  JSON.stringify({
    impl,
    fixture: fixtureName,
    fields: fieldCount,
    loadMs: +loadMs.toFixed(1),
    moduleHeapMb: +((loadedHeap - baselineHeap) / 1048576).toFixed(2),
    meanMs: +(times.reduce((total, time) => total + time, 0) / times.length).toFixed(2),
    medianMs: +times[Math.floor(times.length / 2)].toFixed(2),
    minMs: +times[0].toFixed(2),
    peakHeapMb: +(peakHeap / 1048576).toFixed(1),
    settledHeapMb: +((process.memoryUsage().heapUsed - baselineHeap) / 1048576).toFixed(2),
    rssMb: +(process.memoryUsage().rss / 1048576).toFixed(1),
  }),
)
