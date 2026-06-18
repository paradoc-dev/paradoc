/**
 * Exact-decimal arithmetic, in-house, backed by `bigint`. No floating point is
 * ever used, so `19.95 * 3` is exactly `59.85` and money/percentage math is
 * exact. A value is `n / 10^scale` with `scale >= 0`.
 *
 * Rounding defaults to half-up (commercial rounding). Division is computed to a
 * bounded number of decimal places and then trimmed of trailing zeros.
 */

export type RoundingMode = 'half-up' | 'down' | 'floor' | 'ceil'

/** Default decimal places retained by division before trimming. */
const DIV_SCALE = 20

export class DivisionByZeroError extends Error {
	constructor() {
		super('Division by zero')
		this.name = 'DivisionByZeroError'
	}
}

const DECIMAL_RE = /^-?\d+(\.\d+)?$/

function pow10(n: number): bigint {
	return 10n ** BigInt(n)
}

function absBig(x: bigint): bigint {
	return x < 0n ? -x : x
}

export class Decimal {
	private constructor(
		readonly n: bigint,
		readonly scale: number,
	) {}

	static fromString(s: string): Decimal {
		const str = s.trim()
		if (!DECIMAL_RE.test(str)) {
			throw new RangeError(`Invalid decimal literal: ${JSON.stringify(s)}`)
		}
		const negative = str.startsWith('-')
		const body = negative ? str.slice(1) : str
		const dot = body.indexOf('.')
		if (dot === -1) {
			return new Decimal(BigInt((negative ? '-' : '') + body), 0)
		}
		const intPart = body.slice(0, dot)
		const fracPart = body.slice(dot + 1)
		const digits = (intPart + fracPart).replace(/^0+(?=\d)/, '')
		const mag = BigInt(digits === '' ? '0' : digits)
		return new Decimal(negative ? -mag : mag, fracPart.length).trim()
	}

	static fromInt(i: bigint | number): Decimal {
		return new Decimal(typeof i === 'bigint' ? i : BigInt(Math.trunc(i)), 0)
	}

	static readonly ZERO = new Decimal(0n, 0)

	/** Bring two decimals to a common scale, returning aligned magnitudes. */
	private static align(a: Decimal, b: Decimal): { an: bigint; bn: bigint; scale: number } {
		if (a.scale === b.scale) return { an: a.n, bn: b.n, scale: a.scale }
		const scale = Math.max(a.scale, b.scale)
		return {
			an: a.n * pow10(scale - a.scale),
			bn: b.n * pow10(scale - b.scale),
			scale,
		}
	}

	add(b: Decimal): Decimal {
		const { an, bn, scale } = Decimal.align(this, b)
		return new Decimal(an + bn, scale).trim()
	}

	sub(b: Decimal): Decimal {
		const { an, bn, scale } = Decimal.align(this, b)
		return new Decimal(an - bn, scale).trim()
	}

	mul(b: Decimal): Decimal {
		return new Decimal(this.n * b.n, this.scale + b.scale).trim()
	}

	div(b: Decimal, rm: RoundingMode = 'half-up'): Decimal {
		if (b.n === 0n) throw new DivisionByZeroError()
		// result = (this / b) to DIV_SCALE places.
		const exp = DIV_SCALE + b.scale - this.scale
		let num = this.n
		let den = b.n
		if (exp >= 0) num *= pow10(exp)
		else den *= pow10(-exp)
		return new Decimal(roundDiv(num, den, rm), DIV_SCALE).trim()
	}

	mod(b: Decimal): Decimal {
		if (b.n === 0n) throw new DivisionByZeroError()
		const { an, bn, scale } = Decimal.align(this, b)
		return new Decimal(an % bn, scale).trim()
	}

	neg(): Decimal {
		return new Decimal(-this.n, this.scale)
	}

	abs(): Decimal {
		return this.n < 0n ? this.neg() : this
	}

	/** -1, 0, or 1. */
	cmp(b: Decimal): number {
		const { an, bn } = Decimal.align(this, b)
		return an < bn ? -1 : an > bn ? 1 : 0
	}

	eq(b: Decimal): boolean {
		return this.cmp(b) === 0
	}
	lt(b: Decimal): boolean {
		return this.cmp(b) < 0
	}
	lte(b: Decimal): boolean {
		return this.cmp(b) <= 0
	}
	gt(b: Decimal): boolean {
		return this.cmp(b) > 0
	}
	gte(b: Decimal): boolean {
		return this.cmp(b) >= 0
	}

	isZero(): boolean {
		return this.n === 0n
	}

	/** Round to `digits` decimal places (default 0). Negative/fractional
	 * digits are clamped to a valid non-negative integer scale. */
	round(digits = 0, rm: RoundingMode = 'half-up'): Decimal {
		return this.toScale(Math.max(0, Math.trunc(digits)), rm)
	}

	floor(): Decimal {
		return this.toScale(0, 'floor')
	}

	ceil(): Decimal {
		return this.toScale(0, 'ceil')
	}

	private toScale(target: number, rm: RoundingMode): Decimal {
		if (target >= this.scale) {
			return new Decimal(this.n * pow10(target - this.scale), target).trim()
		}
		const factor = pow10(this.scale - target)
		return new Decimal(roundDiv(this.n, factor, rm), target).trim()
	}

	/** Remove trailing fractional zeros, keeping the value identical. */
	private trim(): Decimal {
		let { n, scale } = this
		while (scale > 0 && n % 10n === 0n) {
			n /= 10n
			scale--
		}
		return new Decimal(n, scale)
	}

	toString(): string {
		const neg = this.n < 0n
		const digits = absBig(this.n).toString()
		if (this.scale === 0) return (neg ? '-' : '') + digits
		const padded = digits.padStart(this.scale + 1, '0')
		const cut = padded.length - this.scale
		return `${neg ? '-' : ''}${padded.slice(0, cut)}.${padded.slice(cut)}`
	}

	/** Lossy conversion to a JS number, for interop only. */
	toNumber(): number {
		return Number(this.toString())
	}

	toJSON(): string {
		return this.toString()
	}
}

/** Integer division of `num/den` rounded per `rm`. */
function roundDiv(num: bigint, den: bigint, rm: RoundingMode): bigint {
	if (den < 0n) {
		num = -num
		den = -den
	}
	const q = num / den
	const r = num % den
	if (r === 0n) return q

	const negative = num < 0n
	switch (rm) {
		case 'down':
			return q
		case 'floor':
			return negative ? q - 1n : q
		case 'ceil':
			return negative ? q : q + 1n
		case 'half-up': {
			// Round away from zero when the remainder is at least half the divisor.
			if (absBig(r) * 2n >= den) return negative ? q - 1n : q + 1n
			return q
		}
	}
}
