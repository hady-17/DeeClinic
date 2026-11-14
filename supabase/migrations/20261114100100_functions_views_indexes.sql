-- Functions, views and indexes. See docs/04-database.md sections 6, 7 and 8.

-- 6.1 Completes a visit and consumes a package session under a row lock.
create or replace function complete_appointment(p_appointment_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  appt       record;
  remaining  int;
begin
  select id, status, client_package_id
    into appt
    from appointments
   where id = p_appointment_id
   for update;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  if appt.status not in ('scheduled', 'confirmed') then
    raise exception 'INVALID_STATUS_TRANSITION: %', appt.status;
  end if;

  if appt.client_package_id is not null then
    perform 1 from client_packages where id = appt.client_package_id for update;

    select cp.sessions_total - count(pu.id)
      into remaining
      from client_packages cp
      left join package_usages pu on pu.client_package_id = cp.id
     where cp.id = appt.client_package_id
       and cp.status = 'active'
       and cp.expires_at > now()
     group by cp.sessions_total;

    if remaining is null or remaining <= 0 then
      raise exception 'NO_SESSIONS_REMAINING';
    end if;

    insert into package_usages (client_package_id, appointment_id)
    values (appt.client_package_id, p_appointment_id);
  end if;

  update appointments
     set status = 'completed', updated_at = now()
   where id = p_appointment_id;
end;
$$;

-- Only the API (service role) may call it, never the browser keys.
revoke execute on function complete_appointment(uuid) from public, anon, authenticated;

-- 7. Sessions remaining on each package
create view client_package_balances
with (security_invoker = true) as
select
  cp.id              as client_package_id,
  cp.client_id,
  cp.sessions_total,
  cp.sessions_total - count(pu.id) as sessions_remaining,
  cp.status,
  cp.expires_at
from client_packages cp
left join package_usages pu on pu.client_package_id = cp.id
group by cp.id;

-- 8. Indexes
create extension if not exists pg_trgm with schema extensions;

create index appointments_start_idx        on appointments (start_at);
create index appointments_client_idx       on appointments (client_id, start_at desc);
create index client_packages_client_idx    on client_packages (client_id, status);
create index payments_client_idx           on payments (client_id, paid_at desc);
create index exchange_rates_effective_idx  on exchange_rates (effective_from desc);
create index clients_name_search_idx       on clients using gin (full_name extensions.gin_trgm_ops);

create index messages_due_idx on messages (scheduled_for) where status = 'pending';
