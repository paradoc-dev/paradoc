/**
 * Generate the encoded/clean fixture pair for core's auto-placement seal
 * test. Both PDFs render identical visible content; the encoded one carries
 * invisible markers (signerIndex 0 signature, signerIndex 1 initials),
 * matching the slot order core assigns in the test form.
 *
 * Usage: node tests/bench/gen-auto-pair.mjs
 */
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const here = fileURLToPath(new URL('.', import.meta.url))
const require2 = createRequire(
  join(here, '../../../../../platform/apps/documents-service/node_modules/x.js'),
)

const ALPHABET = ['⠀', '⠁', '⠂', '⠄']
function encode(signerIndex, fieldType) {
  let result = ''
  let remaining = signerIndex
  for (let i = 0; i < 6; i++) {
    result = ALPHABET[remaining % 4] + result
    remaining = Math.floor(remaining / 4)
  }
  result += ALPHABET[Math.floor(fieldType / 4)]
  result += ALPHABET[fieldType % 4]
  return result
}

const page = (sigPrefix, iniPrefix) => `<!doctype html><html><head><meta charset="utf-8"><style>
body { font-family: Georgia, serif; font-size: 12px; margin: 48px; }
</style></head><body>
<h1>Agreement</h1>
<p>The undersigned agree to the terms above.</p>
<p>Client signature: ${sigPrefix}________________</p>
<p>Client initials: ${iniPrefix}______</p>
</body></html>`

const outDir = join(here, '../../../core/tests/artifacts/form/fixtures')
mkdirSync(outDir, { recursive: true })

const puppeteer = require2('puppeteer')
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const tab = await browser.newPage()
for (const [name, html] of [
  ['auto-encoded.pdf', page(encode(0, 0), encode(1, 1))],
  ['auto-clean.pdf', page('', '')],
]) {
  const htmlPath = join(here, `auto-${name}.html`)
  writeFileSync(htmlPath, html)
  await tab.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' })
  await tab.pdf({ path: join(outDir, name), format: 'Letter', printBackground: true })
}
await browser.close()
console.log('auto fixture pair written')
