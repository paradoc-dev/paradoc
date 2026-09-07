export const DEFAULT_CACHE_SIZE = 64
export const MAX_CACHE_SIZE = 256

export interface CacheSnapshot {
	readonly size: number
	readonly hits: number
	readonly misses: number
	readonly limit: number
}

/** Small per-formatter LRU cache for Intl formatter instances. */
export class BoundedCache<T> {
	private readonly entries = new Map<string, T>()
	private hitCount = 0
	private missCount = 0

	constructor(readonly limit: number) {}

	get(key: string): T | undefined {
		const value = this.entries.get(key)
		if (value === undefined) {
			this.missCount += 1
			return undefined
		}

		this.hitCount += 1
		this.entries.delete(key)
		this.entries.set(key, value)
		return value
	}

	set(key: string, value: T): void {
		this.entries.delete(key)
		this.entries.set(key, value)
		while (this.entries.size > this.limit) {
			const oldest = this.entries.keys().next().value
			if (oldest === undefined) break
			this.entries.delete(oldest)
		}
	}

	snapshot(): CacheSnapshot {
		return {
			size: this.entries.size,
			hits: this.hitCount,
			misses: this.missCount,
			limit: this.limit,
		}
	}
}

/** Stable serialization for Intl option objects whose key order may vary. */
export function stableSerialize(value: unknown): string {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value)
	}

	if (Array.isArray(value)) {
		return `[${value.map(stableSerialize).join(',')}]`
	}

	const record = value as Record<string, unknown>
	return `{${Object.keys(record)
		.sort()
		.filter((key) => record[key] !== undefined)
		.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
		.join(',')}}`
}
