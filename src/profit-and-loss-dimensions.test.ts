import { describe, expect, it } from "bun:test"
import { profitAndLoss } from "./index"
import { bal, chart, ledger, thb, tot, tx } from "./queries.fixtures"

const year = { from: "2024-01-01", to: "2024-12-31" }

const grouped = (account: string, dimensionValue: string | null, amount: number) => ({
	...bal("default", account, "THB", amount),
	dimensionValue,
})

const total = (amount: number) => [tot("default", "THB", amount)]

describe("profitAndLoss dimensions", () => {
	it("groups by one key, collecting Postings without it under null", () => {
		expect(profitAndLoss(ledger, { ...year, groupBy: "costCentre" }, chart)).toEqual({
			rows: [
				grouped("food", null, 50_000),
				grouped("food", "home", 150_000),
				grouped("interest", "home", 20_000),
				grouped("salary", null, -4_000_000),
			],
			totals: total(3_780_000),
		})
	})

	it("keeps group rows summing to the ungrouped total", () => {
		const ungrouped = profitAndLoss(ledger, year, chart).totals
		expect(profitAndLoss(ledger, { ...year, groupBy: "project" }, chart).totals).toEqual(ungrouped)
	})

	it("sorts null first, then dimension values by code unit", () => {
		const extra = ["b", "B", "a"].map((v, i) =>
			tx(`x${i}`, "2024-03-01", [thb("food", 10, { costCentre: v }), thb("cash", -10)]),
		)
		const { rows } = profitAndLoss([...ledger, ...extra], { ...year, groupBy: "costCentre" }, chart)
		const food = rows.flatMap((r) => (r.accountId === "food" ? [r.dimensionValue] : []))
		expect(food).toEqual([null, "B", "a", "b", "home"])
	})

	it("filters Postings by exact match without grouping, keeping every row", () => {
		expect(profitAndLoss(ledger, { ...year, where: { costCentre: "home" } }, chart)).toEqual({
			rows: [
				bal("default", "food", "THB", 150_000),
				bal("default", "interest", "THB", 20_000),
				bal("default", "salary", "THB", 0),
			],
			totals: total(-170_000),
		})
	})

	it("ANDs where entries and combines with groupBy", () => {
		const { rows } = profitAndLoss(
			ledger,
			{ ...year, groupBy: "project", where: { costCentre: "home" } },
			chart,
		)
		expect(rows).toEqual([grouped("food", null, 150_000), grouped("interest", null, 20_000)])
		const none = profitAndLoss(
			ledger,
			{ ...year, where: { costCentre: "home", project: "x" } },
			chart,
		)
		expect(none.totals).toEqual(total(0))
	})

	it("never matches a missing key, even one inherited from Object.prototype", () => {
		expect(profitAndLoss(ledger, { ...year, where: { constructor: "x" } }, chart).totals).toEqual(
			total(0),
		)
		const { rows } = profitAndLoss(ledger, { ...year, groupBy: "constructor" }, chart)
		expect(rows.every((r) => r.dimensionValue === null)).toBe(true)
	})

	it("keeps the totals' shape when no group matches", () => {
		const options = { ...year, where: { project: "none" } }
		const plain = profitAndLoss(ledger, options, chart)
		const byTeam = profitAndLoss(ledger, { ...options, groupBy: "costCentre" }, chart)
		expect(byTeam.rows).toEqual([])
		expect(byTeam.totals).toEqual(plain.totals)
		expect(plain.totals).toEqual(total(0))
	})
})
