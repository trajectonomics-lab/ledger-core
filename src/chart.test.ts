import { describe, expect, it } from "bun:test"
import { type AccountInput, accountId, createChartOfAccounts, LedgerValidationError } from "./index"

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

	it("isLeaf is false for ids not in the chart, true only for leaves", () => {
		const chart = createChartOfAccounts([acct("assets"), acct("cash", { parentId: "assets" })])
		expect(chart.isLeaf(accountId("cash"))).toBe(true)
		expect(chart.isLeaf(accountId("assets"))).toBe(false)
		expect(chart.isLeaf(accountId("ghost"))).toBe(false)
	})
})

describe("chart immutability", () => {
	it("cannot be mutated, not even through Map.prototype", () => {
		const chart = createChartOfAccounts([acct("assets"), acct("cash", { parentId: "assets" })])
		const bypass = (): unknown => Map.prototype.set.call(chart, "x", {})
		expect(bypass).toThrow(TypeError)
		expect(() => Map.prototype.delete.call(chart, "cash")).toThrow(TypeError)
		expect(chart.size).toBe(2)
	})

	it("is read-only through its own surface and iterates like a ReadonlyMap", () => {
		const chart = createChartOfAccounts([acct("a"), acct("b")])
		expect([...chart.keys()]).toEqual(["a", "b"] as never)
		expect([...chart].length).toBe(2)
		expect("set" in chart).toBe(false)
	})

	it("allows a header in a different currency from its children (documented in ADR 0001)", () => {
		const chart = createChartOfAccounts([
			acct("assets", { currency: "THB" }),
			acct("usd-cash", { parentId: "assets" }),
		])
		expect(chart.isLeaf(accountId("usd-cash"))).toBe(true)
	})
})
