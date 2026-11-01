import type { Brand } from "./brand"
import { LedgerValidationError } from "./errors"

/** An ISO 4217 alphabetic currency code, e.g. `"THB"`. */
export type Currency = Brand<string, "Currency">

let known: ReadonlySet<string> | undefined

/**
 * Validate an ISO 4217 code against the runtime's own currency data
 * (`Intl.supportedValuesOf("currency")`), so no code table ships in this package.
 * The accepted set therefore follows the runtime's ICU version.
 */
export const parseCurrency = (value: unknown, field = "currency"): Currency => {
	known ??= new Set(Intl.supportedValuesOf("currency"))
	if (typeof value !== "string" || !known.has(value)) {
		throw new LedgerValidationError(
			"INVALID_CURRENCY",
			field,
			value,
			"is not an ISO 4217 currency code",
		)
	}
	return value as Currency
}

/** Number of minor-unit decimals for a currency: THB 2, JPY 0, KWD 3, CLF 4. */
export const minorUnitDigits = (currency: Currency): number =>
	new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
		.maximumFractionDigits ?? 2
