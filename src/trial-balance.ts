import { leafBalances } from "./balances"
import type { ChartOfAccounts } from "./chart-map"
import type { Currency } from "./currency"
import type { AccountId } from "./ids"
import { totalsOf } from "./totals"
import type { Transaction } from "./transaction"

/** One Leaf Account's net Balance as a magnitude in its Debit or Credit column. */
export interface TrialBalanceRow {
	readonly entityId: string
	readonly accountId: AccountId
	readonly currency: Currency
	readonly debit: number
	readonly credit: number
}

/** Column totals for one `(Entity, Currency)` pair. They always match. */
export interface TrialBalanceTotal {
	readonly entityId: string
	readonly currency: Currency
	readonly debit: number
	readonly credit: number
}

/** A Trial Balance: one row per Leaf Account and column totals per `(Entity, Currency)`. */
export interface TrialBalance {
	readonly rows: readonly TrialBalanceRow[]
	readonly totals: readonly TrialBalanceTotal[]
}

/**
 * Every Leaf Account's net Balance at `asOf`, zeros included: positive in `debit`, negative in
 * `credit` as a magnitude (the one exception to raw signed rows).
 */
export const trialBalance = (
	transactions: readonly Transaction[],
	asOf: string,
	chart: ChartOfAccounts,
): TrialBalance => {
	const rows = leafBalances(transactions, asOf, chart, (a) => `trialBalance.rows[${a.id}]`).map(
		({ entityId, accountId, currency, amount }) =>
			Object.freeze({
				entityId,
				accountId,
				currency,
				debit: Math.max(amount, 0),
				credit: Math.max(-amount, 0),
			}),
	)
	const debits = totalsOf(
		rows.map((r) => ({ ...r, amount: r.debit })),
		1n,
		(pair) => `trialBalance.totals[${pair}].debit`,
	)
	const credits = new Map(
		totalsOf(
			rows.map((r) => ({ ...r, amount: r.credit })),
			1n,
			(pair) => `trialBalance.totals[${pair}].credit`,
		).map((t) => [JSON.stringify([t.entityId, t.currency]), t.amount]),
	)
	return Object.freeze({
		rows: Object.freeze(rows),
		totals: Object.freeze(
			debits.map(({ entityId, currency, amount }) =>
				Object.freeze({
					entityId,
					currency,
					debit: amount,
					credit: credits.get(JSON.stringify([entityId, currency]))!,
				}),
			),
		),
	})
}
