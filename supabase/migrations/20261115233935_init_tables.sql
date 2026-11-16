-- Stayfolio — initial schema.
--
-- Security model, in one sentence: every row belongs to exactly one user
-- (`owner_id`) and row-level security lets a user touch only their own rows.
-- Owners and partners never get database access; they read frozen statements
-- through `get_shared_statement`, which exposes nothing but what was published.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  currency text not null default 'XOF',
  fx jsonb not null default '{"EUR": 655.957}'::jsonb,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  created_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  location text not null default '',
  kind text not null default 'owned' check (kind in ('owned', 'partnership', 'managed')),
  color text not null default 'indigo',
  revenue_basis text not null default 'checkin' check (revenue_basis in ('checkin', 'received')),
  payout_party_id uuid,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  -- Lets child tables reference (id, owner_id), so a row can never point at
  -- a property that belongs to someone else.
  unique (id, owner_id)
);

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  name text not null check (length(name) between 1 and 120),
  is_me boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (property_id, owner_id) references public.properties (id, owner_id) on delete cascade
);

alter table public.properties
  add constraint properties_payout_party_fk
  foreign key (payout_party_id) references public.parties (id) on delete set null;

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  effective_from text not null check (effective_from ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  commission_rate numeric not null default 0 check (commission_rate between 0 and 1),
  -- [{ "party_id": uuid, "revenue": 0..1, "expense": 0..1 }]
  shares jsonb not null default '[]'::jsonb check (jsonb_typeof(shares) = 'array'),
  created_at timestamptz not null default now(),
  unique (property_id, effective_from),
  foreign key (property_id, owner_id) references public.properties (id, owner_id) on delete cascade
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  platform text not null default 'Direct',
  guest text not null default '',
  check_in date not null,
  check_out date check (check_out is null or check_out >= check_in),
  received_on date,
  currency text not null default 'XOF',
  amount numeric not null,
  fx_rate numeric not null default 1 check (fx_rate > 0),
  commission_rate numeric check (commission_rate is null or commission_rate between 0 and 1),
  received_by uuid references public.parties (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (property_id, owner_id) references public.properties (id, owner_id) on delete cascade
);

create table public.recurring (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid,
  category text not null default 'other',
  vendor text not null default '',
  description text not null default '',
  currency text not null default 'XOF',
  amount numeric not null,
  fx_rate numeric not null default 1 check (fx_rate > 0),
  scope text not null default 'property' check (scope in ('property', 'private')),
  paid_by uuid references public.parties (id) on delete set null,
  day int not null default 1 check (day between 1 and 28),
  start_month text not null check (start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  end_month text check (end_month is null or end_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_at timestamptz not null default now(),
  foreign key (property_id, owner_id) references public.properties (id, owner_id) on delete cascade
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid,
  date date not null,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category text not null default 'other',
  vendor text not null default '',
  description text not null default '',
  currency text not null default 'XOF',
  amount numeric not null,
  fx_rate numeric not null default 1 check (fx_rate > 0),
  scope text not null default 'property' check (scope in ('property', 'private')),
  charged_to uuid references public.parties (id) on delete set null,
  paid_by uuid references public.parties (id) on delete set null,
  recurring_id uuid references public.recurring (id) on delete set null,
  excluded boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (property_id, owner_id) references public.properties (id, owner_id) on delete cascade
);

-- A recurring expense produces at most one row per month.
create unique index expenses_one_per_recurring_month
  on public.expenses (recurring_id, month) where recurring_id is not null;

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  date date not null,
  from_party uuid not null references public.parties (id) on delete cascade,
  to_party uuid not null references public.parties (id) on delete cascade,
  amount numeric not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  check (from_party <> to_party),
  foreign key (property_id, owner_id) references public.properties (id, owner_id) on delete cascade
);

create table public.docs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid,
  expense_id uuid references public.expenses (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  path text not null unique,
  name text not null default '',
  mime text not null default '',
  size bigint not null default 0,
  created_at timestamptz not null default now(),
  foreign key (property_id, owner_id) references public.properties (id, owner_id) on delete cascade
);

-- Published statements. `payload` is a frozen snapshot assembled by the app
-- from an allow-list (see src/core/sharing.ts). The token is the only key.
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  party_id uuid not null references public.parties (id) on delete cascade,
  title text not null default '',
  token text not null unique
    default translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
  payload jsonb not null check (pg_column_size(payload) < 1000000),
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (property_id, owner_id) references public.properties (id, owner_id) on delete cascade
);

-- Daily counter that caps AI calls per user (cost control).
create table public.ai_usage (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null default current_date,
  calls int not null default 0,
  primary key (owner_id, day)
);

-- Indexes for the foreign keys and the usual filters.
create index on public.properties (owner_id);
create index on public.parties (property_id, owner_id);
create index on public.parties (owner_id);
create index on public.rules (property_id, owner_id);
create index on public.rules (owner_id);
create index on public.bookings (property_id, owner_id);
create index on public.bookings (owner_id, check_in);
create index on public.bookings (received_by);
create index on public.recurring (property_id, owner_id);
create index on public.recurring (owner_id);
create index on public.recurring (paid_by);
create index on public.expenses (property_id, owner_id);
create index on public.expenses (owner_id, month);
create index on public.expenses (charged_to);
create index on public.expenses (paid_by);
create index on public.transfers (property_id, owner_id);
create index on public.transfers (owner_id);
create index on public.transfers (from_party);
create index on public.transfers (to_party);
create index on public.docs (property_id, owner_id);
create index on public.docs (owner_id);
create index on public.docs (expense_id);
create index on public.docs (booking_id);
create index on public.shares (property_id, owner_id);
create index on public.shares (owner_id);
create index on public.shares (party_id);
create index on public.properties (payout_party_id);
