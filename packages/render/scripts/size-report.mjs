import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { performance } from 'node:perf_hooks'
import { build } from 'esbuild'

const packageRoot = new URL('../', import.meta.url)
const entries = ['index', 'text', 'pdf', 'docx']
const external = ['@paradoc/serialization', '@paradoc/types']

const dist = {}
const browser = {}
const serverImportMs = {}

for (const entry of entries) {
  const path = new URL(`../dist/${entry}.js`, import.meta.url)
  const contents = await readFile(path)
  dist[entry] = { bytes: contents.length, gzip_bytes: gzipSync(contents).length }

  const bundled = await build({
    entryPoints: [fileURLToPath(path)],
    bundle: true,
    external,
    format: 'esm',
    minify: true,
    platform: 'browser',
    target: ['es2022'],
    write: false,
  })
  const output = bundled.outputFiles[0].contents
  browser[entry] = { bytes: output.length, gzip_bytes: gzipSync(output).length }

  const started = performance.now()
  await import(`${path.href}?size-report=${Date.now()}-${entry}`)
  serverImportMs[entry] = performance.now() - started
}

const packed = JSON.parse(execFileSync(
  'npm',
  ['pack', '--dry-run', '--json', '--ignore-scripts'],
  { cwd: packageRoot, encoding: 'utf8' },
))[0]
const publishedFiles = packed.files.map(({ path }) => path)
const unexpectedFiles = publishedFiles.filter((path) =>
  !path.startsWith('dist/') && !['LICENSE', 'README.md', 'package.json'].includes(path))
if (unexpectedFiles.length > 0) {
  throw new Error(`Unexpected files in publish tarball: ${unexpectedFiles.join(', ')}`)
}

console.log(JSON.stringify({
  dist,
  browser_bundle: browser,
  server_import_ms: serverImportMs,
  package: {
    filename: packed.filename,
    packed_bytes: packed.size,
    unpacked_bytes: packed.unpackedSize,
    files: publishedFiles,
  },
}, null, 2))
