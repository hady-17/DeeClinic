-- Initial schema. See docs/04-database.md sections 4 and 9.

-- 4.1 Staff and settings
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null default 'owner'
              check (role in ('owner', 'manager', 'staff')),
  created_at  timestamptz not null default now()
);

create table clinic_settings (
  id                 int primary key default 1 check (id = 1),
  name               text not null,
  phone_e164         text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  address            text,
  timezone           text not null default 'Asia/Beirut',
  base_currency      text not null default 'USD' check (base_currency = 'USD'),
  reminder_send_time time not null default '10:00',
  updated_at         timestamptz not null default now()
);

create table exchange_rates (
  id              uuid primary key default gen_random_uuid(),
  lbp_per_usd     numeric(12,2) not null check (lbp_per_usd > 0),
  effective_from  timestamptz not null default now(),
  set_by          uuid references profiles(id),
  created_at      timestamptz not null default now()
);

-- 4.2 Clients and catalog
create table clients (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text not null,
  phone_e164            text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  instagram_handle      text,
  email                 text,
  source                text check (source in ('instagram', 'whatsapp', 'phone', 'walk_in', 'referral', 'other')),
  whatsapp_consent_at   timestamptz,
  whatsapp_opt_out_at   timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create unique index clients_phone_active_idx
  on clients (phone_e164) where deleted_at is null;

create table services (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  category                  text not null
                            check (category in ('skin_care', 'laser_injectables', 'hair_nails', 'waxing_body')),
  duration_minutes          int not null check (duration_minutes between 5 and 480),
  price_usd                 numeric(10,2) not null check (price_usd >= 0),
  follow_up_interval_days   int check (follow_up_interval_days > 0),
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table package_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  service_id      uuid not null references services(id),
  session_count   int not null check (session_count > 1),
  price_usd       numeric(10,2) not null check (price_usd >= 0),
  validity_days   int not null default 180 check (validity_days > 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- 4.3 Packages and appointments
create table client_packages (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id),
  template_id     uuid not null references package_templates(id),
  service_id      uuid not null references services(id),
  sessions_total  int not null check (sessions_total > 0),
  price_usd       numeric(10,2) not null check (price_usd >= 0),
  purchased_at    timestamptz not null default now(),
  expires_at      timestamptz not null,
  status          text not null default 'active'
                  check (status in ('active', 'completed', 'expired', 'cancelled')),
  created_at      timestamptz not null default now()
);

create table appointments (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references clients(id),
  service_id         uuid not null references services(id),
  client_package_id  uuid references client_packages(id),
  start_at           timestamptz not null,
  end_at             timestamptz not null,
  status             text not null default 'scheduled'
                     check (status in ('scheduled', 'confirmed', 'completed', 'no_show', 'cancelled')),
  price_usd          numeric(10,2) not null check (price_usd >= 0),
  notes              text,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (end_at > start_at),
  exclude using gist (tstzrange(start_at, end_at, '[)') with &&)
    where (status in ('scheduled', 'confirmed', 'completed'))
);

create table package_usages (
  id                 uuid primary key default gen_random_uuid(),
  client_package_id  uuid not null references client_packages(id),
  appointment_id     uuid not null unique references appointments(id),
  used_at            timestamptz not null default now()
);

create table visit_notes (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id),
  appointment_id  uuid references appointments(id),
  body            text not null,
  products_used   text,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 4.4 Payments
create table payments (
  id                         uuid primary key default gen_random_uuid(),
  client_id                  uuid not null references clients(id),
  appointment_id             uuid references appointments(id),
  client_package_id          uuid references client_packages(id),
  currency                   text not null check (currency in ('USD', 'LBP')),
  amount                     numeric(16,2) not null check (amount > 0),
  exchange_rate_lbp_per_usd  numeric(12,2),
  amount_usd                 numeric(12,2) not null check (amount_usd >= 0),
  method                     text not null default 'cash' check (method in ('cash', 'card', 'wallet')),
  paid_at                    timestamptz not null default now(),
  recorded_by                uuid references profiles(id),
  voided_at                  timestamptz,
  void_reason                text,
  created_at                 timestamptz not null default now(),
  check (currency = 'USD' or exchange_rate_lbp_per_usd is not null),
  check (num_nonnulls(appointment_id, client_package_id) = 1)
);

-- 4.5 Messages, webhooks, and system tables
create table messages (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references clients(id),
  kind                  text not null
                        check (kind in ('appointment_reminder', 'follow_up', 'package_renewal')),
  reference_id          uuid not null,
  template_name         text not null,
  scheduled_for         timestamptz not null,
  status                text not null default 'pending'
                        check (status in ('pending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  whatsapp_message_id   text unique,
  attempts              int not null default 0,
  last_error            text,
  sent_at               timestamptz,
  created_at            timestamptz not null default now(),
  unique (kind, reference_id)
);

create table webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null default 'whatsapp',
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz
);

create table idempotency_keys (
  key          text not null,
  route        text not null,
  response     jsonb not null,
  status_code  int not null,
  created_at   timestamptz not null default now(),
  primary key (key, route)
);

create table audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references profiles(id),
  action       text not null,
  entity       text not null,
  entity_id    uuid,
  before_data  jsonb,
  after_data   jsonb,
  created_at   timestamptz not null default now()
);

-- 9. Row-level security: enabled everywhere, no policies for anon or authenticated.
-- Only the service role (the API) can read or write.
alter table profiles            enable row level security;
alter table clinic_settings     enable row level security;
alter table exchange_rates      enable row level security;
alter table clients             enable row level security;
alter table services            enable row level security;
alter table package_templates   enable row level security;
alter table client_packages     enable row level security;
alter table appointments        enable row level security;
alter table package_usages      enable row level security;
alter table visit_notes         enable row level security;
alter table payments            enable row level security;
alter table messages            enable row level security;
alter table webhook_events      enable row level security;
alter table idempotency_keys    enable row level security;
alter table audit_logs          enable row level security;
