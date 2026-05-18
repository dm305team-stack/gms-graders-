-- ============================================================================
-- GMS Graders — AEO Schema
-- Tablas específicas del AEO Visibility Auditor.
-- Requiere shared.sql ejecutado previamente.
-- ============================================================================

create schema if not exists aeo;

-- ---------------------------------------------------------------------------
-- aeo.analyses
-- Cada submission del formulario crea un row aquí.
-- ---------------------------------------------------------------------------
create table if not exists aeo.analyses (
  id              uuid primary key default extensions.uuid_generate_v4(),
  lead_id         uuid not null references shared.leads(id) on delete cascade,

  -- Inputs del formulario
  brand_name      text not null,
  domain          text not null,
  location        text not null,
  specialty       text not null,
  org_type        text not null,
  social          jsonb not null default '{}'::jsonb,

  -- Estado del job
  status          text not null default 'queued'
                    check (status in ('queued','running','completed','failed','cancelled')),
  error_message   text,

  -- Output agregado (después de Etapa D)
  overall_scores  jsonb,   -- {chatgpt: 33, perplexity: 43, gemini: 45, claude: 41}
  synthesis       jsonb,   -- Reporte estructurado completo (arquetipo, narrativas, etc.)
  pdf_url         text,    -- URL del PDF generado en Supabase Storage
  pdf_url_es      text,    -- Versión español si se generó

  -- Timestamps
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

create index if not exists idx_analyses_lead on aeo.analyses (lead_id);
create index if not exists idx_analyses_status on aeo.analyses (status);
create index if not exists idx_analyses_created on aeo.analyses (created_at desc);
create index if not exists idx_analyses_domain on aeo.analyses (domain);

-- ---------------------------------------------------------------------------
-- aeo.queries
-- Las 25-30 queries generadas por Claude Haiku para cada analysis (Etapa A).
-- ---------------------------------------------------------------------------
create table if not exists aeo.queries (
  id           uuid primary key default extensions.uuid_generate_v4(),
  analysis_id  uuid not null references aeo.analyses(id) on delete cascade,
  query_text   text not null,
  query_type   text not null check (query_type in (
                  'best_in_location',
                  'compare_competitors',
                  'how_to_choose',
                  'specialty_specific',
                  'problem_solution',
                  'price_inquiry',
                  'before_after',
                  'doctor_name_lookup'
                )),
  language     text not null default 'en' check (language in ('en','es')),
  position     int not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_queries_analysis on aeo.queries (analysis_id);
create index if not exists idx_queries_type on aeo.queries (query_type);

-- ---------------------------------------------------------------------------
-- aeo.query_results
-- Respuesta cruda de cada motor a cada query, más extracción estructurada.
-- ---------------------------------------------------------------------------
create table if not exists aeo.query_results (
  id              uuid primary key default extensions.uuid_generate_v4(),
  analysis_id     uuid not null references aeo.analyses(id) on delete cascade,
  query_id        uuid not null references aeo.queries(id) on delete cascade,
  engine          text not null check (engine in ('chatgpt','perplexity','gemini','claude')),
  model_version   text not null,

  -- Respuesta original
  raw_response    text,
  raw_metadata    jsonb,

  -- Extracción estructurada (Etapa C)
  brand_mentioned     boolean,
  mention_position    int,
  mention_context     text check (mention_context in ('positive','neutral','negative','comparative')),
  sentiment_score     numeric(4,3) check (sentiment_score between -1 and 1),
  is_recommended      boolean,
  competitors         jsonb,   -- [{name, position}]
  sources             jsonb,   -- [{url, type, authority_estimate}]
  topics              jsonb,   -- [string]
  comparison_attrs    jsonb,   -- [string]

  -- Timestamps + costs
  tokens_input        int,
  tokens_output       int,
  cost_usd            numeric(8,5),
  created_at          timestamptz not null default now()
);

create index if not exists idx_query_results_analysis on aeo.query_results (analysis_id);
create index if not exists idx_query_results_query on aeo.query_results (query_id);
create index if not exists idx_query_results_engine on aeo.query_results (engine);
create index if not exists idx_query_results_mentioned on aeo.query_results (brand_mentioned)
  where brand_mentioned = true;

-- ---------------------------------------------------------------------------
-- aeo.competitors_seen
-- Vista agregada de competidores detectados, útil para Share of Voice.
-- ---------------------------------------------------------------------------
create table if not exists aeo.competitors_seen (
  id            uuid primary key default extensions.uuid_generate_v4(),
  analysis_id   uuid not null references aeo.analyses(id) on delete cascade,
  engine        text not null check (engine in ('chatgpt','perplexity','gemini','claude')),
  competitor    text not null,
  mention_count int not null default 1,
  share_pct     numeric(5,2),
  created_at    timestamptz not null default now()
);

create index if not exists idx_competitors_analysis on aeo.competitors_seen (analysis_id);
create unique index if not exists uniq_competitors_per_engine
  on aeo.competitors_seen (analysis_id, engine, lower(competitor));

-- ---------------------------------------------------------------------------
-- aeo.sources_cited
-- Fuentes citadas por los motores (importante para Quality of Presence).
-- ---------------------------------------------------------------------------
create table if not exists aeo.sources_cited (
  id              uuid primary key default extensions.uuid_generate_v4(),
  analysis_id     uuid not null references aeo.analyses(id) on delete cascade,
  engine          text not null check (engine in ('chatgpt','perplexity','gemini','claude')),
  source_url      text not null,
  source_domain   text,
  source_type     text,   -- 'directory','review','official','social','news','blog','other'
  authority_score int check (authority_score between 0 and 100),
  cited_count     int not null default 1,
  created_at      timestamptz not null default now()
);

create index if not exists idx_sources_analysis on aeo.sources_cited (analysis_id);
create index if not exists idx_sources_domain on aeo.sources_cited (source_domain);

-- ---------------------------------------------------------------------------
-- aeo.query_cache
-- Cache de queries genéricas por (specialty + location) para abaratar runs
-- repetidos del mismo nicho. TTL de 7 días.
-- ---------------------------------------------------------------------------
create table if not exists aeo.query_cache (
  cache_key      text primary key,   -- hash(specialty + location + lang)
  queries        jsonb not null,     -- Array de queries generadas
  hit_count      int not null default 0,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '7 days')
);

create index if not exists idx_query_cache_expires on aeo.query_cache (expires_at);

-- ---------------------------------------------------------------------------
-- aeo.job_queue
-- Cola simple de jobs para procesar analyses asincrónicamente.
-- ---------------------------------------------------------------------------
create table if not exists aeo.job_queue (
  id              uuid primary key default extensions.uuid_generate_v4(),
  analysis_id     uuid not null references aeo.analyses(id) on delete cascade,
  stage           text not null check (stage in (
                    'generate_queries',
                    'run_engines',
                    'parse_responses',
                    'synthesize',
                    'generate_pdf',
                    'send_email'
                  )),
  status          text not null default 'pending'
                    check (status in ('pending','processing','done','failed')),
  attempts        int not null default 0,
  last_error      text,
  scheduled_for   timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_job_queue_status on aeo.job_queue (status, scheduled_for)
  where status in ('pending','processing');
create index if not exists idx_job_queue_analysis on aeo.job_queue (analysis_id);

-- ---------------------------------------------------------------------------
-- RLS — todo cerrado, edge functions usan service_role.
-- ---------------------------------------------------------------------------
alter table aeo.analyses enable row level security;
alter table aeo.queries enable row level security;
alter table aeo.query_results enable row level security;
alter table aeo.competitors_seen enable row level security;
alter table aeo.sources_cited enable row level security;
alter table aeo.query_cache enable row level security;
alter table aeo.job_queue enable row level security;

-- (Sin policies => solo service_role)

-- ---------------------------------------------------------------------------
-- Views útiles
-- ---------------------------------------------------------------------------

-- Resumen rápido por análisis
create or replace view aeo.analysis_summary as
select
  a.id,
  a.brand_name,
  a.domain,
  a.location,
  a.specialty,
  a.status,
  a.overall_scores,
  l.email,
  l.full_name,
  count(distinct q.id) as total_queries,
  count(distinct qr.id) filter (where qr.brand_mentioned = true) as mentions_total,
  a.created_at,
  a.completed_at
from aeo.analyses a
join shared.leads l on l.id = a.lead_id
left join aeo.queries q on q.analysis_id = a.id
left join aeo.query_results qr on qr.analysis_id = a.id
group by a.id, l.email, l.full_name;
