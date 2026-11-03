import type { Posting } from "./posting"

/** A Posting's value for a Dimension key, or null when it lacks the key. Inherited keys never count. */
export const dimensionOf = (posting: Posting, key: string): string | null =>
	posting.dimensions !== undefined && Object.hasOwn(posting.dimensions, key)
		? posting.dimensions[key]!
		: null

/** True when the Posting carries every `where` entry with exactly that value. */
export const matchesAll = (posting: Posting, where: Readonly<Record<string, string>>): boolean =>
	Object.entries(where).every(([key, value]) => dimensionOf(posting, key) === value)
