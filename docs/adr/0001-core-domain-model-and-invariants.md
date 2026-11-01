# 0001. Core domain model and invariants

Status: accepted (issue #2)

## Context

`ledger-core` must make an unbalanced book impossible to record while staying pure (no I/O, clock, randomness, ID generation, or runtime dependencies) and closed-world (no callbacks or plugin hooks).

## Decisions

- **Smart constructors, branded outputs.** `createChartOfAccounts` returns a branded `ChartOfAccounts`; `validateTransaction(input, chart)` returns a branded `Transaction`. Only these functions can produce the branded types, so holding one proves the invariants. Both throw `LedgerValidationError` (`code`, `field`, `value`, `reason`) with one distinct `LedgerErrorCode` per rule. We expose a single constructor name, `createChartOfAccounts`, rather than an alias.
- **Money is a signed safe integer of minor units.** Debit `+`, credit `-`. Zero amounts, floats, `NaN`, `Infinity`, and unsafe integers are rejected (`ZERO_AMOUNT_POSTING`, `INVALID_AMOUNT`). Balance sums use `BigInt` so they are exact even near the safe-integer limit.
- **Currencies come from `Intl`.** `Intl.supportedValuesOf("currency")` validates codes and `NumberFormat(...).resolvedOptions().maximumFractionDigits` gives precision, so no currency table ships. Consequence: the accepted set follows the runtime's ICU data (Bun lists more codes than Node; e.g. `CLF` is absent on Node 24). Codes must be uppercase.
- **Balance is per `(entityId, currency)`.** A posting's currency must equal its account's currency (`CURRENCY_MISMATCH`), so a transaction may carry several currencies, but each must net to zero in each entity on its own. There is no FX.
- **Five account types, leaf-only postings.** Opening balances use `equity`. A parent must exist, share entity and type, and form no cycle (`INVALID_ACCOUNT_HIERARCHY`); postings to any account that is some other account's parent fail with `NON_LEAF_ACCOUNT`.
- **Duplicate account ids** in one chart are rejected with `INVALID_ACCOUNT_HIERARCHY`. The issue lists no dedicated code and a duplicate id makes the parent graph ambiguous.
- **Accounts carry no display name.** Labels are the consumer's concern; the core only needs `id`, `type`, `currency`, `entityId`, `parentId`.
- **Validated values are immutable.** Transactions, postings, and dimensions are frozen, and a chart's `set`/`delete`/`clear` throw, so a held value cannot drift out of its invariants.
- **Wire-shape checks belong to the consumer.** The core validates the rules above, not whether an untyped payload has a string `id` or a known `type`; the issue defines no error code for those and consumers translate at their boundary. A non-array `postings` is treated as too few postings.
- **Id brands are nominal tags, not validators.** `accountId()` / `transactionId()` only separate the two id spaces in the type system; ids are opaque caller-supplied strings and are not checked for content.
- **Header detection derives from the chart.** `isLeafAccount` recomputes the header set from the chart on a cache miss, so a chart built by the other ESM/CJS copy of the package never makes a header account look like a leaf.
- **No dependencies.** No Zod or JSON Schema; consumers validate their own wire formats and pass plain data in.

## Consequences

Later primitives (queries, reversal/amend helpers) build on `ChartOfAccounts` and `Transaction` and need not re-check these invariants.
