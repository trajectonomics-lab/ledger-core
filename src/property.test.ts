import { describe, expect, it } from "bun:test"
import { createChartOfAccounts, type PostingInput, validateTransaction } from "./index"

const chart = createChartOfAccounts([
	{ id: "a", type: "asset", currency: "USD" },
	{ id: "b", type: "expense", currency: "USD" },
	{ id: "c", type: "income", currency: "USD" },
	{ id: "d", type: "asset", currency: "THB", entityId: "x" },
	{ id: "e", type: "liability", currency: "THB", entityId: "x" },
])
const ids = [
	["a", "USD"],
	["b", "USD"],
	["c", "USD"],
	["d", "THB"],
	["e", "THB"],
] as const

/** Deterministic mulberry32 PRNG so failures are reproducible. */
const rng =
	(seed: number): (() => number) =>
	() => {
		seed = (seed + 0x6d2b79f5) | 0
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}

const balancedPostings = (next: () => number): PostingInput[] => {
	const postings: PostingInput[] = []
	for (const currency of ["USD", "THB"]) {
		const pool = ids.filter(([, c]) => c === currency)
		const legs = 1 + Math.floor(next() * 4)
		let sum = 0
		for (let i = 0; i < legs; i++) {
			const amount = (1 + Math.floor(next() * 1_000_000)) * (next() < 0.5 ? -1 : 1)
			sum += amount
			postings.push({ accountId: pool[i % pool.length]![0], amount, currency })
		}
		const last = pool[legs % pool.length]![0]
		if (sum !== 0) postings.push({ accountId: last, amount: -sum, currency })
		else
			postings.push(
				{ accountId: last, amount: 1, currency },
				{ accountId: last, amount: -1, currency },
			)
	}
	return postings
}

const valid = (postings: PostingInput[]): boolean => {
	try {
		validateTransaction({ id: "t", date: "2026-01-01", postings }, chart)
		return true
	} catch {
		return false
	}
}

describe("balance invariant (property)", () => {
	it("every generated balanced transaction validates; shifting any one amount by 1 never does", () => {
		const next = rng(20260101)
		for (let run = 0; run < 500; run++) {
			const postings = balancedPostings(next)
			expect(valid(postings)).toBe(true)
			const i = Math.floor(next() * postings.length)
			const delta = next() < 0.5 ? 1 : -1
			const mutated = postings.map((x, j) => (j === i ? { ...x, amount: x.amount + delta } : x))
			expect(valid(mutated)).toBe(false)
		}
	})
})
