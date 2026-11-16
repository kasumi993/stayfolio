# Stayfolio

The books of a short-term rental host, without the spreadsheet: income by
platform, expenses, rent coverage, partner splits, management commissions,
receipts and statements to share with owners and partners.

One codebase runs on iPhone, Android and the web (Expo + React Native).
Data lives in Supabase (Postgres, private file storage, sign-in).

## What it does

| In the app | Where it comes from in the Excel tracker |
| --- | --- |
| **Month** tab: one sentence on where the month stands, nights booked, split between parties, every entry | `Monthly_Dashboard` row + the two entry sheets |
| **Places** tab: each property, its rules, who owes whom, recurring expenses, shared statements | `Setup` + the "Paid investor" columns |
| **Reports** tab: the year month by month with running total, by platform, by category | `Monthly_Dashboard` |
| **Receipts** tab: every photo or PDF, linked to its expense | (new) |
| **+** button: add an expense or an income, or photograph a receipt | typing a row |

Things that needed manual work in Excel and no longer do:

- **Recurring expenses** (rent, internet) are set up once and add themselves each
  month. A single month can be excluded without touching the setup or other months.
- **Any arrangement** fits one model: each party has a share of income and a share
  of expenses, and the manager may take a commission on each booking first. The
  rules can change from a given month onwards, leaving the past as it was.
- **Amounts accept sums**, like a cell: `175156+14000`.
- **Import** reads the Excel tracker and checks the result against the
  workbook's own dashboard before saving. **Export** writes everything back to Excel.

## Run it

```bash
npm install
npm run web          # in a browser
npm start            # with Expo Go or a development build on a phone
```

Without a `.env` the app still runs in demo mode (sample data in memory).

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # unit tests of the calculation engine
STAYFOLIO_SAMPLE_XLSX=/path/to/tracker.xlsx npm test   # + parity with a real workbook
```

## Where things are

```
src/
  core/        The rules of the business. Pure TypeScript, no UI, fully tested.
    calc.ts          statements, splits, commissions, balances
    recurring.ts     recurring expenses
    sharing.ts       what an owner or partner may see (allow-list)
    insights.ts      plain rules that flag what deserves a look
    importWorkbook.ts / export.ts / xlsx.ts   Excel in and out
    money.ts / dates.ts / types.ts
  data/        Where data lives.
    backend.ts       the interface the app talks to
    supabase.ts      the real backend
    demo.ts          sample data in memory
    store.ts         the app's single store (who is signed in, their data)
  platform/    Camera, files, sharing: everything device-specific.
  ui/          Design system: theme, text, icons, controls, fields, charts.
  features/    Pieces shared by several screens.
  app/         Screens. One file = one screen (Expo Router).
supabase/
  migrations/  The database schema and its security rules.
  functions/ai The only server code: receipt reading and questions.
docs/          Architecture, security, operations, release.
tests/         Unit tests.
```

Read next: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/SECURITY.md](docs/SECURITY.md), [docs/OPERATIONS.md](docs/OPERATIONS.md),
[docs/RELEASE.md](docs/RELEASE.md).
