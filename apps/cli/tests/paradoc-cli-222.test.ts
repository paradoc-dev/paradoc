import { describe, it, expect, vi } from 'vitest'

const opened = vi.hoisted(() => ({ urls: [] as string[] }))
vi.mock('open', () => ({ default: async (url: string) => { opened.urls.push(url) } }))

describe('paradoc-cli-222: console opens the web console', () => {
	it('opens https://console.paradoc.dev', async () => {
		const { createConsoleCommand } = await import('../src/commands/console.js')
		await createConsoleCommand().parseAsync([], { from: 'user' })
		expect(opened.urls).toEqual(['https://console.paradoc.dev'])
	})
})
