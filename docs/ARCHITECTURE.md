# Architecture

The guiding rule: as little machinery as possible, and every decision
explainable in a sentence.

## The pieces

```
 iPhone / Android / browser                     Supabase (Paris)
┌───────────────────────────────┐          ┌──────────────────────────────┐
│ screens (src/app)             │          │ Postgres + row-level security│
│   └ store (src/data/store.ts) │──HTTPS──▶│ private storage "documents"  │
│       └ core (src/core)       │          │ auth (email + password)      │
│         pure calculations     │          │ edge function "ai" ──▶ Claude│
└───────────────────────────────┘          └──────────────────────────────┘
```

- **Expo / React Native** (SDK 58): one TypeScript codebase for iOS, Android
  and the web. Chosen over Flutter because the same code also produces the web
  app used for shared statements, and over a web-only app because receipts need
  the camera and the App Store is a goal.
- **Supabase**: already used by the owner, Postgres underneath (no lock-in:
  `pg_dump` gives a standard database), sign-in, private file storage and
  server functions in one free project.
- **No custom server.** The only server-side code is one edge function for AI.

## How data flows

On sign-in the app loads everything the user owns into memory (a host's books
are a few thousand rows at most). Screens then compute what they show with the
pure functions of `src/core`, so changing month or property is instant and
there is no second copy of the business rules in SQL.

Writes are optimistic: the store updates memory, sends the change, and rolls
back with an error banner if the server refuses.

If the data ever outgrows this (tens of thousands of rows), load by year in
`supabase.ts`; nothing else needs to change.

## The calculation model (`src/core/calc.ts`)

Every arrangement is the same three numbers per party, plus one rate:

| Arrangement | Me | Other party | Commission |
| --- | --- | --- | --- |
| Mine alone | 100 % income, 100 % expenses | — | 0 |
| Partnership 60/40 | 60 % / 60 % | 40 % / 40 % | 0 |
| The imported tracker | 60 % / 50 % | 40 % / 50 % | 0 |
| Managed for an owner | 0 % / 0 % | 100 % / 100 % | 13 % |

`Property.kind` is only a label that pre-fills these numbers. The maths never
look at it.

- **Rules over time.** A property has one or more `Rule` rows, each effective
  from a month. Editing the rules can apply from the selected month onwards
  (earlier months keep their results) or to the whole history.
- **Exceptions live on the row.** A booking can carry its own commission rate.
  An expense can be charged to one party, or marked **private**: a cost of the
  manager's own activity, which counts in "for me" but never in the property's
  books or in a shared statement.
- **Balances.** For each party: what they are entitled to (their share of the
  result) minus the cash they hold (payouts received − expenses paid ±
  transfers). The balances of a property always add up to zero.
- **Partnerships** (`kind: 'partnership'`) keep their income in the business
  and share the profit now and then, so the property page does not say "who
  owes whom". It shows what is left to recover since the first entry, the pace
  of the last complete months (`payback`), and each partner's account: what
  they paid in, plus their share of the result, minus what they were paid out.
  Money a partner puts in or takes out is a transfer.
- **Month of a booking** is the check-in month (as in the Excel tracker), or
  the payout month if the property is set that way.

Every amount keeps its original currency and a conversion rate; totals are in
the account currency (XOF by default).

## Recurring expenses (`src/core/recurring.ts`)

A recurring expense is a template. Each month it produces an ordinary expense
row (unique per template and month, enforced by the database). That row can be
edited, given a receipt, or **excluded**: it stays in the ledger, greyed out,
and counts nowhere. Because the row still exists it is not generated again;
the template and other months are untouched.

Generation happens when the app loads, for every month that has started.

## Sharing (`src/core/sharing.ts`)

A shared statement is built from an explicit allow-list of fields, then stored
as a frozen snapshot with a random token. The reader opens `/s/<token>`; the
server returns that snapshot and nothing else. See [SECURITY.md](SECURITY.md).

## AI (`supabase/functions/ai`)

Optional, and only where it saves real effort:

1. **Receipt reading**: a photo becomes a pre-filled expense (vendor, date,
   amount, currency, category). The user checks and saves.
2. **Questions about the figures**: monthly totals (never guest names or
   receipts) are sent with the question.

"What deserves a look" (rent not covered, a category far above its usual
level, a probable duplicate, overlapping bookings) is done with plain rules in
`src/core/insights.ts`: instant, free, and explainable.

## Design system (`src/ui`)

All colours, fonts and spacing come from `theme.ts`. The page is white; colour
is kept for meaning: soft tints mark the four tiles (income, expenses,
occupancy, income per night), green and red mark gains and losses, and each
property has its own pigment. One typeface, Plus Jakarta Sans, in three
weights. Corners are small (8 to 20) and most lists have no frame, only
dividers.

Figures are shown as pictures wherever that reads faster (`charts.tsx`):

- `Progress`: how far the month's income is from the rent and from break-even.
- `Ring`: the occupancy rate (nights booked out of nights available,
  `occupancy` in `core/calc.ts`).
- `Bars`: income against expenses, month by month.
- `Trend`: the running result over the year.
- `Breakdown`: where the money goes, or comes from.

Two themes share the same token names: **pastel** (the default) and
**indigo**. The choice is made in Settings and remembered on the device.
Switching swaps the values of the shared `color` object and re-creates the
screens; components read colours while rendering, never in a top-level
constant. Adding a theme is one more entry in `themes`.

## Phone and computer layouts (`src/ui/layout.tsx`)

One code base, two layouts, chosen by the width of the window (`useWide`,
960 px and above):

| | Narrow (phone) | Wide (computer) |
|---|---|---|
| Navigation | tab bar at the bottom, "+" in the middle | sidebar on the left with the property filter |
| Content | one column | `Cols` places blocks side by side |
| Forms | full-screen modal | dialog centred over the page (`FormScreen`) |
| Choices | sheet from the bottom | centred dialog (`Sheet`) |

Because the choice depends only on width, narrowing the browser window, or
using the browser's device simulator, shows the phone layout on the web.

## Adding things

- **A screen**: add a file in `src/app`, and a `<Stack.Screen>` line in
  `src/app/_layout.tsx` if it should open as a modal.
- **A field on a table**: add a migration in `supabase/migrations`, add the
  field to the type in `src/core/types.ts`, use it. There is no mapping layer.
- **A calculation**: add it to `src/core` with a test in `tests/`.
- **Text**: screens write both languages side by side: `t('Dépenses', 'Expenses')`.
