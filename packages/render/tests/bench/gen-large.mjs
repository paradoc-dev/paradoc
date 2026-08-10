/**
 * Generate a large benchmark fixture: a ~20-page contract with 24 markers,
 * converted with the same Chrome pipeline the platform uses.
 *
 * Usage: node tests/bench/gen-large.mjs
 * Requires Google Chrome locally; puppeteer is borrowed from documents-service.
 */
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
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

const paragraph = `The parties acknowledge and agree that the obligations set forth herein are material, and that any failure to perform shall constitute a breach subject to the remedies described in this agreement. Each party has had the opportunity to review this agreement with counsel of its choosing, and the language herein shall be construed as jointly drafted. `

let body = '<h1>Master Services Agreement</h1>'
for (let section = 1; section <= 12; section++) {
  body += `<h2>Section ${section}</h2>`
  for (let p = 0; p < 6; p++) body += `<p>${section}.${p + 1} ${paragraph.repeat(2)}</p>`
  const signer = section - 1
  body += `<p>Party ${signer} signature: ${encode(signer, 0)}________________</p>`
  body += `<p>Party ${signer} initials: ${encode(signer, 1)}______</p>`
  // Repeated anchor text for occurrence-selection tests.
  if (section % 4 === 0) body += `<p>Approved by manager: ________</p>`
}
// Unique anchor text for unique-or-throw tests.
body += `<p>Witnessed by: ________________</p>`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body { font-family: Georgia, serif; font-size: 12px; margin: 48px; }
h2 { page-break-before: auto; }
</style></head><body>${body}</body></html>`

const htmlPath = join(here, 'large-contract.html')
writeFileSync(htmlPath, html)

const puppeteer = require2('puppeteer')
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage()
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' })
await page.pdf({
  path: join(here, '../fixtures/large-contract.pdf'),
  format: 'Letter',
  printBackground: true,
})
await browser.close()
console.log('large-contract.pdf written')
