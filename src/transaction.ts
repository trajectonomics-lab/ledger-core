import type { Brand } from "./brand"
import type { ChartOfAccounts } from "./chart-map"
import type { ISODate } from "./date"
import { parseISODate } from "./date"
import { LedgerValidationError } from "./errors"
import type { TransactionId } from "./ids"
import type { Posting, PostingInput } from "./posting"
import { validatePosting } from "./posting"

/** A transaction as supplied by a caller. The caller supplies `id`; nothing here generates one. */
export interface TransactionInput {
	readonly id: string
	readonly date: string
	readonly postings: readonly PostingInput[]
	/** The transaction this one reverses or amends (append-only audit chain). */
	readonly linkedTo?: string
}

/** A balanced transaction. Only {@link validateTransaction} produces one. */
export type Transaction = Brand<
	{
		readonly id: TransactionId
		readonly date: ISODate
		readonly postings: readonly Posting[]
		readonly linkedTo?: TransactionId
	},
	"Transaction"
>

const assertBalanced = (postings: readonly Posting[], chart: ChartOfAccounts): void => {
	const sums = new Map<string, bigint>()
	for (const { accountId, amount, currency } of postings) {
		const key = JSON.stringify([chart.get(accountId)?.entityId, currency])
		sums.set(key, (sums.get(key) ?? 0n) + BigInt(amount))
	}
	for (const [key, sum] of sums) {
		if (sum !== 0n) {
			const [entity, currency] = JSON.parse(key) as [string, string]
			throw new LedgerValidationError(
				"UNBALANCED_TRANSACTION",
				"postings",
				sum.toString(),
				`entity "${entity}" ${currency} sums to ${sum} instead of 0`,
			)
		}
	}
}

/** Validate a transaction against a chart. Throws {@link LedgerValidationError}. */
export const validateTransaction = (
	input: TransactionInput,
	chart: ChartOfAccounts,
): Transaction => {
	const date = parseISODate(input.date)
	const count = Array.isArray(input.postings) ? input.postings.length : 0
	if (count < 2) {
		throw new LedgerValidationError(
			"SINGLE_POSTING",
			"postings",
			count,
			"needs at least 2 postings",
		)
	}
	const postings = input.postings.map((p, i) => validatePosting(p, chart, `postings[${i}]`))
	assertBalanced(postings, chart)
	return Object.freeze({
		id: input.id as TransactionId,
		date,
		postings: Object.freeze(postings),
		...(input.linkedTo === undefined ? {} : { linkedTo: input.linkedTo as TransactionId }),
	}) as unknown as Transaction
}
