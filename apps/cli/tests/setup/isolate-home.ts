/**
 * Vitest setupFiles entry: points this worker at its own temporary home before
 * any test module loads. Every in-process config call and every spawned CLI
 * inherits it, so no test can touch the real `~/.paradoc`.
 *
 * A test that needs a specific home still sets its own HOME on the child it spawns.
 */

import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { inject } from 'vitest'

const root = inject('testHomeRoot')
const home = join(root, `worker-${process.env.VITEST_POOL_ID ?? process.pid}`)

mkdirSync(join(home, '.config'), { recursive: true })
mkdirSync(join(home, '.cache'), { recursive: true })

process.env.HOME = home
process.env.USERPROFILE = home
process.env.XDG_CONFIG_HOME = join(home, '.config')
process.env.XDG_CACHE_HOME = join(home, '.cache')

if (homedir() !== home) {
  throw new Error(`Test home isolation failed: os.homedir() is ${homedir()}, expected ${home}`)
}
