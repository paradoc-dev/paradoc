import { stdin } from 'node:process';
import { join } from 'node:path';
import { LocalFileSystem } from './local-fs.js';
import { lockFileManager } from './lock.js';
import { findRepoRoot } from './project.js';

export interface TextInputResult {
	raw: string;
	sourcePath?: string;
	baseDir: string;
	fromStdin: boolean;
}

export interface BinaryInputResult {
	data: Uint8Array;
	sourcePath?: string;
	fromStdin: boolean;
}

const STDIN_TOKEN = '-';

/**
 * Resolve an artifact target to a file path.
 *
 * - Starts with `@` → registry artifact ref, resolved via lock file
 * - `-` → stdin token (returned as-is)
 * - Anything else → file path (returned as-is)
 */
export async function resolveArtifactTarget(target: string): Promise<string> {
	if (!target || target === STDIN_TOKEN) return target;
	if (!target.startsWith('@')) return target;

	// Registry artifact ref: @namespace/name
	const projectRoot = await findRepoRoot();
	if (!projectRoot) {
		throw new Error(
			`Cannot resolve "${target}": not in an Paradoc project.\n  Run 'para init' to initialize a project first.`,
		);
	}

	await lockFileManager.init(projectRoot);
	const locked = lockFileManager.getArtifact(target);
	if (!locked) {
		throw new Error(
			`Artifact "${target}" is not installed.\n  Run 'para add ${target}' to install it first.`,
		);
	}

	return join(projectRoot, locked.path);
}

// Stdin handling requires direct access - not a storage concern
async function readStdinBuffer(): Promise<Uint8Array> {
	if (stdin.isTTY) {
		throw new Error(
			'No stdin data detected. Pipe content or provide a file path.',
		);
	}

	return await new Promise<Uint8Array>((resolve, reject) => {
		const chunks: Buffer[] = [];

		stdin.on('data', (chunk: Buffer | string) => {
			if (typeof chunk === 'string') {
				chunks.push(Buffer.from(chunk));
			} else {
				chunks.push(chunk);
			}
		});

		stdin.once('error', (error) => {
			reject(error);
		});

		stdin.once('end', () => {
			stdin.removeAllListeners('data');
			stdin.pause();
			resolve(Buffer.concat(chunks));
		});

		stdin.resume();
	});
}

export async function readTextInput(target: string): Promise<TextInputResult> {
	if (!target || target === STDIN_TOKEN) {
		const buffer = await readStdinBuffer();
		const raw = new TextDecoder('utf-8').decode(buffer);
		return {
			raw,
			baseDir: process.cwd(),
			fromStdin: true,
		};
	}

	const storage = new LocalFileSystem();
	const absolutePath = storage.getAbsolutePath(target);

	const exists = await storage.exists(absolutePath);
	if (!exists) {
		throw new Error(`File not found: ${target}\n  Resolved path: ${absolutePath}`);
	}

	const raw = await storage.readFile(absolutePath, 'utf-8');

	return {
		raw,
		sourcePath: absolutePath,
		baseDir: storage.dirname(absolutePath),
		fromStdin: false,
	};
}

export async function readBinaryInput(
	target: string,
): Promise<BinaryInputResult> {
	if (!target || target === STDIN_TOKEN) {
		const buffer = await readStdinBuffer();
		return {
			data: new Uint8Array(buffer),
			fromStdin: true,
		};
	}

	const storage = new LocalFileSystem();
	const absolutePath = storage.getAbsolutePath(target);

	const exists = await storage.exists(absolutePath);
	if (!exists) {
		throw new Error(`File not found: ${target}\n  Resolved path: ${absolutePath}`);
	}

	const buffer = await storage.readFile(absolutePath, 'binary');

	return {
		data: new Uint8Array(buffer),
		sourcePath: absolutePath,
		fromStdin: false,
	};
}
