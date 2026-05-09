begin;

revoke execute on function public.set_staff_users_updated_at() from public;
revoke execute on function public.set_staff_users_updated_at() from anon;
revoke execute on function public.set_staff_users_updated_at() from authenticated;

commit;
