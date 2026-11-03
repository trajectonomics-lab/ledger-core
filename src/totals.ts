import { byCodeUnit } from "./compare"
import type { Currency } from "./currency"
import { toSafeAmount } from "./safe-amount"

/** A named total for one `(Entity, Currency)` pair. */
export interface Total {
	readonly entityId: string
	readonly currency: Currency
	readonly amount: number
}

interface Addend {
	readonly entityId: string
	readonly currency: Currency
	readonly amount: number
}

/** Order totals by `entityId` then `currency`, by code unit. */
export const compareTotals = (a: Total, b: Total): number =>
	byCodeUnit(a.entityId, b.entityId) || byCodeUnit(a.currency, b.currency)

/**
 * Sum `sign * amount` per `(Entity, Currency)` with `BigInt`, checking each total against the safe
 * integer range. One total per pair present in `rows`, sorted.
 */
export const totalsOf = (
	rows: readonly Addend[],
	sign: 1n | -1n,
	field: string,
): readonly Total[] => {
	const sums = new Map<string, Total & { sum: bigint }>()
	for (const { entityId, currency, amount } of rows) {
		const key = JSON.stringify([entityId, currency])
		const sum = (sums.get(key)?.sum ?? 0n) + sign * BigInt(amount)
		sums.set(key, { entityId, currency, amount: 0, sum })
	}
	return Object.freeze(
		[...sums.values()]
			.map(({ entityId, currency, sum }) =>
				Object.freeze({
					entityId,
					currency,
					amount: toSafeAmount(sum, `${field}[${JSON.stringify([entityId, currency])}]`),
				}),
			)
			.sort(compareTotals),
	)
}
