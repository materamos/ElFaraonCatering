begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'menu_content'
      and table_name = 'menu_override_groups'
      and column_name = 'pricing_key'
  ) then
    if exists (
      select 1
      from menu_content.menu_override_groups
      where pricing_key is not null
    ) then
      raise exception 'menu_override_groups.pricing_key contains data. Move the intended price to global menu prices before dropping override pricing.';
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'menu_content'
      and table_name = 'menu_override_section_items'
      and column_name = 'pricing_key'
  ) then
    if exists (
      select 1
      from menu_content.menu_override_section_items
      where pricing_key is not null
    ) then
      raise exception 'menu_override_section_items.pricing_key contains data. Move the intended price to global menu prices before dropping override pricing.';
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'menu_content'
      and table_name = 'menu_override_group_items'
      and column_name = 'pricing_key'
  ) then
    if exists (
      select 1
      from menu_content.menu_override_group_items
      where pricing_key is not null
    ) then
      raise exception 'menu_override_group_items.pricing_key contains data. Move the intended price to global menu prices before dropping override pricing.';
    end if;
  end if;
end $$;

alter table if exists menu_content.menu_override_groups
  drop column if exists pricing_key;

alter table if exists menu_content.menu_override_section_items
  drop column if exists pricing_key;

alter table if exists menu_content.menu_override_group_items
  drop column if exists pricing_key;

commit;
