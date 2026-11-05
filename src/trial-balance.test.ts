import { describe, expect, it } from "bun:test"
import { accountId, parseCurrency, trialBalance } from "./index"
import { chart, ledger } from "./queries.fixtures"

const row = (
	entityId: string,
	account: string,
	currency: string,
	debit: number,
	credit: number,
) => ({
	entityId,
	accountId: accountId(account),
	currency: parseCurrency(currency),
	debit,
	credit,
})

const total = (entityId: string, currency: string, debit: number, credit: number) => ({
	entityId,
	currency: parseCurrency(currency),
	debit,
	credit,
})

describe("trialBalance", () => {
	it("places positive Balances in debit and negative ones in credit as magnitudes", () => {
		expect(trialBalance(ledger, "2024-02-28", chart)).toEqual({
			rows: [
				row("default", "cash", "THB", 3_780_000, 0),
				row("default", "equity", "THB", 0, 200_000),
				row("default", "equity-usd", "USD", 0, 10_000),
				row("default", "food", "THB", 200_000, 0),
				row("default", "interest", "THB", 20_000, 0),
				row("default", "loan", "THB", 0, 100_000),
				row("default", "salary", "THB", 0, 4_000_000),
				row("default", "savings", "THB", 300_000, 0),
				row("default", "usd-wallet", "USD", 10_000, 0),
				row("other-co", "other-cash", "THB", 0, 0),
				row("other-co", "other-equity", "THB", 0, 0),
			],
			totals: [
				total("default", "THB", 4_300_000, 4_300_000),
				total("default", "USD", 10_000, 10_000),
				total("other-co", "THB", 0, 0),
			],
		})
	})
})
