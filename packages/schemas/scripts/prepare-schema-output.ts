import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(packageDir, 'schemas');

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
