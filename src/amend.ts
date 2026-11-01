import type { ChartOfAccounts } from "./chart-map"
import { LedgerValidationError } from "./errors"
import { reverseAt } from "./reverse"
import type { Transaction, TransactionInput } from "./transaction"
import { validateTransaction } from "./transaction"

/**
 * Build an Amendment: `[reversal, replacement]`, both linked to the original. The replacement's
 * own `linkedTo` is overwritten with the original's id.
 */
export const amend = (
	tx: Transaction,
	input: {
		readonly reversal: { readonly id: string; readonly date: string }
		readonly replacement: TransactionInput
	},
	chart: ChartOfAccounts,
): readonly [Transaction, Transaction] => {
	const reversal = reverseAt(tx, input.reversal, chart, "reversal.")
	const { id } = input.replacement
	if (id === tx.id || id === reversal.id) {
		throw new LedgerValidationError(
			"DUPLICATE_TRANSACTION_ID",
			"replacement.id",
			id,
			`reuses the id of the ${id === tx.id ? "original" : "reversal"} in the same amendment`,
		)
	}
	const replacement = validateTransaction({ ...input.replacement, linkedTo: tx.id }, chart)
	return Object.freeze([reversal, replacement] as const)
}
