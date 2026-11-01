/** Make a Map read-only at runtime, matching its `ReadonlyMap` type. */
export const seal = <K, V>(map: Map<K, V>): Map<K, V> => {
	const refuse = (): never => {
		throw new TypeError("a ChartOfAccounts is read-only")
	}
	for (const method of ["set", "delete", "clear"]) {
		Object.defineProperty(map, method, { value: refuse })
	}
	return map
}
