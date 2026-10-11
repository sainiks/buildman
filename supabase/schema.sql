-- Buildman's own database. Run this once in the SQL editor of the Supabase project
-- you create for Buildman itself (not the projects Buildman deploys for users).
--
-- Row level security is ON with no policies: the browser can never read these
-- tables. Only the server (service-role key) touches them.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  github_id     bigint not null unique,
  login         text not null,
  name          text,
  email         text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

-- One row per (user, provider). Tokens are AES-256-GCM encrypted by the app
-- before they are written; the database never sees them in plain text.
create table if not exists public.connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  provider          text not null,
  account_label     text not null,
  account_id        text,
  access_token_enc  text not null,
  refresh_token_enc text,
  expires_at        timestamptz,
  meta              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  name                text not null,
  -- Public identifier embedded in the tracking snippet. Not a secret.
  public_key          text not null unique,
  framework           text,
  status              text not null default 'creating'
                        check (status in ('creating', 'building', 'live', 'failed')),
  repo_full_name      text,
  repo_url            text,
  repo_id             bigint,
  branch              text,
  vercel_project_id   text,
  vercel_project_name text,
  live_url            text,
  host                text not null default 'vercel' check (host in ('vercel', 'netlify')),
  netlify_site_id     text,
  netlify_site_name   text,
  supabase_ref        text,
  snippet_installed   boolean not null default false,
  created_at          timestamptz not null default now(),
  last_deployed_at    timestamptz
);
create index if not exists projects_user_idx on public.projects (user_id, created_at desc);

create table if not exists public.events (
  id         bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  ts         timestamptz not null default now(),
  type       text not null check (type in ('pageview', 'event')),
  name       text,
  path       text,
  referrer   text,
  country    text,
  device     text,
  -- Daily-rotating hash of ip + user agent. No cookies, no stored IPs.
  visitor    text not null
);
create index if not exists events_project_ts_idx on public.events (project_id, ts desc);

alter table public.users       enable row level security;
alter table public.connections enable row level security;
alter table public.projects    enable row level security;
alter table public.events      enable row level security;

-- Only the server (service_role) touches these tables. Granted explicitly so this works even when
-- "Automatically expose new tables" is turned off for the project. anon/authenticated get nothing.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.users, public.connections, public.projects, public.events to service_role;

-- ---------------------------------------------------------------------------
-- Dashboard aggregates. Days are UTC. A "visitor" is a distinct daily hash, so a
-- person who returns on another day counts once per day.
-- ---------------------------------------------------------------------------

create or replace function public.project_stats(p_project uuid, p_days int)
returns jsonb
language plpgsql
stable
as $$
declare
  d          int         := greatest(1, least(coalesce(p_days, 30), 365));
  today      timestamp   := date_trunc('day', now() at time zone 'utc');
  since      timestamptz := (today - (d - 1) * interval '1 day') at time zone 'utc';
  prev_since timestamptz := (today - (2 * d - 1) * interval '1 day') at time zone 'utc';
  result     jsonb;
