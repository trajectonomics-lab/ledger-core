import { describe, expect, it } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const DIRS = ["src", "scripts"]
const SELF = "todos.test.ts"

/** A postponed-work marker that is not followed by an issue number. */
const UNTRACKED = /\b(?:TODO|FIXME|HACK)\b(?!\(#\d+\))/

const files = (dir: string): string[] =>
	readdirSync(join(ROOT, dir), { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && entry.name !== SELF)
		.map((entry) => entry.name)

const untracked = (): string[] =>
	DIRS.flatMap((dir) =>
		files(dir).flatMap((name) =>
			readFileSync(join(ROOT, dir, name), "utf8")
				.split("\n")
				.flatMap((text, index) =>
					UNTRACKED.test(text) ? [`${dir}/${name}:${index + 1} ${text.trim()}`] : [],
				),
		),
	)

describe("postponed work", () => {
	it("scans the source tree", () => {
		expect(DIRS.flatMap(files).length).toBeGreaterThan(5)
	})

	it("every TODO, FIXME, and HACK carries an issue number", () => {
		expect(untracked()).toEqual([])
	})
})
