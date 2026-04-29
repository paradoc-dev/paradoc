/**
 * CLI Update Notifier
 *
 * Non-blocking update check that runs at most once per 24 hours.
 * Prints a one-line notice after command output when a newer version is available.
 * Gracefully handles the package not being on npm yet (silent no-op).
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { promises as fs, readFileSync } from 'node:fs'
import semver from 'semver'
import kleur from 'kleur'
import { VERSION } from '../constants.js'

const CACHE_DIR = join(homedir(), '.paradoc')
const CACHE_FILE = join(CACHE_DIR, 'update-check.json')
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const FETCH_TIMEOUT_MS = 5_000
const NPM_REGISTRY_URL = 'https://registry.npmjs.org/@paradoc/cli/latest'

interface UpdateCache {
	lastChecked: number
	latestVersion: string
}

function shouldSkipCheck(): boolean {
	if (VERSION === 'dev') return true
	if (process.env.CI) return true
	if (process.env.OFM_NO_UPDATE_CHECK) return true
	if (!process.stdout.isTTY) return true
	return false
}

async function readCache(): Promise<UpdateCache | null> {
	try {
		const content = await fs.readFile(CACHE_FILE, 'utf-8')
		return JSON.parse(content) as UpdateCache
	} catch {
		return null
	}
}

async function writeCache(cache: UpdateCache): Promise<void> {
	try {
		await fs.mkdir(CACHE_DIR, { recursive: true })
		await fs.writeFile(CACHE_FILE, JSON.stringify(cache))
	} catch {
		// Silently ignore write errors
	}
}

/**
 * Fire-and-forget async check for updates.
 * Fetches npm registry, writes cache file. All errors silenced.
 */
export function checkForUpdate(): void {
	if (shouldSkipCheck()) return

	// Fire and forget — no await, no unhandled rejection
	void (async () => {
		try {
			const cache = await readCache()
			if (cache && Date.now() - cache.lastChecked < CHECK_INTERVAL_MS) {
				return
			}

			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

			try {
				const response = await fetch(NPM_REGISTRY_URL, {
					headers: { Accept: 'application/json' },
					signal: controller.signal,
				})
				clearTimeout(timeoutId)

				if (!response.ok) return

				const data = (await response.json()) as { version?: string }
				if (!data.version) return

				await writeCache({
					lastChecked: Date.now(),
					latestVersion: data.version,
				})
			} catch {
				// Network error, timeout, npm 404 — all silenced
			}
		} catch {
			// Outer safety net
		}
	})()
}

/**
 * Synchronously read cache and print update notice if a newer version exists.
 */
export function printUpdateNotice(): void {
	if (shouldSkipCheck()) return

	try {
		const content = readFileSync(CACHE_FILE, 'utf-8')
		const cache = JSON.parse(content) as UpdateCache

		if (cache.latestVersion && semver.gt(cache.latestVersion, VERSION)) {
			console.log()
			console.log(
				kleur.yellow(
					`Update available: ${VERSION} \u2192 ${cache.latestVersion}  Run: npm i -g @paradoc/cli`,
				),
			)
		}
	} catch {
		// Cache missing or unreadable — silent
	}
}
