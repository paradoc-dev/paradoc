/**
 * schemas-023: export-all-schemas-zod.ts hides per-schema failures and exits 0.
 * Input: a sibling copy of the package whose src/zod/module.ts also exports
 *   `BrokenSchema = z.date()` (z.toJSONSchema throws on Date). The script runs in the copy,
 *   so the shared package is never changed.
 * Expected: the script exits non-zero. Actual: it logs "Failed to export BrokenSchema" and exits 0.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pkgDir = join(__dirname, '..');
const copyDir = `${pkgDir}__val_schemas-023`;

describe('schemas-023', () => {
	it('exits non-zero when one schema fails to export', () => {
		rmSync(copyDir, { recursive: true, force: true });
		cpSync(pkgDir, copyDir, { recursive: true, verbatimSymlinks: true, filter: (src) => !src.includes('__validation__') });
		try {
			appendFileSync(join(copyDir, 'src/zod/module.ts'), '\nexport const BrokenSchema = z.date();\n');
			const run = spawnSync('pnpm', ['exec', 'tsx', 'scripts/export-all-schemas-zod.ts'], { cwd: copyDir, encoding: 'utf-8' });
			const failedLine = (run.stderr + run.stdout).split('\n').find((l) => l.includes('Failed to export BrokenSchema'));
			// The injected schema did fail inside the script (proves the swallow path ran).
			expect(failedLine).toContain('Failed to export BrokenSchema');
			expect({ status: run.status, failedLine }).toEqual({ status: 1, failedLine });
		} finally {
			rmSync(copyDir, { recursive: true, force: true });
		}
	}, 120_000);
});
