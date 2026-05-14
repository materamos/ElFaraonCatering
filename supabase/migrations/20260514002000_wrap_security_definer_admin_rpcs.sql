begin;

create schema if not exists app_private;

revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

do $$
declare
  function_signature text;
  public_function regprocedure;
begin
  foreach function_signature in array array[
    'is_active_staff()',
    'can_edit_availability(text)',
    'can_manage_staff()',
    'can_publish_menu()',
    'can_edit_menu_content()',
    'menu_availability_target_exists(text,text,text,text)',
    'set_menu_availability_overlay(text,text,text,text,boolean)',
    'clear_menu_availability_overlay(text,text,text,text)',
    'set_profile_service_kind(text,text)',
    'set_daily_menu(text,text,text,boolean,text,text,text,boolean)',
    'set_global_fixed_price(text,integer)',
    'set_global_price_variant(text,text,integer,boolean)',
    'get_admin_operational_state()'
  ] loop
    public_function := to_regprocedure('public.' || function_signature);

    if public_function is not null
      and to_regprocedure('app_private.' || function_signature) is null then
      execute format('alter function %s set schema app_private', public_function);
    end if;
  end loop;
end $$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.is_active_staff();
$$;

create or replace function public.can_edit_availability(target_profile_id text)
returns boolean
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.can_edit_availability($1);
$$;

create or replace function public.can_manage_staff()
returns boolean
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.can_manage_staff();
$$;

create or replace function public.can_publish_menu()
returns boolean
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.can_publish_menu();
$$;

create or replace function public.can_edit_menu_content()
returns boolean
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.can_edit_menu_content();
$$;

create or replace function public.menu_availability_target_exists(
  target_menu_id text,
  target_section_id text,
  target_group_id text,
  target_item_id text
)
returns boolean
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.menu_availability_target_exists($1, $2, $3, $4);
$$;

create or replace function public.set_menu_availability_overlay(
  menu_id text,
  section_id text,
  group_id text,
  item_id text,
  available_override boolean
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.set_menu_availability_overlay($1, $2, $3, $4, $5);
$$;

create or replace function public.clear_menu_availability_overlay(
  menu_id text,
  section_id text,
  group_id text,
  item_id text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.clear_menu_availability_overlay($1, $2, $3, $4);
$$;

create or replace function public.set_profile_service_kind(
  profile_id text,
  service_kind text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.set_profile_service_kind($1, $2);
$$;

create or replace function public.set_daily_menu(
  regular_name text,
  regular_description text,
  regular_note text,
  regular_available boolean,
  vegetarian_name text,
  vegetarian_description text,
  vegetarian_note text,
  vegetarian_available boolean
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.set_daily_menu($1, $2, $3, $4, $5, $6, $7, $8);
$$;

create or replace function public.set_global_fixed_price(
  pricing_key text,
  amount integer
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.set_global_fixed_price($1, $2);
$$;

create or replace function public.set_global_price_variant(
  pricing_key text,
  variant_id text,
  amount integer,
  available boolean
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.set_global_price_variant($1, $2, $3, $4);
$$;

create or replace function public.get_admin_operational_state()
returns jsonb
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.get_admin_operational_state();
$$;

revoke all on function public.is_active_staff() from public, anon, authenticated;
revoke all on function public.can_edit_availability(text) from public, anon, authenticated;
revoke all on function public.can_manage_staff() from public, anon, authenticated;
revoke all on function public.can_publish_menu() from public, anon, authenticated;
revoke all on function public.can_edit_menu_content() from public, anon, authenticated;
revoke all on function public.menu_availability_target_exists(text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_menu_availability_overlay(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.clear_menu_availability_overlay(text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_profile_service_kind(text, text) from public, anon, authenticated;
revoke all on function public.set_daily_menu(text, text, text, boolean, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.set_global_fixed_price(text, integer) from public, anon, authenticated;
revoke all on function public.set_global_price_variant(text, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.get_admin_operational_state() from public, anon, authenticated;

grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.can_edit_availability(text) to authenticated;
grant execute on function public.can_manage_staff() to authenticated;
grant execute on function public.can_publish_menu() to authenticated;
grant execute on function public.can_edit_menu_content() to authenticated;
grant execute on function public.set_menu_availability_overlay(text, text, text, text, boolean) to authenticated;
grant execute on function public.clear_menu_availability_overlay(text, text, text, text) to authenticated;
grant execute on function public.set_profile_service_kind(text, text) to authenticated;
grant execute on function public.set_daily_menu(text, text, text, boolean, text, text, text, boolean) to authenticated;
grant execute on function public.set_global_fixed_price(text, integer) to authenticated;
grant execute on function public.set_global_price_variant(text, text, integer, boolean) to authenticated;
grant execute on function public.get_admin_operational_state() to authenticated;

revoke all on function app_private.is_active_staff() from public, anon, authenticated;
revoke all on function app_private.can_edit_availability(text) from public, anon, authenticated;
revoke all on function app_private.can_manage_staff() from public, anon, authenticated;
revoke all on function app_private.can_publish_menu() from public, anon, authenticated;
revoke all on function app_private.can_edit_menu_content() from public, anon, authenticated;
revoke all on function app_private.menu_availability_target_exists(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.set_menu_availability_overlay(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function app_private.clear_menu_availability_overlay(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.set_profile_service_kind(text, text) from public, anon, authenticated;
revoke all on function app_private.set_daily_menu(text, text, text, boolean, text, text, text, boolean) from public, anon, authenticated;
revoke all on function app_private.set_global_fixed_price(text, integer) from public, anon, authenticated;
revoke all on function app_private.set_global_price_variant(text, text, integer, boolean) from public, anon, authenticated;
revoke all on function app_private.get_admin_operational_state() from public, anon, authenticated;

grant execute on function app_private.is_active_staff() to authenticated;
grant execute on function app_private.can_edit_availability(text) to authenticated;
grant execute on function app_private.can_manage_staff() to authenticated;
grant execute on function app_private.can_publish_menu() to authenticated;
grant execute on function app_private.can_edit_menu_content() to authenticated;
grant execute on function app_private.set_menu_availability_overlay(text, text, text, text, boolean) to authenticated;
grant execute on function app_private.clear_menu_availability_overlay(text, text, text, text) to authenticated;
grant execute on function app_private.set_profile_service_kind(text, text) to authenticated;
grant execute on function app_private.set_daily_menu(text, text, text, boolean, text, text, text, boolean) to authenticated;
grant execute on function app_private.set_global_fixed_price(text, integer) to authenticated;
grant execute on function app_private.set_global_price_variant(text, text, integer, boolean) to authenticated;
grant execute on function app_private.get_admin_operational_state() to authenticated;

commit;
