import { describe, expect, it } from "bun:test"
import { codeOf as queryCode } from "./builders.fixtures"
import { balances, createChartOfAccounts, reverse } from "./index"
import { accountInputs, bal, chart, ledger, thb, tx } from "./queries.fixtures"

const row = bal

const cashAt = (asOf: string, txs = ledger): number | undefined =>
	balances(txs, asOf, chart).find((r) => r.accountId === "cash")?.amount

describe("balances", () => {
	it("lists every Leaf Account's raw signed Balance as of a date, sorted, zeros included", () => {
		expect(balances(ledger, "2024-02-28", chart)).toEqual([
			row("default", "cash", "THB", 3_780_000),
			row("default", "equity", "THB", -200_000),
			row("default", "equity-usd", "USD", -10_000),
			row("default", "food", "THB", 200_000),
			row("default", "interest", "THB", 20_000),
			row("default", "loan", "THB", -100_000),
			row("default", "salary", "THB", -4_000_000),
			row("default", "savings", "THB", 300_000),
			row("default", "usd-wallet", "USD", 10_000),
			row("other-co", "other-cash", "THB", 0),
			row("other-co", "other-equity", "THB", 0),
		])
	})

	it("includes Transactions dated on asOf and excludes later ones", () => {
		expect(cashAt("2024-01-30")).toBe(100_000)
		expect(cashAt("2024-01-31")).toBe(4_100_000)
	})

	it("gives the same output for any Transaction order", () => {
		expect(balances([...ledger].reverse(), "2024-02-28", chart)).toEqual(
			balances(ledger, "2024-02-28", chart),
		)
	})

	it("nets a Reversal against its original, counting it on its own date", () => {
		const t5 = ledger.find((t) => t.id === "t5")!
		const withReversal = [...ledger, reverse(t5, { id: "r5", date: "2024-03-05" }, chart)]
		expect(cashAt("2024-03-04", withReversal)).toBe(3_780_000)
		expect(cashAt("2024-03-05", withReversal)).toBe(3_830_000)
	})

	it("rejects an invalid asOf with INVALID_DATE", () => {
		expect(queryCode(() => balances(ledger, "2024-02-30", chart))).toBe("INVALID_DATE")
	})

	it("re-checks Transactions dated after asOf too", () => {
		const without = createChartOfAccounts(accountInputs.filter((a) => a.id !== "food"))
		expect(queryCode(() => balances(ledger, "2024-01-01", without))).toBe("UNKNOWN_ACCOUNT")
	})

	it("rejects a Posting on an account that became a Header with NON_LEAF_ACCOUNT", () => {
		const grown = createChartOfAccounts([
			...accountInputs,
			{ id: "groceries", type: "expense", currency: "THB", parentId: "food" },
		])
		expect(queryCode(() => balances(ledger, "2024-02-28", grown))).toBe("NON_LEAF_ACCOUNT")
	})

	it("rejects a Posting in another Currency than its account with CURRENCY_MISMATCH", () => {
		const usdFood = createChartOfAccounts(
			accountInputs.map((a) => (a.id === "food" ? { ...a, currency: "USD" } : a)),
		)
		expect(queryCode(() => balances(ledger, "2024-02-28", usdFood))).toBe("CURRENCY_MISMATCH")
	})

	it("rejects a Transaction unbalanced under the supplied chart with UNBALANCED_TRANSACTION", () => {
		const moved = createChartOfAccounts(
			accountInputs.map((a) => (a.id === "food" ? { ...a, entityId: "other-co" } : a)),
		)
		expect(queryCode(() => balances(ledger, "2024-02-28", moved))).toBe("UNBALANCED_TRANSACTION")
	})

	it("rejects a repeated Transaction id with DUPLICATE_TRANSACTION_ID", () => {
		const again = tx("t1", "2024-05-01", [thb("cash", 1), thb("equity", -1)])
		expect(queryCode(() => balances([...ledger, again], "2024-02-28", chart))).toBe(
			"DUPLICATE_TRANSACTION_ID",
		)
	})

	it("rejects a Balance beyond the safe integer range with AMOUNT_OVERFLOW", () => {
		const big = (id: string) => tx(id, "2024-01-01", [thb("cash", 9e15), thb("equity", -9e15)])
		expect(queryCode(() => balances([big("a"), big("b")], "2024-01-01", chart))).toBe(
			"AMOUNT_OVERFLOW",
		)
	})

	it("mirrors the caller's input path in an error's field", () => {
		const bad = createChartOfAccounts(accountInputs.filter((a) => a.id !== "food"))
		const thrown = (() => {
			try {
				balances(ledger, "2024-02-28", bad)
			} catch (error) {
				return error
			}
			return undefined
		})()
		expect(thrown).toMatchObject({ field: "transactions[3].postings[0].accountId" })
	})
})
