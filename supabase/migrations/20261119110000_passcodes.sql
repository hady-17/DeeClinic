-- A short passcode that owners and managers enter to approve sensitive actions
-- (first use: voiding a payment). Stored only as a salted, peppered hash.
create table passcodes (
  user_id     uuid primary key references profiles(id) on delete cascade,
  hash        text not null,
  updated_at  timestamptz not null default now()
);

alter table passcodes enable row level security;
create policy deny_all on public.passcodes for all to anon, authenticated using (false) with check (false);
