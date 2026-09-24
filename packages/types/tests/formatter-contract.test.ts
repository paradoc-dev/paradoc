/**
 * Shape tests for the formatter contract: the FormatKind partition and the
 * per-kind mapped types (`FormatOptionsByKind`, `FormatInputByKind`) that key
 * off it, plus the FormatResult discriminated union.
 *
 * See tests/artifact-union.test.ts for the testing idiom.
 */
import { describe, it, expectTypeOf } from 'vitest'
import type {
	FormatKind,
	NumericFormatKind,
	ContactFormatKind,
	TemporalFormatKind,
	CaptureFormatKind,
	SelectionFormatKind,
	FormatOptionsByKind,
	FormatInputByKind,
	FormatResult,
	FormattedResult,
	UnformattedResult,
	FormatterCacheStats,
	FormatterCacheBucket,
} from '../src/interfaces/formatter'

describe('FormatKind grouping', () => {
	it('partitions FormatKind with no gaps and no overlap', () => {
		type Grouped = NumericFormatKind | ContactFormatKind | TemporalFormatKind | CaptureFormatKind | SelectionFormatKind
		expectTypeOf<Grouped>().toEqualTypeOf<FormatKind>()
	})

	it('keeps duration out of the capture group, and money out of the contact group', () => {
		// @ts-expect-error duration is a TemporalFormatKind, not a CaptureFormatKind.
		const notCapture: CaptureFormatKind = 'duration'
		void notCapture
		// @ts-expect-error money is a NumericFormatKind, not a ContactFormatKind.
		const notContact: ContactFormatKind = 'money'
		void notContact
	})
})

describe('FormatOptionsByKind / FormatInputByKind', () => {
	it('is keyed by exactly every FormatKind, no more and no fewer', () => {
		expectTypeOf<keyof FormatOptionsByKind>().toEqualTypeOf<FormatKind>()
		expectTypeOf<keyof FormatInputByKind>().toEqualTypeOf<FormatKind>()
	})
})

describe('FormatResult', () => {
	it('narrows to FormattedResult when success is true', () => {
		function narrow(result: FormatResult): string {
			if (result.success) {
				expectTypeOf(result).toEqualTypeOf<FormattedResult>()
				return result.value
			}
			expectTypeOf(result).toEqualTypeOf<UnformattedResult>()
			return result.issues[0]?.message ?? ''
		}
		expectTypeOf(narrow).parameter(0).toEqualTypeOf<FormatResult>()
	})

	it("keeps 'formatted' out of an unformatted result's status", () => {
		// @ts-expect-error an UnformattedResult can never report status "formatted".
		const bad: UnformattedResult = { success: false, status: 'formatted', issues: [] }
		void bad
	})
})

describe('FormatterCacheStats', () => {
	it('reports every declared cache bucket, not a subset', () => {
		expectTypeOf<keyof FormatterCacheStats>().toEqualTypeOf<FormatterCacheBucket>()
	})
})
