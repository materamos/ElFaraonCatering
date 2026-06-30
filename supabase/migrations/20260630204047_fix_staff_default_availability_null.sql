begin;

CREATE OR REPLACE FUNCTION public.get_admin_operational_state()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'app_private', 'pg_temp'
AS $function$
  with base_state as (
    select app_private.get_admin_operational_state()
      || jsonb_build_object(
        'catalog_editor', app_private.get_admin_catalog_editor_state(),
        'grill_editor', app_private.get_admin_grill_editor_state(),
        'publication', app_private.get_menu_publication_state()
      ) as state
  ),
  staff_preference as (
    select staff.default_availability_profile_id
    from public.staff_users staff
    where staff.user_id = (select auth.uid())
      and staff.active = true
  )
  select case
    when base_state.state->'staff' = 'null'::jsonb then base_state.state
    else jsonb_set(
      base_state.state,
      '{staff,default_availability_profile_id}',
      coalesce(to_jsonb(staff_preference.default_availability_profile_id), 'null'::jsonb),
      true
    )
  end
  from base_state
  left join staff_preference on true;
$function$;

revoke all on function public.get_admin_operational_state() from public, anon, authenticated, service_role;
grant execute on function public.get_admin_operational_state() to authenticated;

commit;
