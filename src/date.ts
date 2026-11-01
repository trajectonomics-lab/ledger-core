import type { Brand } from "./brand"
import { LedgerValidationError } from "./errors"

/** A real calendar date formatted `YYYY-MM-DD`. No time, no timezone. */
export type ISODate = Brand<string, "ISODate">

const SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/

const daysInMonth = (year: number, month: number): number =>
	month === 2
		? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
			? 29
			: 28
		: [4, 6, 9, 11].includes(month)
			? 30
			: 31

export const parseISODate = (value: unknown, field = "date"): ISODate => {
	const match = typeof value === "string" ? SHAPE.exec(value) : null
	const [year, month, day] = [Number(match?.[1]), Number(match?.[2]), Number(match?.[3])]
	if (!match || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
		throw new LedgerValidationError(
			"INVALID_DATE",
			field,
			value,
			"must be a real YYYY-MM-DD calendar date",
		)
	}
	return value as ISODate
}
