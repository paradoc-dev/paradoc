/**
 * Benchmark orchestrator: runs each (implementation × fixture) pair in its
 * own child process and prints a comparison table.
 *
 * Usage: node --expose-gc tests/bench/run.mjs
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const here = fileURLToPath(new URL('.', import.meta.url))
const fixtures = [
  ['spike-puppeteer.pdf', 100],
  ['spike-libreoffice.pdf', 100],
  ['large-contract.pdf', 30],
]

const results = []
for (const [fixture, iterations] of fixtures) {
  for (const impl of ['ours', 'pdfjs']) {
    const out = execFileSync(
      process.execPath,
      ['--expose-gc', join(here, 'impl.mjs'), impl, fixture, String(iterations)],
      { encoding: 'utf8' },
    )
    results.push(JSON.parse(out.trim().split('\n').at(-1)))
  }
}

const pad = (value, width) => String(value).padStart(width)
console.log(
  '\nfixture                 impl   fields load(ms) modHeap(MB) mean(ms) median(ms) min(ms) peakHeap(MB) rss(MB)',
)
for (const r of results) {
  console.log(
    `${r.fixture.padEnd(23)} ${r.impl.padEnd(6)} ${pad(r.fields, 6)} ${pad(r.loadMs, 8)} ${pad(r.moduleHeapMb, 11)} ${pad(r.meanMs, 8)} ${pad(r.medianMs, 10)} ${pad(r.minMs, 7)} ${pad(r.peakHeapMb, 12)} ${pad(r.rssMb, 7)}`,
  )
}

for (const fixture of fixtures.map(([name]) => name)) {
  const ours = results.find((r) => r.fixture === fixture && r.impl === 'ours')
  const pdfjs = results.find((r) => r.fixture === fixture && r.impl === 'pdfjs')
  console.log(
    `\n${fixture}: speedup ×${(pdfjs.meanMs / ours.meanMs).toFixed(1)} (mean), load ×${(pdfjs.loadMs / ours.loadMs).toFixed(1)}, module heap ×${(pdfjs.moduleHeapMb / Math.max(ours.moduleHeapMb, 0.01)).toFixed(1)}, rss ${ours.rssMb}MB vs ${pdfjs.rssMb}MB`,
  )
}
