import type { ChartOfAccounts } from "./chart-map"
import { parseISODate } from "./date"
import { LedgerValidationError } from "./errors"
import type { Transaction } from "./transaction"
import { validateTransaction } from "./transaction"

/** Build a Reversal; `path` prefixes error fields so `amend` can mirror its own input shape. */
export const reverseAt = (
	tx: Transaction,
	input: { readonly id: string; readonly date: string },
	chart: ChartOfAccounts,
	path: string,
): Transaction => {
	const date = parseISODate(input.date, `${path}date`)
	if (input.id === tx.id) {
		throw new LedgerValidationError(
			"DUPLICATE_TRANSACTION_ID",
			`${path}id`,
			input.id,
			"reuses the id of the transaction it reverses",
		)
	}
	if (date < tx.date) {
		throw new LedgerValidationError(
			"REVERSAL_BEFORE_ORIGINAL",
			`${path}date`,
			input.date,
			`is before the original's date ${tx.date}`,
		)
	}
	const postings = tx.postings.map(({ amount, ...rest }) => ({ ...rest, amount: -amount }))
	return validateTransaction({ id: input.id, date, postings, linkedTo: tx.id }, chart)
}

/** Build a Reversal: the original's Postings in order, every sign flipped, linked to it. */
export const reverse = (
	tx: Transaction,
	input: { readonly id: string; readonly date: string },
	chart: ChartOfAccounts,
): Transaction => reverseAt(tx, input, chart, "")
