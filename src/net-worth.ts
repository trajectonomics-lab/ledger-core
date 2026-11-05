import type { Account } from "./account"
import type { BalanceRow } from "./balances"
import { leafBalances } from "./balances"
import type { ChartOfAccounts } from "./chart-map"
import type { Total } from "./totals"
import { totalsOf } from "./totals"
import type { Transaction } from "./transaction"

/** Net Worth: the asset and liability Balance rows behind it, and one total per `(Entity, Currency)`. */
export interface NetWorth {
	readonly rows: readonly BalanceRow[]
	readonly totals: readonly Total[]
}

/**
 * Assets minus Liabilities up to and including `asOf`, per `(Entity, Currency)`, positive when
 * assets exceed liabilities. Rows stay raw signed; Equity is not part of it. Raw liabilities are
 * negative, so the natural-sign total is the plain sum of the rows.
 */
export const netWorth = (
	transactions: readonly Transaction[],
	asOf: string,
	chart: ChartOfAccounts,
): NetWorth => {
	const counted = (account: Account) => account.type === "asset" || account.type === "liability"
	const rows = leafBalances(transactions, asOf, chart, (account) =>
		counted(account) ? `netWorth.rows[${account.id}]` : `netWorth[${account.id}]`,
	).filter((row) => counted(chart.get(row.accountId)!))
	return Object.freeze({
		rows: Object.freeze(rows),
		totals: totalsOf(rows, 1n, (pair) => `netWorth.totals[${pair}]`),
	})
}
