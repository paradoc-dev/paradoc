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

describe('paradoc-cli-217: init never writes an invalid manifest', () => {
	it('refuses --name "!!!" --visibility foo, or writes a manifest later commands accept', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'val-217-'))
		const home = path.join(root, 'home')
		const init = run(['init', '--yes', '--name', '!!!', '--visibility', 'foo', 'bad'], root, home)
		const manifest = path.join(root, 'bad', 'paradoc.json')
		const written = fs.existsSync(manifest) ? fs.readFileSync(manifest, 'utf-8') : null
		const list = written ? run(['list'], path.join(root, 'bad'), home) : null
		fs.rmSync(root, { recursive: true, force: true })
		if (init.status === 0) {
			// If init succeeded, the project must be usable
			expect(list!.stdout + list!.stderr, written ?? '').not.toContain('Invalid project config')
		} else {
			expect(written).toBeNull()
		}
	})
})
