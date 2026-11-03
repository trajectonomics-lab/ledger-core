import type { Account } from "./account"
import type { BalanceRow } from "./balances"
import { compareRows } from "./balances"
import { byCodeUnit } from "./compare"
import type { LedgerEntry } from "./ledger-scan"
import { toSafeAmount } from "./safe-amount"

/** A P&L row for one Dimension value; `null` collects Postings lacking the grouped key. */
export interface GroupedRow extends BalanceRow {
	readonly dimensionValue: string | null
}

const sumByAccount = (entries: readonly LedgerEntry[]): Map<string, bigint> => {
	const sums = new Map<string, bigint>()
	for (const { account, posting } of entries) {
		sums.set(account.id, (sums.get(account.id) ?? 0n) + BigInt(posting.amount))
	}
	return sums
}

/** One row per Income and Expense Leaf Account, zeros included. */
export const plainRows = (
	accounts: readonly Account[],
	entries: readonly LedgerEntry[],
): readonly BalanceRow[] => {
	const sums = sumByAccount(entries)
	return accounts
		.map((a) =>
			Object.freeze({
				entityId: a.entityId,
				accountId: a.id,
				currency: a.currency,
				amount: toSafeAmount(sums.get(a.id) ?? 0n, `profitAndLoss[${a.id}]`),
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

/** One row per `(Account, dimension value)` that has Postings; `readKey` reads the grouped key. */
export const groupedRows = (
	entries: readonly LedgerEntry[],
	readKey: (entry: LedgerEntry) => string | null,
): readonly GroupedRow[] => {
	const groups = new Map<string, { entry: LedgerEntry; value: string | null; sum: bigint }>()
	for (const entry of entries) {
		const value = readKey(entry)
		const key = JSON.stringify([entry.account.id, value])
		const sum = (groups.get(key)?.sum ?? 0n) + BigInt(entry.posting.amount)
		groups.set(key, { entry, value, sum })
	}
	return [...groups.entries()]
		.map(
			([
				key,
				{
					entry: { account },
					value,
					sum,
				},
			]) =>
				Object.freeze({
					entityId: account.entityId,
					accountId: account.id,
					currency: account.currency,
					dimensionValue: value,
					amount: toSafeAmount(sum, `profitAndLoss${key}`),
				}),
		)
		.sort(compareGrouped)
}
