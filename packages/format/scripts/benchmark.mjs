import { performance } from 'node:perf_hooks'
import { createFormatter } from '../dist/index.js'

const iterations = Number.parseInt(process.env.PARADOC_FORMAT_BENCH_ITERATIONS ?? '5000', 10)
const rounds = 5

function exercise(formatter, index) {
	formatter.formatNumber(123456.789 + index)
	formatter.formatMoney({ amount: 1500.25 + index, currency: 'USD' })
	formatter.formatPercentage(12.5 + (index % 10))
	formatter.formatDate('2026-09-07')
}

function measure(run) {
	const samples = []
	for (let round = 0; round < rounds; round += 1) {
		const started = performance.now()
		run()
		samples.push(performance.now() - started)
	}
	return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)]
}

// Warm ICU and JIT state before measuring either policy.
exercise(createFormatter({ locale: 'en-US' }), 0)

const perValueSetupMs = measure(() => {
	for (let index = 0; index < iterations; index += 1) {
		exercise(createFormatter({ locale: 'en-US' }), index)
	}
})

const formatter = createFormatter({ locale: 'en-US', cacheSize: 8 })
const reusedFormatterMs = measure(() => {
	for (let index = 0; index < iterations; index += 1) exercise(formatter, index)
})

console.log(JSON.stringify({
	iterations,
	operationsPerIteration: 4,
	medianMilliseconds: {
		perValueSetup: Number(perValueSetupMs.toFixed(2)),
		reusedFormatter: Number(reusedFormatterMs.toFixed(2)),
	},
	speedup: Number((perValueSetupMs / reusedFormatterMs).toFixed(2)),
	cache: formatter.cacheStats(),
}, null, 2))
