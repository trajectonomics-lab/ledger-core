/**
 * Nominal tag. The private member makes the type unforgeable: TypeScript omits private members
 * from object spreads and rejects object literals, so only an explicit cast can fake a brand.
 */
export declare class Nominal<Tag extends string> {
	private readonly tag: Tag
}

/** A `T` carrying a nominal tag so unrelated values cannot be mixed up. */
export type Brand<T, Tag extends string> = T & Nominal<Tag>
