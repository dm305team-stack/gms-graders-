-- ============================================================================
-- GMS Graders — Shared Schema
-- Tablas comunes a todos los graders: leads, registro de graders, users.
-- Ejecutar antes que los schemas específicos (hipaa.sql, aeo.sql).
-- ============================================================================

create schema if not exists shared;

-- Extensions
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- shared.graders
-- Registro de cada grader activo en el monorepo.
-- ---------------------------------------------------------------------------
create table if not exists shared.graders (
  slug         text primary key,
  name         text not null,
  domain       text,
  description  text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

insert into shared.graders (slug, name, domain, description) values
  ('hipaa', 'HIPAA Privacy Express Auditor', null, 'Forensic HIPAA exposure audit for medical practices'),
  ('aeo',   'AEO Visibility Auditor',        null, 'Multi-engine AI search visibility audit')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- shared.leads
-- Todos los leads capturados por cualquier grader llegan aquí.
-- ---------------------------------------------------------------------------
create table if not exists shared.leads (
  id              uuid primary key default extensions.uuid_generate_v4(),
  source          text not null references shared.graders(slug),
  email           text not null,
  full_name       text not null,
  company         text not null,
  phone           text,
  domain          text,
  org_type        text,
  brand_name      text,
  location        text,
  metadata        jsonb not null default '{}'::jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index if not exists idx_leads_email on shared.leads (lower(email));
create index if not exists idx_leads_source on shared.leads (source);
create index if not exists idx_leads_created on shared.leads (created_at desc);
create index if not exists idx_leads_domain on shared.leads (domain) where domain is not null;

-- ---------------------------------------------------------------------------
-- shared.email_log
-- Histórico de envíos via Resend, para debugging y rate-limiting.
-- ---------------------------------------------------------------------------
create table if not exists shared.email_log (
  id            uuid primary key default extensions.uuid_generate_v4(),
  lead_id       uuid references shared.leads(id) on delete set null,
  source        text not null references shared.graders(slug),
  template      text not null,
  to_email      text not null,
  subject       text,
  resend_id     text,
  status        text not null check (status in ('queued','sent','delivered','bounced','failed','complaint')),
  error_message text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz
);

create index if not exists idx_email_log_lead on shared.email_log (lead_id);
create index if not exists idx_email_log_to on shared.email_log (lower(to_email));
create index if not exists idx_email_log_status on shared.email_log (status);

-- ---------------------------------------------------------------------------
-- RLS — todo cerrado por default; las edge functions usan service_role.
-- ---------------------------------------------------------------------------
alter table shared.leads enable row level security;
alter table shared.email_log enable row level security;
alter table shared.graders enable row level security;

-- Lectura pública del registro de graders (para mostrarlos en una landing si se quiere)
drop policy if exists graders_public_read on shared.graders;
create policy graders_public_read on shared.graders
  for select using (active = true);

-- Sin policies en leads ni email_log => solo service_role accede.
