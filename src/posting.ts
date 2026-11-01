import { assertSafeInteger } from "./amount"
import type { ChartOfAccounts } from "./chart-map"
import type { Currency } from "./currency"
import { parseCurrency } from "./currency"
import { LedgerValidationError } from "./errors"
import type { AccountId } from "./ids"

/** A posting as supplied by a caller. `amount` is signed minor units: debit `+`, credit `-`. */
export interface PostingInput {
	readonly accountId: string
	readonly amount: number
	readonly currency: string
	/** Cost centre / project / class tags. Keys and values must be non-empty. */
	readonly dimensions?: Readonly<Record<string, string>>
}

/** A validated posting. */
export interface Posting {
	readonly accountId: AccountId
	readonly amount: number
	readonly currency: Currency
	readonly dimensions?: Readonly<Record<string, string>>
}

const fail = (
	code: LedgerValidationError["code"],
	field: string,
	value: unknown,
	reason: string,
): never => {
	throw new LedgerValidationError(code, field, value, reason)
}

const checkDimensions = (dimensions: Readonly<Record<string, string>>, field: string): void => {
	for (const [key, value] of Object.entries(dimensions)) {
		if (key === "" || typeof value !== "string" || value === "") {
			fail(
				"INVALID_DIMENSION",
				`${field}.dimensions`,
				{ [key]: value },
				"keys and values must be non-empty strings",
			)
		}
	}
}

/** Validate one posting against the chart; `path` is e.g. `postings[0]`. */
export const validatePosting = (
	input: PostingInput,
	chart: ChartOfAccounts,
	path: string,
): Posting => {
	const amount = assertSafeInteger(input.amount, `${path}.amount`)
	if (amount === 0) fail("ZERO_AMOUNT_POSTING", `${path}.amount`, amount, "must not be zero")
	const currency = parseCurrency(input.currency, `${path}.currency`)
	const account = chart.get(input.accountId as AccountId)
	if (!account)
		return fail(
			"UNKNOWN_ACCOUNT",
			`${path}.accountId`,
			input.accountId,
			"is not in the chart of accounts",
		)
	if (!chart.isLeaf(account.id))
		fail("NON_LEAF_ACCOUNT", `${path}.accountId`, account.id, "is a header account")
	if (currency !== account.currency)
		fail("CURRENCY_MISMATCH", `${path}.currency`, currency, `account is ${account.currency}`)
	if (input.dimensions) checkDimensions(input.dimensions, path)
	return Object.freeze({
		accountId: account.id,
		amount,
		currency,
		...(input.dimensions ? { dimensions: Object.freeze({ ...input.dimensions }) } : {}),
	})
}
