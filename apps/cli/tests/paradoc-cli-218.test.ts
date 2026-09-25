import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(__dirname, '../dist/index.js')

function run(args: string[], cwd: string, home: string) {
	return spawnSync('node', [dist, ...args], {
		cwd, encoding: 'utf-8',
		env: { ...process.env, HOME: home, DO_NOT_TRACK: '1', PARADOC_TELEMETRY_DISABLED: '1', NO_COLOR: '1' },
	})
}

describe('paradoc-cli-218: init awaits the manifest write', () => {
	it('reports success only after paradoc.json is written', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'val-218-'))
		const r = run(['init', '--yes', '--name', 'demo', 'proj'], root, path.join(root, 'home'))
		fs.rmSync(root, { recursive: true, force: true })
		const created = r.stdout.indexOf('Created JSON file')
		const success = r.stdout.indexOf('Project initialized successfully')
		expect(created).toBeGreaterThan(-1)
		expect(success, r.stdout).toBeGreaterThan(created)
	})

	it('does not claim success, and reports a clean error, when the write fails', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'val-218-'))
		const proj = path.join(root, 'ro')
		fs.mkdirSync(path.join(proj, '.paradoc'), { recursive: true })
		fs.chmodSync(proj, 0o555)
		const r = run(['init', '--yes', '--name', 'demo', 'ro'], root, path.join(root, 'home'))
		fs.chmodSync(proj, 0o755)
		fs.rmSync(root, { recursive: true, force: true })
		expect(r.status).not.toBe(0)
		expect(r.stdout, r.stdout).not.toContain('Project initialized successfully')
		expect(r.stderr, r.stderr).not.toContain('node:internal')
	})
})
