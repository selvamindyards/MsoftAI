-- MsoftAI migration 002: user profiles with admin approval.
-- Run in the Supabase SQL editor after schema.sql.
-- IMPORTANT: replace YOUR_EMAIL at the bottom with your own sign-in email before running.

-- Profiles ------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  approved boolean not null default false,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- Create a profile row automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who signed up before this migration.
insert into public.profiles (user_id, email)
select id, coalesce(email, '') from auth.users
on conflict (user_id) do nothing;

-- Helper predicates (security definer so policies can consult profiles without recursion).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin' and approved);
$$;
create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and approved);
$$;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved() to authenticated;

-- Profile policies: users see their own row, admins see and update everyone.
alter table public.profiles enable row level security;
drop policy if exists "profiles self select" on public.profiles;
drop policy if exists "profiles admin select" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles self select" on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "profiles admin select" on public.profiles for select to authenticated using (public.is_admin());
create policy "profiles admin update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update on public.profiles to authenticated;

-- Library and designs: approved users only ---------------------------------------------
drop policy if exists "library read" on public.library_cavities;
drop policy if exists "footprints read" on public.library_footprints;
create policy "library read" on public.library_cavities for select to authenticated using (public.is_approved());
create policy "footprints read" on public.library_footprints for select to authenticated using (public.is_approved());

drop policy if exists "designs owner select" on public.designs;
drop policy if exists "designs owner insert" on public.designs;
drop policy if exists "designs owner update" on public.designs;
drop policy if exists "designs owner delete" on public.designs;
create policy "designs owner select" on public.designs for select to authenticated using (auth.uid() = user_id and public.is_approved());
create policy "designs owner insert" on public.designs for insert to authenticated with check (auth.uid() = user_id and public.is_approved());
create policy "designs owner update" on public.designs for update to authenticated using (auth.uid() = user_id and public.is_approved()) with check (auth.uid() = user_id and public.is_approved());
create policy "designs owner delete" on public.designs for delete to authenticated using (auth.uid() = user_id and public.is_approved());

-- First administrator ------------------------------------------------------------------
update public.profiles
set role = 'admin', approved = true, approved_at = now()
where email = 'YOUR_EMAIL';
