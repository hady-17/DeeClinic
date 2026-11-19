-- Phase 2: packages, payments and the no-show rule. See docs/04-database.md.

-- The owner decides whether a no-show on a package visit uses up a session.
alter table clinic_settings
  add column no_show_uses_session boolean not null default false;

-- Lookups by package and by what a payment was for
create index appointments_package_idx on appointments (client_package_id) where client_package_id is not null;
create index payments_appointment_idx on payments (appointment_id) where appointment_id is not null;
create index payments_package_idx     on payments (client_package_id) where client_package_id is not null;

-- ---------------------------------------------------------------------------
-- complete_appointment: as before, and the package is closed when its last
-- session is used.
-- ---------------------------------------------------------------------------
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
    -- Lock the package so two visits can't consume the last session together
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

    if remaining = 1 then
      update client_packages set status = 'completed' where id = appt.client_package_id;
    end if;
  end if;

  update appointments
     set status = 'completed', updated_at = now()
   where id = p_appointment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_no_show: a no-show frees the slot. If the clinic's rule says a no-show
-- uses a session, one is taken from the package (when any are left).
-- ---------------------------------------------------------------------------
create or replace function mark_no_show(p_appointment_id uuid, p_consume_session boolean)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  appt      record;
  remaining int;
  consumed  boolean := false;
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

  if p_consume_session and appt.client_package_id is not null then
    perform 1 from client_packages where id = appt.client_package_id for update;

    select cp.sessions_total - count(pu.id)
      into remaining
      from client_packages cp
      left join package_usages pu on pu.client_package_id = cp.id
     where cp.id = appt.client_package_id
       and cp.status = 'active'
     group by cp.sessions_total;

    -- Never blocks marking the no-show; it only takes a session if one is left
    if remaining is not null and remaining > 0 then
      insert into package_usages (client_package_id, appointment_id)
      values (appt.client_package_id, p_appointment_id);
      consumed := true;
      if remaining = 1 then
        update client_packages set status = 'completed' where id = appt.client_package_id;
      end if;
    end if;
  end if;

  update appointments
     set status = 'no_show', updated_at = now()
   where id = p_appointment_id;

  return consumed;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_payment: locks what is being paid for, refuses to take more than is
-- due (a small tolerance covers LBP rounding), and writes the payment.
-- ---------------------------------------------------------------------------
create or replace function record_payment(
  p_appointment_id    uuid,
  p_client_package_id uuid,
  p_currency          text,
  p_amount            numeric,
  p_rate              numeric,
  p_amount_usd        numeric,
  p_method            text,
  p_recorded_by       uuid,
  p_tolerance         numeric default 0.05
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_client uuid;
  v_due    numeric;
  v_status text;
  v_paid   numeric;
  v_id     uuid;
begin
  if num_nonnulls(p_appointment_id, p_client_package_id) <> 1 then
    raise exception 'PAYMENT_TARGET';
  end if;

  if p_appointment_id is not null then
    select client_id, price_usd, status into v_client, v_due, v_status
      from appointments where id = p_appointment_id for update;
  else
    select client_id, price_usd, status into v_client, v_due, v_status
      from client_packages where id = p_client_package_id for update;
  end if;

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if v_status = 'cancelled' then
    raise exception 'TARGET_CANCELLED';
  end if;

  select coalesce(sum(amount_usd), 0) into v_paid
    from payments
   where voided_at is null
     and ((p_appointment_id is not null and appointment_id = p_appointment_id)
       or (p_client_package_id is not null and client_package_id = p_client_package_id));

  if v_paid + p_amount_usd > v_due + p_tolerance then
    raise exception 'OVERPAYMENT: due %, already paid %', v_due, v_paid;
  end if;

  insert into payments (
    client_id, appointment_id, client_package_id, currency, amount,
    exchange_rate_lbp_per_usd, amount_usd, method, recorded_by
  ) values (
    v_client, p_appointment_id, p_client_package_id, p_currency, p_amount,
    case when p_currency = 'LBP' then p_rate end, p_amount_usd, p_method, p_recorded_by
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- sell_package: copies the template's terms into a new package and, if the
-- client pays now, records that payment, all in one transaction.
-- ---------------------------------------------------------------------------
create or replace function sell_package(
  p_client_id      uuid,
  p_template_id    uuid,
  p_recorded_by    uuid,
  p_pay_currency   text    default null,
  p_pay_amount     numeric default null,
  p_pay_rate       numeric default null,
  p_pay_amount_usd numeric default null,
  p_pay_method     text    default 'cash',
  p_tolerance      numeric default 0.05
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  t      record;
  v_tz   text;
  v_id   uuid;
begin
  perform 1 from clients where id = p_client_id and deleted_at is null;
  if not found then
    raise exception 'CLIENT_NOT_FOUND';
  end if;

  select id, service_id, session_count, price_usd, validity_days, is_active
    into t
    from package_templates
   where id = p_template_id
   for share;
  if not found then
    raise exception 'TEMPLATE_NOT_FOUND';
  end if;
  if not t.is_active then
    raise exception 'TEMPLATE_INACTIVE';
  end if;

  select coalesce((select timezone from clinic_settings where id = 1), 'Asia/Beirut') into v_tz;

  -- Valid through the whole last day, in the clinic's timezone
  insert into client_packages (client_id, template_id, service_id, sessions_total, price_usd, expires_at)
  values (
    p_client_id, t.id, t.service_id, t.session_count, t.price_usd,
    (((now() at time zone v_tz)::date + t.validity_days + 1)::timestamp at time zone v_tz)
  )
  returning id into v_id;

  if p_pay_amount is not null then
    if p_pay_amount_usd > t.price_usd + p_tolerance then
      raise exception 'OVERPAYMENT: due %, already paid 0', t.price_usd;
    end if;
    insert into payments (
      client_id, client_package_id, currency, amount,
      exchange_rate_lbp_per_usd, amount_usd, method, recorded_by
    ) values (
      p_client_id, v_id, p_pay_currency, p_pay_amount,
      case when p_pay_currency = 'LBP' then p_pay_rate end, p_pay_amount_usd, p_pay_method, p_recorded_by
    );
  end if;

  return v_id;
end;
$$;

-- Only the API (service role) may call these, never the browser keys.
revoke execute on function complete_appointment(uuid)                      from public, anon, authenticated;
revoke execute on function mark_no_show(uuid, boolean)                     from public, anon, authenticated;
revoke execute on function record_payment(uuid, uuid, text, numeric, numeric, numeric, text, uuid, numeric) from public, anon, authenticated;
revoke execute on function sell_package(uuid, uuid, uuid, text, numeric, numeric, numeric, text, numeric)   from public, anon, authenticated;
