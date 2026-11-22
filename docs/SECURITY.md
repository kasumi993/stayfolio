# Security

## The model in one paragraph

Every row belongs to exactly one user (`owner_id`). Postgres row-level
security lets a signed-in user read and change only their own rows, and gives
visitors nothing. Owners and partners never get an account or database access:
they read **frozen statements** published by the manager, through one function
that returns the snapshot for a valid token and nothing else, or they open a
**member link**: a personal link to one property, live, with only the pages and
the right to edit that the owner chose. Member links go through database
functions too; the `anon` role still has no table access.

## What is enforced where

| Risk | Protection | Where |
| --- | --- | --- |
| One user reading another's data | RLS policy `owner_id = auth.uid()` on every table | `supabase/migrations/*init_security.sql` |
| A row pointing at someone else's property | Composite foreign key `(property_id, owner_id)` | `*init_tables.sql` |
| A visitor reading tables | No privileges at all for the `anon` role | `*init_privileges.sql`, `*harden*.sql` |
| Bypassing RLS with TRUNCATE | `TRUNCATE` revoked from client roles | `*harden*.sql` |
| An owner seeing private costs or other properties | Statements are snapshots built from an allow-list (`src/core/sharing.ts`); live tables are never queried by readers | `get_shared_statement()` |
| Guessing a statement link | 32-character random token (192 bits), minimum length checked, revocable | `shares.token` |
| Reading someone's receipts | Private bucket; path must start with the user's id; links are signed and expire after 10 minutes | storage policies |
| Leaking the AI key | The key is a server secret of the edge function; it is never in the app | `supabase/functions/ai` |
| A member link reaching more than it should | `member_load` / `member_save` / `member_delete` check the token, the pages allowed and `can_edit` on every call; they only touch the member's property, never private expenses, never notes, deposit, rules editing, recurring templates, other properties or other members | `*_members.sql` |
| A member editing the books freely | Private scope cannot be set, owner commission cannot be changed, party ids from another property are dropped, invoices can be filed but never deleted | `member_save()` |
| Member files | `member-files` edge function: checks the token and the "invoices" page, signs 10-minute links only for the property's invoices, uploads only with `can_edit`, 10 MB max, images and PDF only | `supabase/functions/member-files` |
| A member link that circulated | 48-character random token (192 bits), shown only to the owner; "Créer un nouveau lien" replaces it at once, "Retirer l'accès" deletes the member | `members.token`, `rotate_member_token()` |
| Runaway AI costs | Daily cap per user, counted server-side in a table the client cannot write | `bump_ai_usage()` |

The app ships only the **publishable** key. It identifies the project and
grants nothing by itself.

## Verified

The policies were tested on the live database with two throw-away users and a
visitor, inside a transaction that was rolled back. Results:

- user B sees 0 of user A's properties, expenses and shares; updates and
  deletes affect 0 rows;
- B cannot attach a row to A's property (foreign key) nor forge `owner_id` (RLS);
- B cannot `TRUNCATE`, nor write the AI usage counter;
- a visitor cannot read any table, cannot delete an account;
- a valid token returns its snapshot; a wrong, short or revoked token returns nothing;
- deleting account B leaves account A intact.

Supabase's security advisor reports only `SECURITY DEFINER` functions, all
intentional: `get_shared_statement`, `member_load`, `member_save` and
`member_delete` (public by design: the token is the key, checked inside),
`bump_ai_usage`, `delete_account` and `rotate_member_token` (signed-in users,
acting on their own rows).

Member links: `supabase/tests/members_security.sql` runs 18 checks as a link
holder (viewer and editor) against two throw-away users and cleans up after
itself. All pass: pages and edit rights hold, private expenses stay invisible
and untouchable, another owner's rows are out of reach, a wrong or short token
returns nothing, `anon` still cannot read any table or rotate a link.

## What a member link shows

One property, live. Depending on the pages the owner ticked: income, expenses
(never private ones), invoices (never those of a private expense), the result
and the yearly report, the cash and contributions. The owner's own party is
shown under the owner's name. Never: notes and deposit, recurring templates,
published statements, other members, other properties, the owner's management
commission on a managed property, the AI assistant.

Anyone holding the link gets these rights. The member's device remembers the
link so the installed app reopens on it; "Fermer ce partage sur cet appareil"
forgets it.

## What a shared statement contains

Property name, period, bookings (dates, nights, platform, amount), property
expenses (date, category, vendor, description, amount), the audience's share,
payments exchanged with them, totals. With "show my management fee" off,
booking amounts are net of the fee and the fee appears nowhere.

Never included: private expenses, general business costs, other properties,
other parties' balances, the manager's earnings.

Anyone holding the link can read the statement. To cut access, withdraw the
link from the property page ("Withdraw every published link").

## Accounts

- Email + password (8 characters minimum), handled by Supabase Auth.
- "Delete my account" in Settings removes the files, then the user and every
  row they own (database cascade). This is required by the App Store.

## Recommended settings in the Supabase dashboard

These cannot be set from code:

1. **Authentication → URL configuration**: set *Site URL* to the web app's
   address and add `<address>/reset` to *Redirect URLs*.
2. **Authentication → Sign in / Providers → Email**: keep "Confirm email" on.
3. **Authentication → Attack protection**: enable leaked-password protection
   if the plan offers it.
4. Once the owner's account exists and no one else should register:
   **Authentication → Sign in / Providers → disable "Allow new users to sign up"**.

## If something goes wrong

- **A link was sent to the wrong person**: withdraw it; publish a new one.
- **The publishable key is abused** (unusual traffic): rotate it in
  *Project settings → API keys*, update `.env`, redeploy.
- **Password forgotten**: "Forgot password" on the sign-in screen.
