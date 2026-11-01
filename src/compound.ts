import type { ChartOfAccounts } from "./chart-map"
import { assertSameCurrency, credited, legPosting, magnitude } from "./legs"
import type { PostingInput } from "./posting"
import type { Transaction } from "./transaction"
import { validateTransaction } from "./transaction"

/** One leg of a Compound Entry: an Account, its own magnitude, and optional Dimensions. */
export interface CompoundLeg {
	readonly accountId: string
	readonly amount: number
	readonly dimensions?: Readonly<Record<string, string>>
}

const side = (
	legs: readonly CompoundLeg[],
	name: "debit" | "credit",
	chart: ChartOfAccounts,
): { postings: PostingInput[]; fields: string[] } => ({
	postings: legs.map((leg, i) => {
		const amount = magnitude(leg.amount, `${name}[${i}].amount`)
		return legPosting(leg, name === "debit" ? amount : credited(amount), chart, `${name}[${i}]`)
	}),
	fields: legs.map((_, i) => `${name}[${i}]`),
})

/**
 * Build a Compound Entry: many legs on either side, each with its own magnitude.
 * The two sides must total the same amount.
 */
export const compound = (
	input: {
		readonly id: string
		readonly date: string
		readonly debit: readonly CompoundLeg[]
		readonly credit: readonly CompoundLeg[]
	},
	chart: ChartOfAccounts,
): Transaction => {
	const debit = side(input.debit, "debit", chart)
	const credit = side(input.credit, "credit", chart)
	const postings = [...debit.postings, ...credit.postings]
	assertSameCurrency(postings, [...debit.fields, ...credit.fields])
	return validateTransaction({ id: input.id, date: input.date, postings }, chart)
}
