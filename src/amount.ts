import { LedgerValidationError } from "./errors"

/** Accepts only safe integers; anything else is `INVALID_AMOUNT`. */
export const assertSafeInteger = (value: unknown, field: string): number => {
	if (typeof value !== "number" || !Number.isSafeInteger(value)) {
		throw new LedgerValidationError(
			"INVALID_AMOUNT",
			field,
			value,
			"must be a safe integer of minor units",
		)
	}
	return value
}
