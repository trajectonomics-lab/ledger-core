import { describe, expect, it } from "bun:test"
import { chart, codeOf } from "./builders.fixtures"
import { compound } from "./index"

const head = { id: "t1", date: "2026-03-01" }
const sum = (amounts: readonly number[]): number => amounts.reduce((a, b) => a + b, 0)

describe("compound", () => {
	it("builds a sale with tax: one debit, two credits, balanced", () => {
		const t = compound(
			{
				...head,
				debit: [{ accountId: "cash", amount: 107 }],
				credit: [
					{ accountId: "revenue", amount: 100 },
					{ accountId: "tax-payable", amount: 7 },
				],
			},
			chart,
		)
		expect(t.postings.map((p) => String(p.accountId))).toEqual(["cash", "revenue", "tax-payable"])
		expect(t.postings.map((p) => p.amount)).toEqual([107, -100, -7])
		expect(sum(t.postings.map((p) => p.amount))).toBe(0)
	})

	it("builds a loan payment: two debits, one credit, balanced", () => {
		const t = compound(
			{
				...head,
				debit: [
					{ accountId: "interest", amount: 30 },
					{ accountId: "principal", amount: 70 },
				],
				credit: [{ accountId: "bank", amount: 100 }],
			},
			chart,
		)
		expect(t.postings.map((p) => String(p.accountId))).toEqual(["interest", "principal", "bank"])
		expect(t.postings.map((p) => p.amount)).toEqual([30, 70, -100])
	})

	it("rejects unequal side totals with UNBALANCED_TRANSACTION", () => {
		const input = {
			...head,
			debit: [{ accountId: "cash", amount: 107 }],
			credit: [
				{ accountId: "revenue", amount: 100 },
				{ accountId: "tax-payable", amount: 6 },
			],
		}
		expect(codeOf(() => compound(input, chart))).toBe("UNBALANCED_TRANSACTION")
	})

	it("rejects a negative leg amount with NEGATIVE_AMOUNT", () => {
		const input = {
			...head,
			debit: [{ accountId: "cash", amount: 100 }],
			credit: [
				{ accountId: "revenue", amount: 150 },
				{ accountId: "tax-payable", amount: -50 },
			],
		}
		expect(codeOf(() => compound(input, chart))).toBe("NEGATIVE_AMOUNT")
	})

	it("rejects a zero leg amount with ZERO_AMOUNT_POSTING", () => {
		const input = {
			...head,
			debit: [{ accountId: "cash", amount: 100 }],
			credit: [
				{ accountId: "revenue", amount: 100 },
				{ accountId: "tax-payable", amount: 0 },
			],
		}
		expect(codeOf(() => compound(input, chart))).toBe("ZERO_AMOUNT_POSTING")
	})

	it("rejects legs in differing currencies with CURRENCY_MISMATCH", () => {
		const input = {
			...head,
			debit: [{ accountId: "cash", amount: 100 }],
			credit: [
				{ accountId: "revenue", amount: 50 },
				{ accountId: "baht", amount: 50 },
			],
		}
		expect(codeOf(() => compound(input, chart))).toBe("CURRENCY_MISMATCH")
	})

	it("rejects a missing side as too few postings", () => {
		const input = { ...head, debit: [{ accountId: "cash", amount: 5 }], credit: [] }
		expect(codeOf(() => compound(input, chart))).toBe("SINGLE_POSTING")
	})

	it("puts dimensions on the tagged leg's posting only and freezes the result", () => {
		const input = {
			...head,
			debit: [{ accountId: "cash", amount: 107 }],
			credit: [
				{ accountId: "revenue", amount: 100, dimensions: { project: "a" } },
				{ accountId: "tax-payable", amount: 7 },
			],
		}
		const snapshot = structuredClone(input)
		const t = compound(input, chart)
		expect(input).toEqual(snapshot)
		expect(t.postings.map((p) => p.dimensions)).toEqual([undefined, { project: "a" }, undefined])
		expect(Object.isFrozen(t)).toBe(true)
		expect(Object.isFrozen(t.postings)).toBe(true)
		expect(Object.isFrozen(t.postings[1]?.dimensions)).toBe(true)
	})
})
