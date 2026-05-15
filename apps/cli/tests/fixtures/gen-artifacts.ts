import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function writeFile(path: string, content: string | Buffer) {
	await fs.promises.writeFile(path, content);
}

import { para, toYAML } from '@paradoc/core';

(async () => {
	const c1 = `# Pet Addendum

## Pet Information

**Pet Name:** {{name}}
**Species:** {{species}}
**Age:** {{age}}
**Has Vaccination:** {{hasVaccination}}
`;

	const f1 = para.form({
		kind: 'form',
		version: '1.0.0',
		name: 'pet-addendum',
		title: 'Pet Addendum',
		fields: {
			name: {
				type: 'text',
				label: 'Name',
				description: 'The name of the pet',
				required: true,
			},
			species: {
				type: 'enum',
				label: 'Species',
				description: 'The species of the pet',
				required: true,
				enum: [{ value: 'dog' }, { value: 'cat' }, { value: 'bird' }, { value: 'turtle' }],
			},
			age: {
				type: 'number',
				label: 'Age',
				required: true,
				min: 0,
				max: 100,
			},
			hasVaccination: {
				type: 'boolean',
				label: 'Has Vaccination',
				required: true,
			},
		},
		layers: {
			default: {
				kind: 'inline',
				text: c1,
				mimeType: 'text/markdown',
			},
		},
		defaultLayer: 'default',
	});

	const d1 = para.document({
		kind: 'document',
		version: '1.0.0',
		name: 'pet-care-guide',
		title: 'Pet Care Guide',
		description: 'Helpful reference for new adopters',
		layers: {
			pdf: {
				kind: 'file',
				path: './Pet Care Guide.pdf',
				mimeType: 'application/pdf',
			},
		},
		defaultLayer: 'pdf',
	});

	const outputDir = __dirname;
	await writeFile(path.join(outputDir, 'pet-addendum-template.md'), c1);
	await writeFile(path.join(outputDir, 'form.yaml'), toYAML(f1));
	await writeFile(
		path.join(outputDir, 'document.yaml'),
		toYAML(d1),
	);
})();
