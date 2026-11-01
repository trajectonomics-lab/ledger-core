# 0002. Correction and common-pattern builders

Status: accepted (issue #4)

## Context

ADR-0001 left `validateTransaction` as the only way to obtain a `Transaction`, so everyday bookkeeping — paying rent, receiving income, moving money between accounts, opening balances, withdrawing a mistake — still means hand-assembling postings. The likeliest mistake there is a flipped sign: a ledger that balances perfectly can still be systematically backwards on income or on liabilities, and nothing catches it. Issue #4 adds builders for those patterns while keeping the package pure: no clock, no randomness, no ID generation, no I/O.

## Decisions

- **Builders return `Transaction`, and take the chart as their trailing argument.** `validateTransaction(input, chart)` is the only constructor of a branded `Transaction`, so a builder without a chart could only hand back an unchecked input — giving away the guarantee it exists to provide. Free functions, not methods on `ChartOfAccounts`: that type stays an immutable read-only value.
- **Legs are named `debit` and `credit`, not `from` and `to`.** The `from`/`to` mnemonic silently reverses between patterns: paying rent is "from cash, to rent", while earning income is "from income, to cash", which reads past-facing and invites posting income as a debit. `debit`/`credit` carries no mnemonic to get wrong and is already defined in `GLOSSARY.md`.
- **The builders are named after accounting entries, not after shapes.** A two-account transaction is a **Simple Entry** and a larger one is a **Compound Entry**, so `simple` and `compound` are the domain words. `compound` accepts many legs on *either* side, because a sale with tax (one Debit for cash, two Credits for revenue and tax payable) is the mirror of a loan payment and no more or less common.
- **Corrections are a pair.** `reverse` and `amend` add Transactions; nothing edits or deletes. `amend` returns `[reversal, replacement]` rather than one netting transaction, because a correction that changes only a date or a dimension nets to fewer than two Postings (`SINGLE_POSTING`), and one Transaction cannot carry two dates.
- **A Reversal may not predate its original.** Equal dates are allowed, which is the "as if it never happened" void within one period. Dating a correction before the entry it corrects would scramble period order; the rule never blocks a correct result, since a post-dated entry voided earlier simply reverses on its own date, when it first took effect.
- **A Reversal is identified from its Postings, so `Transaction` gains no `kind` field.** A Reversal is by definition the exact negation of its original, and `amend` returns its pair in order, so the writer always knows which is which. Recording the distinction in stored rows is a query concern (#3), and giving consumers a `kind` field now would commit them to migrating data to change it later.
- **Builder amounts are magnitudes; the builder derives the sign.** Passing a negative amount is a caller bug, so it gets its own code. Zero stays `ZERO_AMOUNT_POSTING`, keeping one code per rule.
- **`openingBalance` takes a signed amount, an explicit Equity contra Account, and does not infer direction.** Inferring from Normal Balance would contradict ADR-0001 ("a Posting's sign never depends on the Account Type") and, more practically, could not express an overdrawn Asset that legitimately opens negative. The contra Account is a required parameter because the core never invents account ids and owns no id conventions. It must be of type `equity`.
- **Currency comes from the Accounts, never from the caller.** A builder reads each leg's Account from the chart and rejects legs in differing currencies with `CURRENCY_MISMATCH`; there is no FX in the core.
- **Four new error codes, one per rule:** `NEGATIVE_AMOUNT`, `DUPLICATE_TRANSACTION_ID`, `REVERSAL_BEFORE_ORIGINAL`, `NON_EQUITY_CONTRA`. `DUPLICATE_TRANSACTION_ID` covers only the ids the core can see in one call (original, reversal, replacement); the core holds no ledger state, so global uniqueness stays a consumer concern. Unbalanced compound legs need no new code: they already fail `UNBALANCED_TRANSACTION`.
- **`externalRef` is deferred.** Bank references are real, but no builder and no acceptance seed needs one, and ADR-0001 already refused to put consumer-facing labels on Accounts ("labels are the consumer's concern"). Adding an optional field later is additive and non-breaking; guessing its shape now is not.

## Considered Options

- **One netting transaction for `amend`.** Rejected: it drops the audit trail, collapses to `SINGLE_POSTING` whenever the change is date- or dimension-only, and cannot hold two dates.
- **`split`, many legs on one side only.** Rejected in favour of `compound`: the mirror case is equally common, and one builder beats two near-identical ones. Nothing depended on the name yet.
- **Inferring an opening balance's direction from `normalBalance`.** Rejected on ADR-0001 grounds and because overdrawn Assets are real.
- **Enforcing "reversal date must be after the original".** Rejected: same-period voids are the common correction and must be expressible.

## Consequences

- Consumers express corrections and the common patterns without postings in hand, and a flipped sign is now an error rather than a plausible-looking ledger.
- Builders re-validate against the chart they are given. Reversing a Transaction whose Account has since become a Header Account fails with `NON_LEAF_ACCOUNT`. That is correct — Headers never take Postings — but callers correcting old entries should expect it.
- The core cannot tell whether a Transaction was already reversed, nor whether an id was used elsewhere in the caller's storage. Both remain consumer concerns, which keeps the package closed-world and stateless.
