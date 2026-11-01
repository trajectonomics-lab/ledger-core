import { describe, expect, it } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const SRC = join(import.meta.dir, "..", "src")

/** Every code declared in the `LedgerErrorCode` union. */
const declaredCodes = (): string[] => {
	const source = readFileSync(join(SRC, "errors.ts"), "utf8")
	const union = /export type LedgerErrorCode =([\s\S]*?)\n\n/.exec(source)?.[1] ?? ""
	return [...union.matchAll(/"([A-Z][A-Z_]+)"/g)].map((match) => match[1] as string)
}

const testSource = (): string =>
	readdirSync(SRC)
		.filter((file) => file.endsWith(".test.ts"))
		.map((file) => readFileSync(join(SRC, file), "utf8"))
		.join("\n")

describe("error code coverage", () => {
	it("reads the declared codes", () => {
		expect(declaredCodes().length).toBeGreaterThan(5)
	})

	it("every LedgerErrorCode is asserted by some test", () => {
		const tests = testSource()
		const untested = declaredCodes().filter((code) => !tests.includes(`"${code}"`))
		expect(untested).toEqual([])
	})
})
