import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distFile = path.join(__dirname, '../dist/index.js');

if (!fs.existsSync(distFile)) {
  console.log('No dist/index.js found, skipping import attribute fix');
  process.exit(0);
}

let content = fs.readFileSync(distFile, 'utf-8');
const originalContent = content;

// Fix schema.json imports by adding the type attribute
// Match: import bundledSchema from "@paradoc/schemas/schema.json";
// Replace with: import bundledSchema from "@paradoc/schemas/schema.json" with { type: "json" };
content = content.replace(
  /import\s+(\w+)\s+from\s+["']@paradoc\/schemas\/schema\.json["'];/g,
  'import $1 from "@paradoc/schemas/schema.json" with { type: "json" };'
);

if (content !== originalContent) {
  fs.writeFileSync(distFile, content, 'utf-8');
  console.log('✅ Fixed JSON import attributes in dist/index.js');
} else {
  console.log('ℹ️  No JSON imports found to fix');
}
