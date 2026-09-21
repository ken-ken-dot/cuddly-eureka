-- VUGA auth + sync schema (plain PostgreSQL, per build brief Section 3).
-- Idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING) so it can be re-run safely.
-- DATABASE_URL is the only credential; gen_random_uuid() needs PG13+ (Neon is 15+).

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked boolean default false,
  created_at timestamptz default now()
);

create table if not exists corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  -- Client-local id (AsyncStorage record id) for idempotent sync; nullable so
  -- rows from other sources don't need one.
  local_id text,
  wrong text not null,
  "right" text not null, -- quoted: RIGHT is a SQL keyword (RIGHT JOIN)
  tip text not null,
  language_pair text not null,
  created_at timestamptz default now()
);

create table if not exists user_settings (
  user_id uuid references users(id) on delete cascade primary key,
  theme text default 'dark',
  language_pair text default 'rw-zh',
  updated_at timestamptz default now()
);

create table if not exists auth_rate_limits (
  -- e.g. "login:<normalized email>" — basic brute-force throttle (hardening §2).
  key text primary key,
  failed_count integer not null default 0,
  window_start timestamptz not null default now()
);

-- --- Adaptive practice (brief Sections 3-4) ---------------------------------
-- SM-2 scheduling state on corrections: additive columns with defaults, so
-- every existing query against corrections keeps working unchanged.
alter table corrections
  add column if not exists ease_factor numeric default 2.5,
  add column if not exists interval_days integer default 1,
  add column if not exists next_review_at timestamptz default now(),
  add column if not exists review_count integer default 0;

-- One row per review answer; the audit trail behind ease/interval updates.
create table if not exists practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  correction_id uuid references corrections(id) on delete cascade not null,
  was_correct boolean not null,
  reviewed_at timestamptz default now()
);

create index if not exists practice_sessions_user_reviewed_idx on practice_sessions (user_id, reviewed_at);

create index if not exists refresh_tokens_user_id_idx on refresh_tokens (user_id);
create index if not exists corrections_user_id_idx on corrections (user_id);

-- Sync idempotency: a device uploading the same local correction twice (retry,
-- offline queue) must not create duplicates. Partial unique index on the
-- client-local id, scoped per user.
create unique index if not exists corrections_user_local_id_idx
  on corrections (user_id, local_id) where local_id is not null;

-- THE ENFORCEMENT RULE (brief Section 4): there is no RLS, so the app is the
-- enforcement layer. Every query touching corrections or user_settings MUST
-- carry `where user_id = $1`, with $1 coming only from a verified JWT
-- (req.userId) — never from a client-supplied request field.
