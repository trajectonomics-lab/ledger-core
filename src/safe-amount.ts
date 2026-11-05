import { LedgerValidationError } from "./errors"

const MAX = BigInt(Number.MAX_SAFE_INTEGER)

/** Narrow a `BigInt` sum to a `number`, or throw `AMOUNT_OVERFLOW` when it is not a safe integer. */
export const toSafeAmount = (sum: bigint, field: string): number => {
	if (sum > MAX || sum < -MAX) {
		throw new LedgerValidationError(
			"AMOUNT_OVERFLOW",
			field,
			sum.toString(),
			"exceeds the safe integer range",
		)
	}
	return Number(sum)
}
