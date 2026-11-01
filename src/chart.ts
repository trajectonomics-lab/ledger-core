import type { Account, AccountInput } from "./account"
import { ChartOfAccounts } from "./chart-map"
import { parseCurrency } from "./currency"
import { LedgerValidationError } from "./errors"
import { checkHierarchy } from "./hierarchy"
import type { AccountId } from "./ids"

const toAccount = (input: AccountInput, index: number): Account =>
	Object.freeze({
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
	return new ChartOfAccounts(accounts)
}
