import { describe, expect, it } from "bun:test"
import { codeOf } from "./builders.fixtures"
import { profitAndLoss, reverse } from "./index"
import { bal, chart, ledger, tot } from "./queries.fixtures"

const row = (account: string, amount: number) => bal("default", account, "THB", amount)
const thb = (amount: number) => [tot("default", "THB", amount)]

describe("profitAndLoss", () => {
	it("lists every Income and Expense Leaf raw, zeros included, with income minus expenses", () => {
		expect(profitAndLoss(ledger, { from: "2024-02-01", to: "2024-02-29" }, chart)).toEqual({
			rows: [row("food", 200_000), row("interest", 20_000), row("salary", 0)],
			totals: thb(-220_000),
		})
	})

	it("treats a missing from as the start of the ledger", () => {
		const { rows, totals } = profitAndLoss(ledger, { to: "2024-02-29" }, chart)
		expect(rows).toEqual([row("food", 200_000), row("interest", 20_000), row("salary", -4_000_000)])
		expect(totals).toEqual(thb(3_780_000))
	})

	it("includes both ends of the period", () => {
		const { totals } = profitAndLoss(ledger, { from: "2024-01-31", to: "2024-02-01" }, chart)
		expect(totals).toEqual(thb(4_000_000 - 150_000))
	})

	it("counts a Reversal in the period of its own date", () => {
		const t5 = ledger.find((t) => t.id === "t5")!
		const txs = [...ledger, reverse(t5, { id: "r5", date: "2024-03-05" }, chart)]
		const feb = profitAndLoss(txs, { from: "2024-02-01", to: "2024-02-29" }, chart)
		const mar = profitAndLoss(txs, { from: "2024-03-01", to: "2024-03-31" }, chart)
		expect(feb.totals).toEqual(thb(-220_000))
		expect(mar.totals).toEqual(thb(50_000))
	})

	it("rejects from after to with INVALID_PERIOD", () => {
		const run = () => profitAndLoss(ledger, { from: "2024-03-01", to: "2024-02-01" }, chart)
		expect(codeOf(run)).toBe("INVALID_PERIOD")
	})

	it("rejects an invalid from or to with INVALID_DATE", () => {
		expect(codeOf(() => profitAndLoss(ledger, { from: "x", to: "2024-02-01" }, chart))).toBe(
			"INVALID_DATE",
		)
		expect(codeOf(() => profitAndLoss(ledger, { to: "2024-13-01" }, chart))).toBe("INVALID_DATE")
	})
})
