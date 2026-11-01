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
	const raw = Math.abs(majorAmount) * 10 ** digits
	// Trimming to 15 significant digits removes float noise (1.005 * 100), but beyond 1e15
	// it would erase real digits, and a double's own spacing there already exceeds the noise.
	const scaled = raw < 1e15 ? Number(raw.toPrecision(15)) : raw
	return assertSafeInteger(Math.sign(majorAmount) * Math.round(scaled) + 0, "majorAmount")
}

/** Convert signed integer minor units (`1234`) to a major-unit amount (`12.34`). */
export const fromMinorUnits = (minorUnits: number, currency: string): number => {
	const digits = minorUnitDigits(parseCurrency(currency))
	return assertSafeInteger(minorUnits, "minorUnits") / 10 ** digits
}
