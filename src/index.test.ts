import { describe, expect, it } from "bun:test"
import * as ledgerCore from "./index"

describe("@trajectonomics/ledger-core public entry", () => {
	it("loads module cleanly", () => {
		expect(ledgerCore).toBeDefined()
	})
})
