declare const brand: unique symbol

/** Nominal typing: a `T` carrying a phantom tag so unrelated strings cannot be mixed up. */
export type Brand<T, Tag extends string> = T & { readonly [brand]: Tag }
