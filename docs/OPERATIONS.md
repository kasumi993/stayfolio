# Operations: costs, limits, backups

## What it costs (checked November 2026)

| Service | Plan | Cost | Limits that matter |
| --- | --- | --- | --- |
| Supabase | Free | $0 | 500 MB database, 1 GB files, 2 active projects per organisation, **no automatic backups**, **paused after 7 days without activity** |
| Expo (EAS Build) | Free | $0 | 15 iOS + 15 Android builds a month, slow queue |
| Web hosting (Vercel Hobby or similar) | Free | $0 | personal use |
| Apple Developer Program | — | $99 / year | required to install on an iPhone beyond 7 days and for TestFlight / App Store |
| Google Play (later) | — | $25 once | |
| AI (Claude Haiku 5.5) | pay as you go | about $0.001 per receipt | optional; capped at 60 calls a day per user |

Orders of magnitude: one year of one property is about 150 rows and, with a
receipt for every expense at ~200 KB each, about 20 MB of files. The free plan
holds many years of several properties.

**When to move to Supabase Pro ($25 / month):** when losing a day of data
would hurt enough to want daily managed backups, or when files approach 1 GB.
Nothing changes in the code.

## Backups

The free plan has none, so the repository has its own
(`.github/workflows/backup.yml`): every night GitHub Actions dumps the schema
and the data and keeps them 90 days as a private artifact. The same job
queries the database, which also prevents the 7-day pause.

One-time setup:

1. Supabase dashboard → **Connect** → copy the **Session pooler** connection
   string (the direct connection is IPv6-only and does not work from GitHub).
2. GitHub → repository → **Settings → Secrets and variables → Actions → New
   repository secret**, name `SUPABASE_DB_URL`, paste the string with the
   database password filled in.
3. **Actions → Backup → Run workflow** once, and check that an artifact appears.

Until the secret exists the job only keeps the project awake and prints a warning.

To restore into a new project:

```bash
psql "$NEW_DB_URL" -f schema.sql
psql "$NEW_DB_URL" -f data.sql
```

Two more safety nets:

- **Settings → Export to Excel** in the app gives a readable copy of everything
  at any time.
- Receipts are not in the database dump. They live in Supabase Storage (kept
  redundantly by the provider, but not versioned). If they become critical,
  move to Pro or add a storage sync to the backup job.

## If the project gets paused

Supabase dashboard → the project → **Restore**. Data is kept. Then check that
the Backup workflow is running (it should prevent this).

## Updating the app

- **Web**: every push to `main` redeploys.
- **Phones**: run the *Build iOS* workflow; the build goes to TestFlight.
- **Dependencies**: once or twice a year, `npx expo install expo@latest` then
  `npx expo install --fix`, run the checks, rebuild. Expo publishes an upgrade
  guide for each SDK.

## Database changes

Schema changes are SQL files in `supabase/migrations`, named with the
timestamp under which they were applied. Apply a new one with the Supabase
dashboard SQL editor or the Supabase CLI (`supabase db push`), and commit the file.

## Health checks

- `npm run typecheck && npm run lint && npm test` (also run on every push).
- Supabase dashboard → **Advisors** after any schema change.
- Supabase dashboard → **Reports** for database size and storage use.

## The Supabase project

Project `qizxtnojgxhkqasavghb` (Stayfolio, eu-west-1), moved there on
22 November 2026 from `fyxidngsxltwluzzudrt`, which held no data. Its URL and
publishable key are in `.env` (public values). Edge functions:

| Function | Who calls it | Sign-in |
| --- | --- | --- |
| `ai` | the app (receipts, questions) | signed-in user |
| `delete-account` | Settings, "Supprimer mon compte" | signed-in user |
| `member-files` | a member link (invoices) | none: the link token, checked inside |
| `member-invite` | member form, "Envoyer par e-mail" | signed-in owner |
| `monthly-report` | the database schedule, or "Envoyer le récap…" | none: a one-time row of `report_requests` |

Deploying a function: `node scripts/bundle-functions.mjs` (copies the shared
code and `src/core` into the functions), then deploy each folder, or one file
bundled with `npx esbuild <fn>/index.ts --bundle --format=esm --platform=neutral
--external:'jsr:*' --charset=ascii`.

## Emails

Two kinds, both going out through Brevo (account "Miracute", no footer
with the account address: transactional mail does not need one; sender
hello@miracute.com shown as "Stayfolio"; domain miracute.com authenticated;
free plan: 300 emails a day, with Brevo's small "Sent with Brevo" mark).

1. **Sign-in emails** (link and code, new account, password, address change):
   sent by Supabase Auth through the Brevo SMTP set in the project
   (Authentication → Emails → SMTP). Their content is Supabase's templates:
   paste the files of `supabase/templates/` (see its README).
2. **App emails**: the member link and the monthly recap, sent by the edge
   functions through Brevo's API with Brevo templates:
   - "Stayfolio · Invitation d'un membre" (id 9), `emails/brevo/invite.html`
   - "Stayfolio · Rapport mensuel" (id 10), `emails/brevo/report.html`
   They need the function secret `BREVO_API_KEY` (a Brevo **API** key,
   different from the SMTP key) and both templates **active** in Brevo.
   The source HTML lives in the repo; after changing it, update the Brevo
   template with the same HTML.

The recap runs on the 1st of each month at 07:00 UTC (`pg_cron` job
`stayfolio-monthly-report`). To test without sending, as the database owner:
`select public.request_monthly_reports(null, true);` then read the reply in
`net._http_response`.

## Sign-in emails must carry the code

The app installed on an iPhone home screen does not share its session with
Safari, so opening the sign-in link there signs Safari in, not the app. The
app therefore also accepts the code from the same email. Supabase only puts
the code in the email if the template asks for it: in Supabase,
Authentication → Emails, templates "Magic link" and "Confirm signup", keep
the link and add a line with `{{ .Token }}`. The ready-made templates in
`supabase/templates/` already do.
