-- MsoftAI database schema. Run once in the Supabase SQL editor, then run seed_library.sql.

-- Per-user designs -------------------------------------------------------------
create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists designs_user_idx on public.designs (user_id, updated_at desc);

alter table public.designs enable row level security;

drop policy if exists "designs owner select" on public.designs;
drop policy if exists "designs owner insert" on public.designs;
drop policy if exists "designs owner update" on public.designs;
drop policy if exists "designs owner delete" on public.designs;
create policy "designs owner select" on public.designs for select to authenticated using (auth.uid() = user_id);
create policy "designs owner insert" on public.designs for insert to authenticated with check (auth.uid() = user_id);
create policy "designs owner update" on public.designs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "designs owner delete" on public.designs for delete to authenticated using (auth.uid() = user_id);

-- Cavity library, readable by signed-in users only --------------------------------
create table if not exists public.library_cavities (
  id integer primary key,
  data jsonb not null
);
create table if not exists public.library_footprints (
  id serial primary key,
  data jsonb not null
);

alter table public.library_cavities enable row level security;
alter table public.library_footprints enable row level security;

drop policy if exists "library read" on public.library_cavities;
drop policy if exists "footprints read" on public.library_footprints;
create policy "library read" on public.library_cavities for select to authenticated using (true);
create policy "footprints read" on public.library_footprints for select to authenticated using (true);

-- Data API exposure (needed because "automatically expose new tables" is off).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.designs to authenticated;
grant select on public.library_cavities to authenticated;
grant select on public.library_footprints to authenticated;
