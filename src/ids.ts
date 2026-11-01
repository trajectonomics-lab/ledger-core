import type { Brand } from "./brand"

/** Caller-supplied account identifier. This package never generates ids. */
export type AccountId = Brand<string, "AccountId">
/** Caller-supplied transaction identifier. This package never generates ids. */
export type TransactionId = Brand<string, "TransactionId">

/** Tag a string as an {@link AccountId}, e.g. to look an account up in a chart. */
export const accountId = (value: string): AccountId => value as AccountId
/** Tag a string as a {@link TransactionId}. */
export const transactionId = (value: string): TransactionId => value as TransactionId
