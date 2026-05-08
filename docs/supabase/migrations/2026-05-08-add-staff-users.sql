begin;

create extension if not exists pgcrypto;

create table if not exists public.editor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  display_name text
);

create table if not exists public.staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) > 0),
  role text not null check (role in ('availability_editor', 'menu_editor', 'admin')),
  profile_id text null references menu_content.menu_profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_users_profile_id_valid
    check (profile_id is null or profile_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

insert into public.staff_users (
  user_id,
  display_name,
  role,
  profile_id,
  active
)
select
  editor.user_id,
  coalesce(nullif(btrim(editor.display_name), ''), 'Editor'),
  'availability_editor',
  null,
  editor.active
from public.editor_profiles editor
on conflict (user_id) do nothing;

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

create or replace function public.set_staff_users_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_staff_users_updated_at on public.staff_users;

create trigger set_staff_users_updated_at
before update on public.staff_users
for each row
execute function public.set_staff_users_updated_at();

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff_users staff
    where staff.user_id = (select auth.uid())
      and staff.active = true
  );
$$;

create or replace function public.can_edit_availability(target_profile_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select $1 is not null
    and exists (
      select 1
      from public.staff_users staff
      where staff.user_id = (select auth.uid())
        and staff.active = true
        and staff.role in ('availability_editor', 'admin')
        and (
          staff.role = 'admin'
          or staff.profile_id is null
          or staff.profile_id = $1
        )
    );
$$;

create or replace function public.can_manage_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff_users staff
    where staff.user_id = (select auth.uid())
      and staff.active = true
      and staff.role = 'admin'
  );
$$;

create or replace function public.can_publish_menu()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff_users staff
    where staff.user_id = (select auth.uid())
      and staff.active = true
      and staff.role in ('menu_editor', 'admin')
  );
$$;

revoke all on public.staff_users from anon, authenticated;
grant select, insert, update on public.staff_users to authenticated;

revoke all on public.menu_availability_overlays from anon, authenticated;
grant select on public.menu_availability_overlays to anon, authenticated;
grant insert, update, delete on public.menu_availability_overlays to authenticated;

revoke all on function public.is_active_staff() from public, anon, authenticated;
revoke all on function public.can_edit_availability(text) from public, anon, authenticated;
revoke all on function public.can_manage_staff() from public, anon, authenticated;
revoke all on function public.can_publish_menu() from public, anon, authenticated;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.can_edit_availability(text) to authenticated;
grant execute on function public.can_manage_staff() to authenticated;
grant execute on function public.can_publish_menu() to authenticated;

alter table public.editor_profiles enable row level security;
alter table public.staff_users enable row level security;
alter table public.menu_availability_overlays enable row level security;

drop policy if exists "Editor profiles are readable by their users"
  on public.editor_profiles;
drop policy if exists "Staff users can read own active profile"
  on public.staff_users;
drop policy if exists "Admins can read staff users"
  on public.staff_users;
drop policy if exists "Admins can insert staff users"
  on public.staff_users;
drop policy if exists "Admins can update staff users"
  on public.staff_users;
drop policy if exists "Admins can delete staff users"
  on public.staff_users;
drop policy if exists "Menu availability overlays are publicly readable"
  on public.menu_availability_overlays;
drop policy if exists "Editors can insert menu availability overlays"
  on public.menu_availability_overlays;
drop policy if exists "Editors can update menu availability overlays"
  on public.menu_availability_overlays;
drop policy if exists "Editors can delete menu availability overlays"
  on public.menu_availability_overlays;
drop policy if exists "Staff can insert menu availability overlays"
  on public.menu_availability_overlays;
drop policy if exists "Staff can update menu availability overlays"
  on public.menu_availability_overlays;
drop policy if exists "Staff can delete menu availability overlays"
  on public.menu_availability_overlays;

create policy "Editor profiles are readable by their users"
  on public.editor_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Staff users can read own active profile"
  on public.staff_users
  for select
  to authenticated
  using ((select auth.uid()) = user_id and active = true);

create policy "Admins can read staff users"
  on public.staff_users
  for select
  to authenticated
  using (public.can_manage_staff());

create policy "Admins can insert staff users"
  on public.staff_users
  for insert
  to authenticated
  with check (public.can_manage_staff());

create policy "Admins can update staff users"
  on public.staff_users
  for update
  to authenticated
  using (public.can_manage_staff())
  with check (public.can_manage_staff());

create policy "Menu availability overlays are publicly readable"
  on public.menu_availability_overlays
  for select
  to anon, authenticated
  using (true);

create policy "Staff can insert menu availability overlays"
  on public.menu_availability_overlays
  for insert
  to authenticated
  with check (public.can_edit_availability(menu_id));

create policy "Staff can update menu availability overlays"
  on public.menu_availability_overlays
  for update
  to authenticated
  using (public.can_edit_availability(menu_id))
  with check (public.can_edit_availability(menu_id));

create policy "Staff can delete menu availability overlays"
  on public.menu_availability_overlays
  for delete
  to authenticated
  using (public.can_edit_availability(menu_id));

commit;
