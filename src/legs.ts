import type { ChartOfAccounts } from "./chart-map"
import { LedgerValidationError } from "./errors"
import { accountId } from "./ids"
import type { PostingInput } from "./posting"

type LegObject = {
	readonly accountId: string
	readonly dimensions?: Readonly<Record<string, string>>
}

/** One side of a builder entry: a bare account id, or an account id with Dimensions. */
export type LegInput = string | LegObject

/** Resolve a leg's Account in the chart and emit its Posting; Currency comes from the Account. */
export const legPosting = (
	leg: LegInput,
	amount: number,
	chart: ChartOfAccounts,
	field: string,
): PostingInput => {
	const { accountId: id, dimensions }: LegObject =
		typeof leg === "string" ? { accountId: leg } : leg
	const account = chart.get(accountId(id))
	if (!account) {
		throw new LedgerValidationError(
			"UNKNOWN_ACCOUNT",
			typeof leg === "string" ? field : `${field}.accountId`,
			id,
			"is not in the chart of accounts",
		)
	}
	return {
		accountId: id,
		amount,
		currency: account.currency,
		...(dimensions ? { dimensions } : {}),
	}
}

/** A builder amount is a magnitude: the builder derives the sign, so a negative one is a bug. */
export const magnitude = (amount: number, field: string): number => {
	if (amount < 0) {
		throw new LedgerValidationError("NEGATIVE_AMOUNT", field, amount, "must not be negative")
	}
	return amount
}

/** The Credit form of a magnitude; never produces negative zero. */
export const credited = (amount: number): number => 0 - amount

/** Reject legs whose Accounts hold differing Currencies; the core has no FX. */
export const assertSameCurrency = (
	postings: readonly PostingInput[],
	fields: readonly string[],
): void => {
	const first = postings[0]?.currency
	const index = postings.findIndex((p) => p.currency !== first)
	if (index >= 0) {
		throw new LedgerValidationError(
			"CURRENCY_MISMATCH",
			fields[index] ?? "postings",
			postings[index]?.currency,
			`differs from ${first}; legs must share one currency`,
		)
	}
}
