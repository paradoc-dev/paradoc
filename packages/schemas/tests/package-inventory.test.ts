import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../src/zod/config';

const packageDir = join(__dirname, '..');
const liveRootSchemas = [
	'config.json',
	'lock.json',
	'manifest.json',
	'registry-item.json',
	'registry.json',
	'schema.json',
];

describe('published package schema inventory', () => {
	it('contains only the current dated set and every live root schema', () => {
		const pack = JSON.parse(
			execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
				cwd: packageDir,
				encoding: 'utf8',
			}),
		) as Array<{ files: Array<{ path: string }> }>;
		const schemaFiles = pack[0]!.files.map(({ path }) => path).filter((path) => path.startsWith('schemas/')).sort();
		const currentFiles = readdirSync(join(packageDir, 'schemas', SCHEMA_VERSION))
			.filter((file) => file.endsWith('.json'))
			.map((file) => `schemas/${SCHEMA_VERSION}/${file}`);

		expect(schemaFiles).toEqual(
			[
				`schemas/${SCHEMA_VERSION}.json`,
				...currentFiles,
				...liveRootSchemas.map((file) => `schemas/${file}`),
			].sort(),
		);
	});
});