begin
  with cur as (
    select * from public.events where project_id = p_project and ts >= since
  ),
  prev as (
    select * from public.events where project_id = p_project and ts >= prev_since and ts < since
  ),
  days as (
    select gs::date as day
    from generate_series(today - (d - 1) * interval '1 day', today, interval '1 day') gs
  ),
  daily as (
    select dy.day,
           count(c.id) filter (where c.type = 'pageview')              as pageviews,
           count(distinct c.visitor) filter (where c.type = 'pageview') as visitors,
           count(c.id) filter (where c.type = 'event')                  as events
    from days dy
    left join cur c on (c.ts at time zone 'utc')::date = dy.day
    group by dy.day
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'pageviews',      (select count(*) from cur  where type = 'pageview'),
      'visitors',       (select count(distinct visitor) from cur where type = 'pageview'),
      'events',         (select count(*) from cur  where type = 'event'),
      'prev_pageviews', (select count(*) from prev where type = 'pageview'),
      'prev_visitors',  (select count(distinct visitor) from prev where type = 'pageview'),
      'prev_events',    (select count(*) from prev where type = 'event')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', day, 'pageviews', pageviews, 'visitors', visitors, 'events', events
      ) order by day), '[]'::jsonb) from daily
    ),
    'pages', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.views desc, x.name), '[]'::jsonb) from (
        select path as name, count(*) as views, count(distinct visitor) as visitors
        from cur where type = 'pageview' and path is not null
        group by path order by count(*) desc, path limit 8
      ) x
    ),
    'referrers', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.visitors desc, x.name), '[]'::jsonb) from (
        select coalesce(referrer, 'Direct') as name, count(distinct visitor) as visitors
        from cur where type = 'pageview'
        group by coalesce(referrer, 'Direct') order by count(distinct visitor) desc, 1 limit 8
      ) x
    ),
    'countries', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.visitors desc, x.name), '[]'::jsonb) from (
        select country as name, count(distinct visitor) as visitors
        from cur where type = 'pageview' and country is not null
        group by country order by count(distinct visitor) desc, country limit 8
      ) x
    ),
    'devices', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.visitors desc, x.name), '[]'::jsonb) from (
        select coalesce(device, 'unknown') as name, count(distinct visitor) as visitors
        from cur where type = 'pageview'
        group by coalesce(device, 'unknown') order by count(distinct visitor) desc, 1 limit 5
      ) x
    ),
    'events', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.count desc, x.name), '[]'::jsonb) from (
        select name, count(*) as count
        from cur where type = 'event' and name is not null
        group by name order by count(*) desc, name limit 8
      ) x
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.user_overview(p_user uuid, p_days int)
returns jsonb
language plpgsql
stable
as $$
declare
  d          int         := greatest(1, least(coalesce(p_days, 30), 365));
  today      timestamp   := date_trunc('day', now() at time zone 'utc');
  since      timestamptz := (today - (d - 1) * interval '1 day') at time zone 'utc';
  prev_since timestamptz := (today - (2 * d - 1) * interval '1 day') at time zone 'utc';
  result     jsonb;
begin
  with mine as (
    select id from public.projects where user_id = p_user
  ),
  cur as (
    select e.* from public.events e join mine m on m.id = e.project_id where e.ts >= since
  ),
  prev as (
    select e.* from public.events e join mine m on m.id = e.project_id
    where e.ts >= prev_since and e.ts < since
  ),
  days as (
    select gs::date as day
    from generate_series(today - (d - 1) * interval '1 day', today, interval '1 day') gs
  ),
  daily as (
    select dy.day,
           count(c.id) filter (where c.type = 'pageview')              as pageviews,
           count(distinct c.visitor) filter (where c.type = 'pageview') as visitors,
           count(c.id) filter (where c.type = 'event')                  as events
    from days dy
    left join cur c on (c.ts at time zone 'utc')::date = dy.day
    group by dy.day
  ),
  spark as (
    select m.id as project_id, dy.day,
           count(c.id) filter (where c.type = 'pageview') as pv
    from mine m
    cross join days dy
    left join cur c on c.project_id = m.id and (c.ts at time zone 'utc')::date = dy.day
    group by m.id, dy.day
  ),
  per_project as (
    select m.id,
      (select count(*) from cur where project_id = m.id and type = 'pageview')                 as pageviews,
      (select count(distinct visitor) from cur where project_id = m.id and type = 'pageview')  as visitors,
      (select count(*) from cur where project_id = m.id and type = 'event')                    as events,
      (select count(*) from prev where project_id = m.id and type = 'pageview')                as prev_pageviews,
      (select coalesce(jsonb_agg(s.pv order by s.day), '[]'::jsonb) from spark s where s.project_id = m.id) as spark
    from mine m
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'pageviews',      (select count(*) from cur  where type = 'pageview'),
      'visitors',       (select count(distinct visitor) from cur where type = 'pageview'),
      'events',         (select count(*) from cur  where type = 'event'),
      'prev_pageviews', (select count(*) from prev where type = 'pageview'),
      'prev_visitors',  (select count(distinct visitor) from prev where type = 'pageview'),
      'prev_events',    (select count(*) from prev where type = 'event')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', day, 'pageviews', pageviews, 'visitors', visitors, 'events', events
      ) order by day), '[]'::jsonb) from daily
    ),
    'projects', (
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from per_project p
    )
  ) into result;

  return result;
end;
$$;

-- Only the server (service role) may call the aggregates.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.project_stats(uuid, int) from public, anon, authenticated;
    revoke all on function public.user_overview(uuid, int) from public, anon, authenticated;
    grant execute on function public.project_stats(uuid, int) to service_role;
    grant execute on function public.user_overview(uuid, int) to service_role;
  end if;
end $$;
