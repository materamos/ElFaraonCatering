do $$
begin
  if not exists (
    select 1
    from pg_roles
    where rolname = 'menu_build_ci'
  ) then
    create role menu_build_ci
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      noreplication
      nobypassrls
      connection limit 3;
  end if;
end
$$;

alter role menu_build_ci
  nologin
  noinherit
  connection limit 3;

revoke all privileges on database postgres from menu_build_ci;
grant connect on database postgres to menu_build_ci;

revoke all on schema menu_content from menu_build_ci;
grant usage on schema menu_content to menu_build_ci;

revoke all on all tables in schema menu_content from menu_build_ci;
grant select on table
  menu_content.menu_profiles,
  menu_content.menu_profile_facts,
  menu_content.menu_prices,
  menu_content.menu_price_variants,
  menu_content.menu_daily_items,
  menu_content.menu_profile_service_settings,
  menu_content.menu_catalog_sections,
  menu_content.menu_catalog_items,
  menu_content.menu_catalog_item_images,
  menu_content.menu_catalog_item_options,
  menu_content.menu_grill_families,
  menu_content.menu_grill_catalog_items
to menu_build_ci;

revoke all on schema public from menu_build_ci;
grant usage on schema public to menu_build_ci;
revoke all on table public.menu_availability_overlays from menu_build_ci;
grant select (menu_id, section_id, item_id)
  on table public.menu_availability_overlays
  to menu_build_ci;
revoke all on table public.staff_users from menu_build_ci;

revoke all on schema app_private from menu_build_ci;
grant usage on schema app_private to menu_build_ci;
revoke all on all tables in schema app_private from menu_build_ci;
revoke all on all functions in schema app_private from menu_build_ci;
grant execute on function app_private.get_menu_publication_content_hash()
  to menu_build_ci;

do $$
begin
  if (
    select
      rolsuper
      or rolcreatedb
      or rolcreaterole
      or rolinherit
      or rolreplication
      or rolbypassrls
    from pg_roles
    where rolname = 'menu_build_ci'
  ) then
    raise exception 'menu_build_ci has an unexpected role capability';
  end if;

  if not has_table_privilege(
    'menu_build_ci',
    'menu_content.menu_profiles',
    'select'
  ) then
    raise exception 'menu_build_ci is missing build-time menu access';
  end if;

  if has_table_privilege(
    'menu_build_ci',
    'public.staff_users',
    'select'
  ) then
    raise exception 'menu_build_ci must not read staff_users';
  end if;

  if not has_function_privilege(
    'menu_build_ci',
    'app_private.get_menu_publication_content_hash()',
    'execute'
  ) then
    raise exception 'menu_build_ci is missing publication hash access';
  end if;
end
$$;
