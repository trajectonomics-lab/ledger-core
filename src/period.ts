import type { ISODate } from "./date"
import { parseISODate } from "./date"
import { LedgerValidationError } from "./errors"

/** An inclusive date range; `from` is absent when the period starts with the ledger. */
export interface Period {
	readonly from?: ISODate
	readonly to: ISODate
}

/** Parse an inclusive period, throwing `INVALID_DATE` for a bad end and `INVALID_PERIOD` if inverted. */
export const parsePeriod = (input: { readonly from?: string; readonly to: string }): Period => {
	const from = input.from === undefined ? undefined : parseISODate(input.from, "options.from")
	const to = parseISODate(input.to, "options.to")
	if (from !== undefined && from > to) {
		throw new LedgerValidationError(
			"INVALID_PERIOD",
			"options.from",
			input.from,
			`is after to (${to})`,
		)
	}
	return from === undefined ? { to } : { from, to }
}

/** True when `date` falls on or between the period's ends. */
export const inPeriod = (period: Period, date: ISODate): boolean =>
	date <= period.to && (period.from === undefined || date >= period.from)
