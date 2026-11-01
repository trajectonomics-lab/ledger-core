import type { ChartOfAccounts } from "./chart-map"
import { LedgerValidationError } from "./errors"
import { accountId } from "./ids"
import type { LegInput } from "./legs"
import { assertSameCurrency, credited, legPosting } from "./legs"
import type { Transaction } from "./transaction"
import { validateTransaction } from "./transaction"

const assertEquity = (contra: LegInput, chart: ChartOfAccounts): void => {
	const id = typeof contra === "string" ? contra : contra.accountId
	const type = chart.get(accountId(id))?.type
	if (type !== undefined && type !== "equity") {
		throw new LedgerValidationError(
			"NON_EQUITY_CONTRA",
			typeof contra === "string" ? "contra" : "contra.accountId",
			id,
			`is ${type}; an opening balance is posted against an equity account`,
		)
	}
}

/**
 * Build an Opening Balance: `amount` posts on `account`, the opposite Posting on the equity
 * `contra`. `amount` is signed (an overdrawn Asset opens negative); direction is never inferred.
 */
export const openingBalance = (
	input: {
		readonly id: string
		readonly date: string
		readonly account: LegInput
		readonly contra: LegInput
		readonly amount: number
	},
	chart: ChartOfAccounts,
): Transaction => {
	const postings = [
		legPosting(input.account, input.amount, chart, "account"),
		legPosting(input.contra, credited(input.amount), chart, "contra"),
	]
	assertEquity(input.contra, chart)
	assertSameCurrency(postings, ["account", "contra"])
	return validateTransaction({ id: input.id, date: input.date, postings }, chart)
}
