import { assertSafeInteger } from "./amount"
import { minorUnitDigits, parseCurrency } from "./currency"
import { LedgerValidationError } from "./errors"

/**
 * Convert a major-unit amount (`12.34`) to signed integer minor units (`1234`).
 * Rounds half away from zero; `toPrecision` strips binary-float noise first.
 */
export const toMinorUnits = (majorAmount: number, currency: string): number => {
	const digits = minorUnitDigits(parseCurrency(currency))
	if (!Number.isFinite(majorAmount)) {
		throw new LedgerValidationError("INVALID_AMOUNT", "majorAmount", majorAmount, "must be finite")
	}
	const scaled = Number((Math.abs(majorAmount) * 10 ** digits).toPrecision(15))
	return assertSafeInteger(Math.sign(majorAmount) * Math.round(scaled) + 0, "majorAmount")
}

/** Convert signed integer minor units (`1234`) to a major-unit amount (`12.34`). */
export const fromMinorUnits = (minorUnits: number, currency: string): number => {
	const digits = minorUnitDigits(parseCurrency(currency))
	return assertSafeInteger(minorUnits, "minorUnits") / 10 ** digits
}
