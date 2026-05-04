create extension if not exists pgcrypto;

create table if not exists public.editor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  display_name text
);

create table if not exists public.menu_availability_overlays (
  id uuid primary key default gen_random_uuid(),
  menu_id text not null,
  section_id text not null,
  group_id text null,
  item_id text not null,
  available_override boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create unique index if not exists menu_availability_overlays_unique_item
  on public.menu_availability_overlays (
    menu_id,
    section_id,
    (coalesce(group_id, '')),
    item_id
  );

alter table public.editor_profiles enable row level security;
alter table public.menu_availability_overlays enable row level security;

drop policy if exists "Editor profiles are readable by their users"
  on public.editor_profiles;
drop policy if exists "Menu availability overlays are publicly readable"
  on public.menu_availability_overlays;
drop policy if exists "Editors can insert menu availability overlays"
  on public.menu_availability_overlays;
drop policy if exists "Editors can update menu availability overlays"
  on public.menu_availability_overlays;
drop policy if exists "Editors can delete menu availability overlays"
  on public.menu_availability_overlays;

create policy "Editor profiles are readable by their users"
  on public.editor_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Menu availability overlays are publicly readable"
  on public.menu_availability_overlays
  for select
  to anon, authenticated
  using (true);

create policy "Editors can insert menu availability overlays"
  on public.menu_availability_overlays
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.editor_profiles
      where user_id = (select auth.uid())
        and active = true
    )
  );

create policy "Editors can update menu availability overlays"
  on public.menu_availability_overlays
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.editor_profiles
      where user_id = (select auth.uid())
        and active = true
    )
  )
  with check (
    exists (
      select 1
      from public.editor_profiles
      where user_id = (select auth.uid())
        and active = true
    )
  );

create policy "Editors can delete menu availability overlays"
  on public.menu_availability_overlays
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.editor_profiles
      where user_id = (select auth.uid())
        and active = true
    )
  );
