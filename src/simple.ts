import type { ChartOfAccounts } from "./chart-map"
import type { LegInput } from "./legs"
import { assertSameCurrency, credited, legPosting, magnitude } from "./legs"
import type { Transaction } from "./transaction"
import { validateTransaction } from "./transaction"

/** Build a Simple Entry: `+amount` on `debit`, `-amount` on `credit`. `amount` is a magnitude. */
export const simple = (
	input: {
		readonly id: string
		readonly date: string
		readonly debit: LegInput
		readonly credit: LegInput
		readonly amount: number
	},
	chart: ChartOfAccounts,
): Transaction => {
	const amount = magnitude(input.amount, "amount")
	const postings = [
		legPosting(input.debit, amount, chart, "debit"),
		legPosting(input.credit, credited(amount), chart, "credit"),
	]
	assertSameCurrency(postings, ["debit", "credit"])
	return validateTransaction({ id: input.id, date: input.date, postings }, chart)
}
