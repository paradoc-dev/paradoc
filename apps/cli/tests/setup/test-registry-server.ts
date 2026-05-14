/**
 * Vitest globalSetup — auto-starts the test-registry server before all tests.
 *
 * The server is spawned as a child process running `tsx test-registry/server.ts`
 * and is killed in teardown. Tests can rely on http://localhost:4567 being available.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = 4567
const URL = `http://localhost:${PORT}/registry.json`
const POLL_INTERVAL_MS = 100
const MAX_WAIT_MS = 10_000

let serverProcess: ChildProcess | null = null

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(URL, { signal: AbortSignal.timeout(1000) })
      if (res.ok) return
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  throw new Error(`Test registry server did not start within ${MAX_WAIT_MS}ms`)
}

async function isServerAlreadyRunning(): Promise<boolean> {
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(1000) })
    return res.ok
  } catch {
    return false
  }
}

export async function setup(): Promise<() => Promise<void>> {
  // If the server is already running (e.g. started manually), reuse it
  if (await isServerAlreadyRunning()) {
    process.env.TEST_REGISTRY_URL = `http://localhost:${PORT}`
    return async () => {
      // Don't kill a server we didn't start
    }
  }

  const serverScript = path.resolve(__dirname, '../../test-registry/server.ts')

  serverProcess = spawn('tsx', [serverScript], {
    stdio: 'pipe',
    detached: false,
  })

  // Forward server stderr so failures are visible in CI logs
  serverProcess.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[test-registry] ${chunk}`)
  })

  // Fail fast if the process exits unexpectedly during startup
  const exitPromise = new Promise<never>((_, reject) => {
    serverProcess!.on('exit', (code) => {
      reject(new Error(`Test registry server exited unexpectedly with code ${code}`))
    })
  })

  await Promise.race([waitForServer(), exitPromise])

  process.env.TEST_REGISTRY_URL = `http://localhost:${PORT}`

  // Return teardown function
  return async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM')
      // Give it a moment to shut down gracefully
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGKILL')
          }
          resolve()
        }, 3000)
        serverProcess!.on('exit', () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
    serverProcess = null
  }
}
