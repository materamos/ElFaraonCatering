begin;

do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef('app_private.set_daily_menu(text, text, text, text)'::regprocedure)
  into current_definition;

  updated_definition := replace(
    current_definition,
    E'\n      or item.note is not null',
    ''
  );
  updated_definition := replace(
    updated_definition,
    E'\n    note = null,',
    ''
  );

  if current_definition = updated_definition then
    raise exception 'app_private.set_daily_menu did not contain expected note references';
  end if;

  execute updated_definition;

  select pg_get_functiondef('app_private.add_catalog_item(text, text, text, text, text, integer)'::regprocedure)
  into current_definition;

  updated_definition := replace(
    current_definition,
    E'\n    note,\n    image_path,',
    E'\n    image_path,'
  );
  updated_definition := replace(
    updated_definition,
    E'\n    target_description,\n    null,\n    null,\n    true,',
    E'\n    target_description,\n    null,\n    true,'
  );

  if current_definition = updated_definition then
    raise exception 'app_private.add_catalog_item did not contain expected note references';
  end if;

  execute updated_definition;

  select pg_get_functiondef('app_private.get_admin_operational_state()'::regprocedure)
  into current_definition;

  updated_definition := replace(
    current_definition,
    E'\n          ''note'', item.note,',
    ''
  );

  if current_definition = updated_definition then
    raise exception 'app_private.get_admin_operational_state did not contain expected note references';
  end if;

  execute updated_definition;
end;
$$;

alter table menu_content.menu_daily_items
  drop column if exists note;

alter table menu_content.menu_catalog_sections
  drop column if exists note;

alter table menu_content.menu_catalog_groups
  drop column if exists note;

alter table menu_content.menu_catalog_items
  drop column if exists note;

alter table menu_content.menu_catalog_item_options
  drop column if exists note;

alter table menu_content.menu_grill_catalog_items
  drop column if exists note;

commit;
