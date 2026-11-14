-- Make the "browser keys get nothing" rule explicit on every table.
-- The service role (the API) bypasses RLS, so it is unaffected.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'clinic_settings', 'exchange_rates', 'clients', 'services',
    'package_templates', 'client_packages', 'appointments', 'package_usages',
    'visit_notes', 'payments', 'messages', 'webhook_events',
    'idempotency_keys', 'audit_logs'
  ]
  loop
    execute format(
      'create policy deny_all on public.%I for all to anon, authenticated using (false) with check (false)',
      t
    );
  end loop;
end
$$;
