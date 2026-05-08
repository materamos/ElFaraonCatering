begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'menu_content'
      and table_name = 'menu_sections'
      and column_name = 'section_scope'
  ) then
    execute $sql$
      delete from menu_content.menu_sections
      where section_scope = 'daily'
    $sql$;
  end if;
end $$;

drop index if exists menu_content.menu_sections_context_section_id_key;
drop index if exists menu_content.menu_sections_context_order_key;

alter table menu_content.menu_sections
  drop constraint if exists menu_sections_scope_menu_id_valid,
  drop constraint if exists menu_sections_section_scope_check,
  drop constraint if exists menu_sections_menu_id_fkey,
  drop constraint if exists menu_sections_check;

do $$
begin
  if exists (
    select 1
    from menu_content.menu_sections
    group by section_id
    having count(*) > 1
  ) then
    raise exception 'menu_sections contains duplicate section_id values. Resolve duplicates before consolidating the daily service model.';
  end if;

  if exists (
    select 1
    from menu_content.menu_sections
    group by order_index
    having count(*) > 1
  ) then
    raise exception 'menu_sections contains duplicate order_index values. Resolve duplicates before consolidating the daily service model.';
  end if;
end $$;

alter table menu_content.menu_sections
  drop column if exists section_scope,
  drop column if exists menu_id;

create unique index if not exists menu_sections_section_id_key
  on menu_content.menu_sections (section_id);

create unique index if not exists menu_sections_order_key
  on menu_content.menu_sections (order_index);

do $$
begin
  if exists (
    select 1
    from menu_content.menu_prices price
    where price.pricing_key like 'daily:%'
      and (
        exists (
          select 1
          from menu_content.menu_daily_menu daily_menu
          where daily_menu.pricing_key = price.pricing_key
        )
        or exists (
          select 1
          from menu_content.menu_grill_items grill_item
          where grill_item.pricing_key = price.pricing_key
        )
        or exists (
          select 1
          from menu_content.menu_groups menu_group
          where menu_group.pricing_key = price.pricing_key
        )
        or exists (
          select 1
          from menu_content.menu_section_items section_item
          where section_item.pricing_key = price.pricing_key
        )
        or exists (
          select 1
          from menu_content.menu_group_items group_item
          where group_item.pricing_key = price.pricing_key
        )
        or exists (
          select 1
          from menu_content.menu_price_variants price_variant
          where price_variant.pricing_key = price.pricing_key
        )
      )
  ) then
    raise exception 'Legacy daily price keys are still referenced. Remove unexpected references before deleting daily:* prices.';
  end if;
end $$;

delete from menu_content.menu_prices
where pricing_key like 'daily:%';

commit;
