import { describe, expect, it } from "bun:test"
import { chart, codeOf } from "./builders.fixtures"
import { openingBalance } from "./index"

const base = { id: "o1", date: "2026-01-01", contra: "equity" }
const sum = (amounts: readonly number[]): number => amounts.reduce((a, b) => a + b, 0)

describe("openingBalance", () => {
	it("opens an asset with a positive net-signed amount and balances against equity", () => {
		const t = openingBalance({ ...base, account: "cash", amount: 1000 }, chart)
		expect(t.postings.map((p) => [p.accountId as string, p.amount])).toEqual([
			["cash", 1000],
			["equity", -1000],
		])
		expect(sum(t.postings.map((p) => p.amount))).toBe(0)
	})

	it("opens a liability with a negative net-signed amount and balances against equity", () => {
		const t = openingBalance({ ...base, account: "principal", amount: -800 }, chart)
		expect(t.postings.map((p) => [p.accountId as string, p.amount])).toEqual([
			["principal", -800],
			["equity", 800],
		])
		expect(sum(t.postings.map((p) => p.amount))).toBe(0)
	})

	it("accepts a negative amount for an overdrawn asset and does not flip it", () => {
		const t = openingBalance({ ...base, account: "bank", amount: -250 }, chart)
		expect(t.postings[0]?.amount).toBe(-250)
		expect(t.postings[1]?.amount).toBe(250)
	})

	it("rejects a non-equity contra with NON_EQUITY_CONTRA", () => {
		for (const contra of ["rent", "cash", "revenue", "principal"]) {
			const input = { ...base, account: "bank", contra, amount: 5 }
			expect(codeOf(() => openingBalance(input, chart))).toBe("NON_EQUITY_CONTRA")
		}
	})

	it("rejects a zero amount with ZERO_AMOUNT_POSTING", () => {
		const input = { ...base, account: "cash", amount: 0 }
		expect(codeOf(() => openingBalance(input, chart))).toBe("ZERO_AMOUNT_POSTING")
	})

	it("rejects an account and contra in differing currencies with CURRENCY_MISMATCH", () => {
		const input = { ...base, account: "baht", amount: 5 }
		expect(codeOf(() => openingBalance(input, chart))).toBe("CURRENCY_MISMATCH")
	})

	it("reports an unknown account or contra as UNKNOWN_ACCOUNT", () => {
		expect(codeOf(() => openingBalance({ ...base, account: "ghost", amount: 5 }, chart))).toBe(
			"UNKNOWN_ACCOUNT",
		)
		const contra = { ...base, account: "cash", contra: "ghost", amount: 5 }
		expect(codeOf(() => openingBalance(contra, chart))).toBe("UNKNOWN_ACCOUNT")
	})

	it("puts dimensions on the tagged leg only, freezes the result, leaves input untouched", () => {
		const input = {
			...base,
			account: { accountId: "cash", dimensions: { project: "a" } },
			amount: 1000,
		}
		const snapshot = structuredClone(input)
		const t = openingBalance(input, chart)
		expect(input).toEqual(snapshot)
		expect(t.postings[0]?.dimensions).toEqual({ project: "a" })
		expect(t.postings[1]?.dimensions).toBeUndefined()
		expect(Object.isFrozen(t)).toBe(true)
	})
})
