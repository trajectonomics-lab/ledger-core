import { describe, expect, it } from "bun:test"
import { chart, codeOf } from "./builders.fixtures"
import { simple } from "./index"

const base = { id: "t1", date: "2026-03-01", debit: "rent", credit: "cash", amount: 5000 }

describe("simple", () => {
	it("emits exactly two postings, +amount on debit and -amount on credit", () => {
		const t = simple(base, chart)
		expect(t.postings.map((p) => [p.accountId as string, p.amount, p.currency as string])).toEqual([
			["rent", 5000, "USD"],
			["cash", -5000, "USD"],
		])
		expect(t.id).toBe("t1" as never)
		expect(t.linkedTo).toBeUndefined()
	})

	it("puts dimensions on the tagged leg's posting only", () => {
		const t = simple({ ...base, debit: { accountId: "rent", dimensions: { project: "a" } } }, chart)
		expect(t.postings[0]?.dimensions).toEqual({ project: "a" })
		expect(t.postings[1]?.dimensions).toBeUndefined()
	})

	it("returns a frozen transaction and leaves its input untouched", () => {
		const input = { ...base, debit: { accountId: "rent", dimensions: { project: "a" } } }
		const snapshot = structuredClone(input)
		const t = simple(input, chart)
		expect(input).toEqual(snapshot)
		expect(Object.isFrozen(t)).toBe(true)
		expect(Object.isFrozen(t.postings)).toBe(true)
		expect(Object.isFrozen(t.postings[0]?.dimensions)).toBe(true)
	})

	it("rejects a THB leg against a USD leg with CURRENCY_MISMATCH", () => {
		expect(codeOf(() => simple({ ...base, credit: "baht" }, chart))).toBe("CURRENCY_MISMATCH")
	})

	it("rejects a negative amount with NEGATIVE_AMOUNT", () => {
		expect(codeOf(() => simple({ ...base, amount: -1 }, chart))).toBe("NEGATIVE_AMOUNT")
	})

	it("rejects a zero amount with ZERO_AMOUNT_POSTING", () => {
		expect(codeOf(() => simple({ ...base, amount: 0 }, chart))).toBe("ZERO_AMOUNT_POSTING")
	})

	it("rejects a non-integer amount with INVALID_AMOUNT", () => {
		expect(codeOf(() => simple({ ...base, amount: 1.5 }, chart))).toBe("INVALID_AMOUNT")
	})

	it("still applies the existing pipeline rules", () => {
		expect(codeOf(() => simple({ ...base, debit: "ghost" }, chart))).toBe("UNKNOWN_ACCOUNT")
		expect(codeOf(() => simple({ ...base, debit: "assets" }, chart))).toBe("NON_LEAF_ACCOUNT")
		expect(codeOf(() => simple({ ...base, date: "2026-02-30" }, chart))).toBe("INVALID_DATE")
		expect(codeOf(() => simple({ ...base, credit: "other-cash" }, chart))).toBe(
			"UNBALANCED_TRANSACTION",
		)
	})
})
