-- Invoices can stand alone: what they are for, their date, their amount.
alter table public.docs add column title text not null default '' check (length(title) <= 200);
alter table public.docs add column date date;
alter table public.docs add column amount numeric(14,2) check (amount is null or amount >= 0);
