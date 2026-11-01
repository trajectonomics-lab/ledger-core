import type { Account, AccountInput } from "./account"
import type { Brand } from "./brand"
import { parseCurrency } from "./currency"
import { LedgerValidationError } from "./errors"
import { checkHierarchy } from "./hierarchy"
import type { AccountId } from "./ids"
import { seal } from "./seal"

/**
 * A validated, hierarchy-checked set of accounts. Only {@link createChartOfAccounts} produces
 * one, so holding one proves parents exist, share entity and type, and form no cycle.
 */
export type ChartOfAccounts = Brand<ReadonlyMap<AccountId, Account>, "ChartOfAccounts">

const headers = new WeakMap<ChartOfAccounts, ReadonlySet<AccountId>>()

const toAccount = (input: AccountInput, index: number): Account => ({
	id: input.id as AccountId,
	type: input.type,
	currency: parseCurrency(input.currency, `accounts[${index}].currency`),
	entityId: input.entityId ?? "default",
	...(input.parentId === undefined ? {} : { parentId: input.parentId as AccountId }),
})

/** Validate accounts and build the chart. Throws {@link LedgerValidationError}. */
export const createChartOfAccounts = (inputs: Iterable<AccountInput>): ChartOfAccounts => {
	const accounts = new Map<AccountId, Account>()
	for (const [index, input] of [...inputs].entries()) {
		const account = toAccount(input, index)
		if (accounts.has(account.id)) {
			throw new LedgerValidationError(
				"INVALID_ACCOUNT_HIERARCHY",
				`accounts[${index}].id`,
				input.id,
				"duplicate account id",
			)
		}
		accounts.set(account.id, account)
	}
	checkHierarchy(accounts)
	const chart = seal(accounts) as unknown as ChartOfAccounts
	headers.set(
		chart,
		new Set([...accounts.values()].flatMap((a) => (a.parentId === undefined ? [] : [a.parentId]))),
	)
	return chart
}

/** True when no other account in the chart names this account as its parent. */
export const isLeafAccount = (chart: ChartOfAccounts, id: AccountId): boolean =>
	!headers.get(chart)?.has(id)
