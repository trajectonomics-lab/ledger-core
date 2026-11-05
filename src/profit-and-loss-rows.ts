import type { Account } from "./account"
import type { BalanceRow } from "./balances"
import { compareRows } from "./balances"
import { byCodeUnit } from "./compare"
import { dimensionOf } from "./dimensions"
import type { ScannedPosting } from "./ledger-scan"
import { toSafeAmount } from "./safe-amount"

/** A P&L row for one Dimension value; `null` collects Postings lacking the grouped key. */
export interface GroupedRow extends BalanceRow {
	readonly dimensionValue: string | null
}

const sumByAccount = (entries: readonly ScannedPosting[]): Map<string, bigint> => {
	const sums = new Map<string, bigint>()
	for (const { account, posting } of entries) {
		sums.set(account.id, (sums.get(account.id) ?? 0n) + BigInt(posting.amount))
	}
	return sums
}

/** One row per Income and Expense Leaf Account, zeros included. */
export const plainRows = (
	accounts: readonly Account[],
	entries: readonly ScannedPosting[],
): readonly BalanceRow[] => {
	const sums = sumByAccount(entries)
	return accounts
		.map((a) =>
			Object.freeze({
				entityId: a.entityId,
				accountId: a.id,
				currency: a.currency,
				amount: toSafeAmount(sums.get(a.id) ?? 0n, `profitAndLoss.rows[${a.id}]`),
			}),
		)
		.sort(compareRows)
}

const compareGrouped = (a: GroupedRow, b: GroupedRow): number =>
	compareRows(a, b) ||
	(a.dimensionValue === b.dimensionValue
		? 0
		: a.dimensionValue === null
			? -1
			: b.dimensionValue === null
				? 1
				: byCodeUnit(a.dimensionValue, b.dimensionValue))

/** One row per `(Account, value of the `groupBy` Dimension)` that has Postings. */
export const groupedRows = (
	entries: readonly ScannedPosting[],
	groupBy: string,
): readonly GroupedRow[] => {
	const groups = new Map<string, { entry: ScannedPosting; value: string | null; sum: bigint }>()
	for (const entry of entries) {
		const value = dimensionOf(entry.posting, groupBy)
		const key = JSON.stringify([entry.account.id, value])
		const sum = (groups.get(key)?.sum ?? 0n) + BigInt(entry.posting.amount)
		groups.set(key, { entry, value, sum })
	}
	return [...groups.values()]
		.map(({ entry: { account }, value, sum }) =>
			Object.freeze({
				entityId: account.entityId,
				accountId: account.id,
				currency: account.currency,
				dimensionValue: value,
				amount: toSafeAmount(sum, `profitAndLoss.rows[${account.id}]`),
			}),
		)
		.sort(compareGrouped)
}
