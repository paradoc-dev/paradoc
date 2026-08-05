import { performance } from 'node:perf_hooks'
import { renderText } from '../dist/text.js'

const iterations = Number(process.env.PARADOC_BENCHMARK_ITERATIONS ?? 1_000)
const started = performance.now()
for (let index = 0; index < iterations; index += 1) {
  renderText({ template: 'Hello {{person.name}}', data: { person: { name: 'Ada' } } })
}
const elapsed = performance.now() - started

console.log(JSON.stringify({
  iterations,
  text_render_ms: elapsed / iterations,
  historical_baseline: './benchmarks/legacy-baseline.json',
}, null, 2))
