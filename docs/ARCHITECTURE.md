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
- **Set-up costs** (`scope: 'setup'`) are what it cost to get a property
  ready, paid out of what the partners put in. They stay out of the monthly
  result and of every party's share; they only count in the running result
  since the first entry (`cumulative`), which says what is left to recover.
- **Partnerships** (`kind: 'partnership'`) keep their income in the business
  to pay the running costs and share what is left now and then. Their page
  therefore does not say "who owes whom". It shows the profit since the
  beginning (set-up aside) with each partner's share, what was already paid
  out, then the initial outlay: set-up costs, what each partner paid in, what
  is left to recover and how long that takes at the recent pace (`payback`).
  Money moves in and out of the property's own cash: a transfer with no
  `to_party` is a contribution (mine included), one with no `from_party` is
  profit paid out. `treasury` adds it all up: what was put in and earned,
  minus what was paid and paid out.
- **People stay.** A partner or owner who already appears in the accounts
  cannot be deleted (past months and payments would stop adding up). They
  leave by having their shares set to zero from a given month.
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

Three themes share the same token names: **pastel** (the default, light),
**dark** (the same pastels on the logo's ink) and **indigo**. The choice is made in Settings and remembered on the device.
Switching swaps the values of the shared `color` object and re-creates the
screens; components read colours while rendering, never in a top-level
constant. Adding a theme is one more entry in `themes`.

## The mark

`src/ui/Logo.tsx` draws the mark: four chart bars whose tops, cut at an angle,
draw a roof, on the brand ink (`brand` in `theme.ts`, the same in every theme).
The app icons are generated from the same drawing by a small script
(`sharp`): full-bleed squares for iOS, Android and the maskable web icon,
a rounded tile for desktop shortcuts and the favicon.

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

## Installing the web version (PWA)

`public/manifest.json` and `public/sw.js` make the site installable. The
service worker keeps the app shell and the built files so the app opens
offline, and never caches data. `src/platform/install.ts` catches Chrome's
`beforeinstallprompt` (one-tap install on Android and computers) and detects
iPhone and iPad, where Safari has no such event and the banner explains
Share → Add to Home Screen. The banner (`features/InstallBanner.tsx`) sits
above the tab bar on a phone and in the sidebar on a computer; "Not now"
hides it for 30 days, and Settings keep the option. A long press on the
installed icon (Android, computers) offers shortcuts that open `/?add=expense`,
`/?add=booking` or `/reports`.

Home screen widgets are not possible for a web app on iPhone or Android:
they need the native app (WidgetKit on iOS), see `docs/RELEASE.md`.

## Adding things

- **A screen**: add a file in `src/app`, and a `<Stack.Screen>` line in
  `src/app/_layout.tsx` if it should open as a modal.
- **A field on a table**: add a migration in `supabase/migrations`, add the
  field to the type in `src/core/types.ts`, use it. There is no mapping layer.
- **A calculation**: add it to `src/core` with a test in `tests/`.
- **Text**: screens write both languages side by side: `t('Dépenses', 'Expenses')`.
