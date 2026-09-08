/**
 * Redraws the vendor packet's annex fixture.
 *
 * The certificate stands in for a PDF a vendor uploads. It is checked in so a
 * project that installs the vendor packet block has annex bytes without a Node
 * render, and it is generated so nobody has to keep an opaque binary in step
 * with the composition beside it by hand.
 *
 *   pnpm --filter @paradoc/components regenerate:annex
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { insuranceCertificatePdf } from "../src/examples/pdf";

const target = fileURLToPath(new URL("../src/examples/certificate-of-insurance.pdf", import.meta.url));
const bytes = await insuranceCertificatePdf();
await writeFile(target, bytes);
console.log(`Wrote ${bytes.length} bytes to ${target}`);
