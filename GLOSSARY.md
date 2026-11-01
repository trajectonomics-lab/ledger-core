# Glossary

Domain vocabulary for `ledger-core`.

## Terms

- **Account**: An identified bucket categorised as an Asset, Liability, Equity, Income, or Expense. Belongs to one **Entity**, holds one **Currency**, and may roll up into a **Header Account**.
- **Account Type**: One of `asset`, `liability`, `equity`, `income`, `expense`. There is no sixth type: opening balances are posted against ordinary `equity` accounts.
- **Normal Balance**: The side on which an Account Type normally grows. **Debit** for `asset` and `expense`; **Credit** for `liability`, `equity`, and `income`.
- **Entity**: The legal/accounting body that owns an Account (`entityId`, `"default"` if omitted). A Transaction must balance within each Entity separately.
- **Chart of Accounts**: A validated set of Accounts. Every parent exists, shares its child's Entity and Account Type, and the hierarchy has no cycles. Produced only by `createChartOfAccounts`.
- **Header Account** (summary): An Account named as another Account's `parentId`. It only aggregates; nothing may be posted to it.
- **Leaf Account** (detail): An Account no other Account names as parent. Postings target Leaf Accounts only.
- **Currency**: An ISO 4217 alphabetic code (`THB`, `USD`, `JPY`). Its **Minor Unit** precision comes from the runtime's `Intl` data (THB 2, JPY 0, KWD 3, CLF 4).
- **Minor Unit**: The smallest division of a Currency (satang, cent, yen). All amounts are stored as safe integers of Minor Units; floats never enter the model. `toMinorUnits` / `fromMinorUnits` convert at the boundary.
- **Posting**: One signed, non-zero amount in one Currency against one Leaf Account, optionally tagged with **Dimensions**.
- **Debit / Credit (sign convention)**: A Debit is a **positive** Minor Unit amount; a Credit is a **negative** one. A Posting's sign never depends on the Account Type; Normal Balance only says which sign is "usual".
- **Transaction**: A set of at least two Postings, dated with an **ISODate**, whose amounts sum to zero for every `(Entity, Currency)` pair. Debits equal Credits. An unbalanced Transaction cannot be constructed.
- **ISODate**: A real calendar date `YYYY-MM-DD`. No time of day, no timezone.
- **Dimensions**: Non-empty string key/value tags on a Posting (cost centre, project, class) for cost accounting.
- **linkedTo**: A Transaction's pointer to the earlier Transaction it reverses or amends. Ledgers are append-only: corrections add Transactions, they never edit old ones.
- **Balance**: The accumulated sum of Postings for an Account at a given point in time.
- **Net Worth**: Total Assets minus total Liabilities.
- **P&L (Profit and Loss)**: Income minus Expenses over a specific period.
