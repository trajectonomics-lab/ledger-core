import { describe, expect, it } from "bun:test"
import { fromMinorUnits, LedgerValidationError, normalBalance, toMinorUnits } from "./index"

describe("minor-unit conversion", () => {
	it("resolves decimal precision per ISO 4217 currency", () => {
		expect(toMinorUnits(12.34, "THB")).toBe(1234)
		expect(toMinorUnits(12.34, "USD")).toBe(1234)
		expect(toMinorUnits(1234, "JPY")).toBe(1234)
		expect(toMinorUnits(1.234, "KWD")).toBe(1234)
	})

	it("rounds half away from zero without binary float drift", () => {
		expect(toMinorUnits(1.005, "USD")).toBe(101)
		expect(toMinorUnits(-1.005, "USD")).toBe(-101)
		expect(toMinorUnits(0.1 + 0.2, "USD")).toBe(30)
	})

	it("converts minor units back to major units", () => {
		expect(fromMinorUnits(1999, "USD")).toBe(19.99)
		expect(fromMinorUnits(-1999, "THB")).toBe(-19.99)
		expect(fromMinorUnits(500, "JPY")).toBe(500)
		expect(fromMinorUnits(1234, "KWD")).toBe(1.234)
	})

	it("rejects non-ISO 4217 currency codes", () => {
		for (const code of ["usd", "US", "USDX", "", "ZZZ", "123"]) {
			expect(() => toMinorUnits(1, code)).toThrow(LedgerValidationError)
			expect(() => fromMinorUnits(1, code)).toThrow(LedgerValidationError)
		}
	})

	it("rejects non-finite or unsafe amounts with INVALID_AMOUNT", () => {
		const codeOf = (fn: () => unknown): unknown => {
			try {
				fn()
			} catch (error) {
				return (error as LedgerValidationError).code
			}
			return undefined
		}
		expect(codeOf(() => toMinorUnits(Number.NaN, "USD"))).toBe("INVALID_AMOUNT")
		expect(codeOf(() => toMinorUnits(Number.POSITIVE_INFINITY, "USD"))).toBe("INVALID_AMOUNT")
		expect(codeOf(() => toMinorUnits(Number.MAX_SAFE_INTEGER, "USD"))).toBe("INVALID_AMOUNT")
		expect(codeOf(() => fromMinorUnits(1.5, "USD"))).toBe("INVALID_AMOUNT")
		expect(codeOf(() => toMinorUnits(1, "ZZZ"))).toBe("INVALID_CURRENCY")
	})
})

describe("normal balance", () => {
	it("is debit for asset and expense, credit for liability, equity and income", () => {
		expect(normalBalance("asset")).toBe("debit")
		expect(normalBalance("expense")).toBe("debit")
		expect(normalBalance("liability")).toBe("credit")
		expect(normalBalance("equity")).toBe("credit")
		expect(normalBalance("income")).toBe("credit")
	})
})

describe("negative zero", () => {
	it("never leaks -0 from a tiny negative amount", () => {
		expect(Object.is(toMinorUnits(-0.001, "THB"), 0)).toBe(true)
	})
})
