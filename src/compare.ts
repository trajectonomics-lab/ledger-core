/** Order two strings by UTF-16 code unit. Never locale-aware: ICU data differs between runtimes. */
export const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
