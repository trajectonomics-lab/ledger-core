import type { BalanceRow } from "./balances"
import type { ChartOfAccounts } from "./chart-map"
import { dimensionOf, matchesAll } from "./dimensions"
import { scanLedger } from "./ledger-scan"
import { inPeriod, parsePeriod } from "./period"
import type { GroupedRow } from "./profit-and-loss-rows"
import { groupedRows, plainRows } from "./profit-and-loss-rows"
import type { Total } from "./totals"
import { totalsOf } from "./totals"
import type { Transaction } from "./transaction"

/** P&L: raw rows for Income and Expense Leaf Accounts and income-minus-expenses totals. */
export interface ProfitAndLoss<Row extends BalanceRow = BalanceRow> {
	readonly rows: readonly Row[]
	readonly totals: readonly Total[]
}

/**
 * The period and optional Dimension handling of a P&L query. An absent `from` means "from the
 * start of the ledger". `where` is exact-match, ANDed; a missing key never matches.
 */
export interface ProfitAndLossOptions {
	readonly from?: string
	readonly to: string
	readonly groupBy?: string
	readonly where?: Readonly<Record<string, string>>
}

/**
 * Income minus Expenses over an inclusive period, per `(Entity, Currency)`, positive when income
 * exceeds expenses. Rows stay raw signed, so the total is the negated sum of the rows. With
 * `groupBy`, rows split by that Dimension's value and only existing groups appear.
 */
export function profitAndLoss(
	transactions: readonly Transaction[],
	options: ProfitAndLossOptions & { readonly groupBy: string },
	chart: ChartOfAccounts,
): ProfitAndLoss<GroupedRow>
export function profitAndLoss(
	transactions: readonly Transaction[],
	options: ProfitAndLossOptions & { readonly groupBy?: undefined },
	chart: ChartOfAccounts,
): ProfitAndLoss
export function profitAndLoss(
	transactions: readonly Transaction[],
	options: ProfitAndLossOptions,
	chart: ChartOfAccounts,
): ProfitAndLoss<BalanceRow | GroupedRow>
export function profitAndLoss(
	transactions: readonly Transaction[],
	options: ProfitAndLossOptions,
	chart: ChartOfAccounts,
): ProfitAndLoss<BalanceRow | GroupedRow> {
	const period = parsePeriod(options)
	const entries = scanLedger(transactions, chart).filter(
		({ account, posting, date }) =>
			(account.type === "income" || account.type === "expense") &&
			inPeriod(period, date) &&
			matchesAll(posting, options.where ?? {}),
	)
	const { groupBy } = options
	const rows =
		groupBy === undefined
			? plainRows(
					[...chart.values()].filter(
						(a) => chart.isLeaf(a.id) && (a.type === "income" || a.type === "expense"),
					),
					entries,
				)
			: groupedRows(entries, ({ posting }) => dimensionOf(posting, groupBy))
	return Object.freeze({ rows: Object.freeze(rows), totals: totalsOf(rows, -1n, "profitAndLoss") })
}
