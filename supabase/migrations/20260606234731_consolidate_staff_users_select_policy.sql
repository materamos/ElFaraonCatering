begin;

drop policy if exists "Staff users can read own active profile"
  on public.staff_users;

drop policy if exists "Admins can read staff users"
  on public.staff_users;

create policy "Staff users can read permitted rows"
  on public.staff_users
  for select
  to authenticated
  using (
    ((select auth.uid()) = user_id and active = true)
    or public.can_manage_staff()
  );

commit;
