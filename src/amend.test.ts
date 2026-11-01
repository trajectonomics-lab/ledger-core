import { describe, expect, it } from "bun:test"
import { chart, codeOf } from "./builders.fixtures"
import { amend, reverse, simple } from "./index"

const original = simple(
	{ id: "t1", date: "2026-03-01", debit: "rent", credit: "cash", amount: 500 },
	chart,
)
const reversal = { id: "r1", date: "2026-03-02" }
const corrected = simple(
	{ id: "t2", date: "2026-03-02", debit: "rent", credit: "cash", amount: 450 },
	chart,
)

describe("amend", () => {
	it("returns [reversal, replacement] with the reversal the exact negation", () => {
		const [rev, rep] = amend(original, { reversal, replacement: corrected }, chart)
		expect(rev).toEqual(reverse(original, reversal, chart))
		expect(rev.postings.map((p) => p.amount)).toEqual([-500, 500])
		expect(rep.postings.map((p) => p.amount)).toEqual([450, -450])
	})

	it("points both members at the original", () => {
		const [rev, rep] = amend(original, { reversal, replacement: corrected }, chart)
		expect(rev.linkedTo).toBe(original.id)
		expect(rep.linkedTo).toBe(original.id)
	})

	it("overwrites a caller-validated replacement's previous linkedTo with the original's id", () => {
		const previous = { ...corrected, linkedTo: "older" }
		const [, rep] = amend(original, { reversal, replacement: previous }, chart)
		expect(rep.linkedTo).toBe(original.id)
		expect(previous.linkedTo).toBe("older")
	})

	it("accepts a plain TransactionInput as the replacement", () => {
		const replacement = {
			id: "t2",
			date: "2026-03-02",
			postings: [
				{ accountId: "rent", amount: 450, currency: "USD" },
				{ accountId: "cash", amount: -450, currency: "USD" },
			],
		}
		const [, rep] = amend(original, { reversal, replacement }, chart)
		expect(rep.postings).toHaveLength(2)
		expect(rep.linkedTo).toBe(original.id)
	})

	it("rejects a replacement reusing the original's id with DUPLICATE_TRANSACTION_ID", () => {
		const replacement = { ...corrected, id: "t1" }
		expect(codeOf(() => amend(original, { reversal, replacement }, chart))).toBe(
			"DUPLICATE_TRANSACTION_ID",
		)
	})

	it("rejects a replacement reusing the reversal's id with DUPLICATE_TRANSACTION_ID", () => {
		const replacement = { ...corrected, id: "r1" }
		expect(codeOf(() => amend(original, { reversal, replacement }, chart))).toBe(
			"DUPLICATE_TRANSACTION_ID",
		)
	})

	it("rejects a reversal reusing the original's id with DUPLICATE_TRANSACTION_ID", () => {
		const input = { reversal: { id: "t1", date: "2026-03-02" }, replacement: corrected }
		expect(codeOf(() => amend(original, input, chart))).toBe("DUPLICATE_TRANSACTION_ID")
	})

	it("rejects a reversal dated before the original with REVERSAL_BEFORE_ORIGINAL", () => {
		const input = { reversal: { id: "r1", date: "2026-02-01" }, replacement: corrected }
		expect(codeOf(() => amend(original, input, chart))).toBe("REVERSAL_BEFORE_ORIGINAL")
	})

	it("validates the replacement through the existing pipeline", () => {
		const replacement = {
			...corrected,
			postings: [{ accountId: "rent", amount: 1, currency: "USD" }],
		}
		expect(codeOf(() => amend(original, { reversal, replacement }, chart))).toBe("SINGLE_POSTING")
	})

	it("returns a frozen pair and leaves its inputs untouched", () => {
		const input = { reversal, replacement: { ...corrected, linkedTo: "older" } }
		const snapshot = JSON.stringify(input)
		const pair = amend(original, input, chart)
		expect(JSON.stringify(input)).toBe(snapshot)
		expect(Object.isFrozen(pair)).toBe(true)
		expect(pair.every((t) => Object.isFrozen(t))).toBe(true)
	})
})
