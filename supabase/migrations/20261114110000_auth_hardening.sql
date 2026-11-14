-- Auth and authorization support. See docs/03-architecture.md sections 5.5 and 7.

-- Profiles: a copy of the email for listing users, and an active flag for deactivation.
alter table profiles
  add column email          text,
  add column is_active      boolean not null default true,
  add column deactivated_at timestamptz;

create unique index profiles_email_idx on profiles (lower(email)) where email is not null;

-- Counters for rate limiting. Fixed windows, one row per key and window.
create table rate_limits (
  key           text        not null,
  window_start  timestamptz not null,
  hits          int         not null default 0,
  primary key (key, window_start)
);

alter table rate_limits enable row level security;
create policy deny_all on public.rate_limits for all to anon, authenticated using (false) with check (false);

-- Atomically counts one hit and returns the total for the current window.
create or replace function rate_limit_hit(p_key text, p_window_seconds int)
returns int
language plpgsql
set search_path = public
as $$
declare
  w     timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  total int;
begin
  insert into rate_limits (key, window_start, hits)
  values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into total;

  -- Occasional cleanup so the table stays small
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return total;
end;
$$;

revoke execute on function rate_limit_hit(text, int) from public, anon, authenticated;

-- The clinic must always keep at least one active owner.
create or replace function protect_last_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  other_owners boolean;
begin
  if old.role = 'owner' and old.is_active then
    select exists (
      select 1 from profiles where role = 'owner' and is_active and id <> old.id
    ) into other_owners;

    if not other_owners then
      if tg_op = 'DELETE' then
        raise exception 'LAST_OWNER';
      elsif new.role <> 'owner' or not new.is_active then
        raise exception 'LAST_OWNER';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_last_owner
  before update or delete on profiles
  for each row execute function protect_last_owner();
