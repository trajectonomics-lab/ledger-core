import { describe, expect, it } from "bun:test"
import { codeOf } from "./builders.fixtures"
import { balance, balances } from "./index"
import { chart, ledger } from "./queries.fixtures"

describe("balance", () => {
	it("returns the same row balances gives for that Account", () => {
		const all = balances(ledger, "2024-02-28", chart)
		for (const expected of all) {
			expect(balance(ledger, expected.accountId, "2024-02-28", chart)).toEqual(expected)
		}
	})

	it("rejects an unknown account id with UNKNOWN_ACCOUNT", () => {
		expect(codeOf(() => balance(ledger, "nope", "2024-02-28", chart))).toBe("UNKNOWN_ACCOUNT")
	})

	it("rejects a Header Account id with NON_LEAF_ACCOUNT", () => {
		expect(codeOf(() => balance(ledger, "assets", "2024-02-28", chart))).toBe("NON_LEAF_ACCOUNT")
	})
})
