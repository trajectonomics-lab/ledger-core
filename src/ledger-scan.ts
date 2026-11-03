import type { Account } from "./account"
import type { ChartOfAccounts } from "./chart-map"
import type { ISODate } from "./date"
import { LedgerValidationError } from "./errors"
import type { Posting } from "./posting"
import type { Transaction } from "./transaction"
import { validateTransaction } from "./transaction"

/** One Posting with the Account it targets and the date of its Transaction. */
export interface LedgerEntry {
	readonly account: Account
	readonly posting: Posting
	readonly date: ISODate
}

const recheck = (tx: Transaction, index: number, chart: ChartOfAccounts): void => {
	try {
		validateTransaction(tx, chart)
	} catch (error) {
		if (!(error instanceof LedgerValidationError)) throw error
		throw new LedgerValidationError(
			error.code,
			`transactions[${index}].${error.field}`,
			error.value,
			error.reason,
		)
	}
}

/**
 * Re-check every Transaction against the supplied chart (a Transaction is not tied to the chart
 * that validated it) and flatten them into Entries. Throws on a duplicate Transaction id.
 */
export const scanLedger = (
	transactions: readonly Transaction[],
	chart: ChartOfAccounts,
): readonly LedgerEntry[] => {
	const seen = new Set<string>()
	return transactions.flatMap((tx, index) => {
		if (seen.has(tx.id)) {
			throw new LedgerValidationError(
				"DUPLICATE_TRANSACTION_ID",
				`transactions[${index}].id`,
				tx.id,
				"is used by an earlier transaction",
			)
		}
		seen.add(tx.id)
		recheck(tx, index, chart)
		return tx.postings.map((posting) => ({
			account: chart.get(posting.accountId)!,
			posting,
			date: tx.date,
		}))
	})
}
