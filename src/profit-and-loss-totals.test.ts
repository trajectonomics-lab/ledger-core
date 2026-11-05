import { describe, expect, it } from "bun:test"
import type { ProfitAndLossOptions } from "./index"
import { createChartOfAccounts, profitAndLoss, validateTransaction } from "./index"
import { tot } from "./queries.fixtures"

/**
 * Income and Expense Leaves in three `(Entity, Currency)` pairs, of which only `default/THB` ever
 * posts. The JPY Expense Header has THB children, so JPY is a Header-only Currency.
 */
const chart = createChartOfAccounts([
	{ id: "cash", type: "asset", currency: "THB" },
	{ id: "salary", type: "income", currency: "THB" },
	{ id: "expenses", type: "expense", currency: "JPY" },
	{ id: "food", type: "expense", currency: "THB", parentId: "expenses" },
	{ id: "usd-fees", type: "expense", currency: "USD" },
	{ id: "other-sales", type: "income", currency: "THB", entityId: "other-co" },
])

const ledger = [
	validateTransaction(
		{
			id: "t1",
			date: "2024-01-10",
			postings: [
				{ accountId: "cash", amount: 700, currency: "THB" },
				{ accountId: "salary", amount: -1_000, currency: "THB", dimensions: { team: "a" } },
				{ accountId: "food", amount: 300, currency: "THB", dimensions: { team: "b" } },
			],
		},
		chart,
	),
]

/** P&L totals without and with `groupBy`, which must agree. */
const totalsOf = (options: Omit<ProfitAndLossOptions, "groupBy">) => {
	const plain = profitAndLoss(ledger, options, chart).totals
	const grouped = profitAndLoss(ledger, { ...options, groupBy: "team" }, chart).totals
	expect(grouped).toEqual(plain)
	return plain
}

const january = { from: "2024-01-01", to: "2024-01-31" }
const seeded = (thb: number) => [
	tot("default", "THB", thb),
	tot("default", "USD", 0),
	tot("other-co", "THB", 0),
]

describe("profitAndLoss totals", () => {
	it("seeds every Income and Expense Leaf's pair, never a Header-only Currency", () => {
		expect(totalsOf(january)).toEqual(seeded(700))
	})

	it("keeps the seeded pairs when where matches no Posting", () => {
		expect(totalsOf({ ...january, where: { team: "z" } })).toEqual(seeded(0))
	})

	it("keeps the seeded pairs for a period with no Postings", () => {
		expect(totalsOf({ from: "2025-01-01", to: "2025-12-31" })).toEqual(seeded(0))
	})
})
