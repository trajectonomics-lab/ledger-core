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
 * integer range. One total per pair among the addends, sorted; a zero addend still yields its pair,
 * which is how P&L seeds its totals. `fieldOf` gives the output path an overflow reports for a pair.
 */
export const totalsOf = (
	addends: readonly Addend[],
	sign: 1n | -1n,
	fieldOf: (pair: string) => string,
): readonly Total[] => {
	const slots = new Map<string, { entityId: string; currency: Currency; sum: bigint }>()
	for (const { entityId, currency, amount } of addends) {
		const key = JSON.stringify([entityId, currency])
		const slot = slots.get(key) ?? { entityId, currency, sum: 0n }
		slot.sum += sign * BigInt(amount)
		slots.set(key, slot)
	}
	return Object.freeze(
		[...slots.values()]
			.map(({ entityId, currency, sum }) =>
				Object.freeze({
					entityId,
					currency,
					amount: toSafeAmount(sum, fieldOf(`${entityId}/${currency}`)),
				}),
			)
			.sort(compareTotals),
	)
}
