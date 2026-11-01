import type { Account } from "./account"
import type { AccountId } from "./ids"

/**
 * A validated, hierarchy-checked set of accounts, read-only at runtime. Only
 * {@link createChartOfAccounts} constructs one (this module's constructor is not exported from
 * the package), so holding one proves parents exist, share entity and type, and form no cycle.
 * Its state lives in `#private` fields, so it cannot be mutated even via `Map.prototype`.
 */
export class ChartOfAccounts implements ReadonlyMap<AccountId, Account> {
	readonly #accounts: ReadonlyMap<AccountId, Account>
	readonly #headers: ReadonlySet<AccountId>

	constructor(accounts: ReadonlyMap<AccountId, Account>) {
		this.#accounts = new Map(accounts)
		this.#headers = new Set(
			[...accounts.values()].flatMap((a) => (a.parentId === undefined ? [] : [a.parentId])),
		)
	}

	get size(): number {
		return this.#accounts.size
	}

	get(id: AccountId): Account | undefined {
		return this.#accounts.get(id)
	}

	has(id: AccountId): boolean {
		return this.#accounts.has(id)
	}

	/** True for an account in this chart that no other account names as its parent. */
	isLeaf(id: AccountId): boolean {
		return this.#accounts.has(id) && !this.#headers.has(id)
	}

	forEach(
		callbackfn: (value: Account, key: AccountId, map: ReadonlyMap<AccountId, Account>) => void,
		thisArg?: unknown,
	): void {
		for (const [key, value] of this.#accounts) {
			callbackfn.call(thisArg, value, key, this)
		}
	}

	entries(): MapIterator<[AccountId, Account]> {
		return this.#accounts.entries()
	}

	keys(): MapIterator<AccountId> {
		return this.#accounts.keys()
	}

	values(): MapIterator<Account> {
		return this.#accounts.values()
	}

	[Symbol.iterator](): MapIterator<[AccountId, Account]> {
		return this.#accounts.entries()
	}
}
