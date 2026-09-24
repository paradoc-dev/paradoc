import { z } from 'zod';

/** A SHA-256 content checksum, written `sha256:` and 64 lowercase hex digits. */
export const ChecksumSchema = z.string()
	.regex(/^sha256:[a-f0-9]{64}$/)
	.describe('SHA-256 checksum for integrity verification');
