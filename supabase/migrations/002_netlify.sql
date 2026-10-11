-- Run once in Buildman's own Supabase project (SQL editor) before using Netlify as a host.
-- Safe to run more than once. Existing projects stay on Vercel.
alter table public.projects add column if not exists host text not null default 'vercel';
alter table public.projects add column if not exists netlify_site_id text;
alter table public.projects add column if not exists netlify_site_name text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_host_check') then
    alter table public.projects add constraint projects_host_check check (host in ('vercel', 'netlify'));
  end if;
end $$;
