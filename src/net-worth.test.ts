import { describe, expect, it } from "bun:test"
import { netWorth } from "./index"
import { bal, chart, ledger, tot } from "./queries.fixtures"

describe("netWorth", () => {
	it("shows raw asset and liability rows and a natural-sign total per Entity and Currency", () => {
		expect(netWorth(ledger, "2024-02-28", chart)).toEqual({
			rows: [
				bal("default", "cash", "THB", 3_780_000),
				bal("default", "loan", "THB", -100_000),
				bal("default", "savings", "THB", 300_000),
				bal("default", "usd-wallet", "USD", 10_000),
				bal("other-co", "other-cash", "THB", 0),
			],
			totals: [
				tot("default", "THB", 3_980_000),
				tot("default", "USD", 10_000),
				tot("other-co", "THB", 0),
			],
		})
	})

	it("excludes Equity and counts only Transactions up to asOf", () => {
		const early = netWorth(ledger, "2024-01-01", chart)
		expect(early.totals[0]).toEqual(tot("default", "THB", 200_000))
	})
})
