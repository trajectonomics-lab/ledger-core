import { describe, expect, it } from "bun:test"
import {
	type AccountInput,
	accountId,
	createChartOfAccounts,
	isLeafAccount,
	LedgerValidationError,
} from "./index"

const acct = (id: string, extra: Partial<AccountInput> = {}): AccountInput => ({
	id,
	type: "asset",
	currency: "USD",
	...extra,
})

const failure = (accounts: AccountInput[]): LedgerValidationError => {
	try {
		createChartOfAccounts(accounts)
	} catch (error) {
		if (error instanceof LedgerValidationError) return error
		throw error
	}
	throw new Error("expected createChartOfAccounts to throw")
}

describe("createChartOfAccounts", () => {
	it("returns accounts keyed by id and defaults entityId to 'default'", () => {
		const chart = createChartOfAccounts([acct("cash"), acct("bank", { entityId: "acme" })])
		expect(chart.size).toBe(2)
		expect(chart.get("cash" as never)?.entityId).toBe("default")
		expect(chart.get("bank" as never)?.entityId).toBe("acme")
	})

	it("accepts a valid same-entity same-type hierarchy", () => {
		const chart = createChartOfAccounts([
			acct("assets"),
			acct("cash", { parentId: "assets" }),
			acct("petty", { parentId: "cash" }),
		])
		expect(chart.get("petty" as never)?.parentId).toBe("cash" as never)
	})

	it("rejects a missing parent", () => {
		expect(failure([acct("cash", { parentId: "ghost" })]).code).toBe("INVALID_ACCOUNT_HIERARCHY")
	})

	it("rejects a cross-type parent", () => {
		const error = failure([
			acct("loans", { type: "liability" }),
			acct("cash", { parentId: "loans" }),
		])
		expect(error.code).toBe("INVALID_ACCOUNT_HIERARCHY")
	})

	it("rejects a cross-entity parent", () => {
		const error = failure([
			acct("assets", { entityId: "a" }),
			acct("cash", { parentId: "assets", entityId: "b" }),
		])
		expect(error.code).toBe("INVALID_ACCOUNT_HIERARCHY")
	})

	it("rejects cycles, including self-parenting", () => {
		expect(failure([acct("a", { parentId: "b" }), acct("b", { parentId: "a" })]).code).toBe(
			"INVALID_ACCOUNT_HIERARCHY",
		)
		expect(failure([acct("a", { parentId: "a" })]).code).toBe("INVALID_ACCOUNT_HIERARCHY")
	})

	it("rejects duplicate account ids", () => {
		expect(failure([acct("a"), acct("a")]).code).toBe("INVALID_ACCOUNT_HIERARCHY")
	})

	it("rejects a non-ISO 4217 account currency", () => {
		expect(failure([acct("a", { currency: "ZZZ" })]).code).toBe("INVALID_CURRENCY")
	})
})

describe("empty parentId", () => {
	it("is a dangling parent, not 'no parent'", () => {
		expect(failure([acct("x", { parentId: "" })]).code).toBe("INVALID_ACCOUNT_HIERARCHY")
	})
})

describe("validated accounts", () => {
	it("are frozen", () => {
		const chart = createChartOfAccounts([acct("cash")])
		expect(Object.isFrozen(chart.get("cash" as never))).toBe(true)
	})

	it("isLeafAccount is false for ids not in the chart, true only for leaves", () => {
		const chart = createChartOfAccounts([acct("assets"), acct("cash", { parentId: "assets" })])
		expect(isLeafAccount(chart, accountId("cash"))).toBe(true)
		expect(isLeafAccount(chart, accountId("assets"))).toBe(false)
		expect(isLeafAccount(chart, accountId("ghost"))).toBe(false)
	})
})

describe("charts unknown to this module instance", () => {
	it("still report header accounts as non-leaf (fail closed)", () => {
		const chart = createChartOfAccounts([acct("assets"), acct("cash", { parentId: "assets" })])
		const foreign = new Map(chart) as unknown as typeof chart
		expect(isLeafAccount(foreign, accountId("assets"))).toBe(false)
		expect(isLeafAccount(foreign, accountId("cash"))).toBe(true)
	})
})
