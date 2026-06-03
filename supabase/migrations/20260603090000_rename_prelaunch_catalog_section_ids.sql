begin;

do $$
declare
  rename_count integer;
begin
  with section_renames(old_section_id, new_section_id) as (
    values
      ('desayuno-snack', 'cafeteria'),
      ('minutas-tartas-omelettes', 'tartas-tortillas-omelettes')
  )
  select count(*)::integer
  into rename_count
  from section_renames rename
  join menu_content.menu_catalog_sections old_section
    on old_section.section_id = rename.old_section_id
  left join menu_content.menu_catalog_sections new_section
    on new_section.section_id = rename.new_section_id
  where new_section.section_id is null;

  if rename_count <> 2 then
    raise exception 'Expected old catalog section ids to exist and new catalog section ids to be unused.';
  end if;
end $$;

with section_renames(old_section_id, new_section_id) as (
  values
    ('desayuno-snack', 'cafeteria'),
    ('minutas-tartas-omelettes', 'tartas-tortillas-omelettes')
)
insert into menu_content.menu_catalog_sections (
  section_id,
  title,
  description,
  presentation,
  content_kind,
  order_index
)
select
  rename.new_section_id,
  section.title,
  section.description,
  section.presentation,
  section.content_kind,
  section.order_index + 1000
from section_renames rename
join menu_content.menu_catalog_sections section
  on section.section_id = rename.old_section_id;

with section_renames(old_section_id, new_section_id) as (
  values
    ('desayuno-snack', 'cafeteria'),
    ('minutas-tartas-omelettes', 'tartas-tortillas-omelettes')
),
price_renames as (
  select
    price.pricing_key as old_pricing_key,
    replace(price.pricing_key, 'catalog:' || rename.old_section_id || ':', 'catalog:' || rename.new_section_id || ':') as new_pricing_key,
    price.kind,
    price.amount
  from menu_content.menu_prices price
  join section_renames rename
    on price.pricing_key like 'catalog:' || rename.old_section_id || ':%'
)
insert into menu_content.menu_prices (
  pricing_key,
  kind,
  amount
)
select
  new_pricing_key,
  kind,
  amount
from price_renames
on conflict (pricing_key) do nothing;

with section_renames(old_section_id, new_section_id) as (
  values
    ('desayuno-snack', 'cafeteria'),
    ('minutas-tartas-omelettes', 'tartas-tortillas-omelettes')
),
variant_renames as (
  select
    replace(variant.pricing_key, 'catalog:' || rename.old_section_id || ':', 'catalog:' || rename.new_section_id || ':') as new_pricing_key,
    variant.price_kind,
    variant.variant_id,
    variant.name,
    variant.amount,
    variant.order_index
  from menu_content.menu_price_variants variant
  join section_renames rename
    on variant.pricing_key like 'catalog:' || rename.old_section_id || ':%'
)
insert into menu_content.menu_price_variants (
  pricing_key,
  price_kind,
  variant_id,
  name,
  amount,
  order_index
)
select
  new_pricing_key,
  price_kind,
  variant_id,
  name,
  amount,
  order_index
from variant_renames
on conflict (pricing_key, variant_id) do update
set
  name = excluded.name,
  amount = excluded.amount,
  order_index = excluded.order_index;

with section_renames(old_section_id, new_section_id) as (
  values
    ('desayuno-snack', 'cafeteria'),
    ('minutas-tartas-omelettes', 'tartas-tortillas-omelettes')
)
update menu_content.menu_catalog_groups menu_group
set
  section_id = rename.new_section_id,
  pricing_key = case
    when menu_group.pricing_key is null then null
    else replace(menu_group.pricing_key, 'catalog:' || rename.old_section_id || ':', 'catalog:' || rename.new_section_id || ':')
  end
from section_renames rename
where menu_group.section_id = rename.old_section_id;

with section_renames(old_section_id, new_section_id) as (
  values
    ('desayuno-snack', 'cafeteria'),
    ('minutas-tartas-omelettes', 'tartas-tortillas-omelettes')
)
update menu_content.menu_catalog_items item
set
  section_id = rename.new_section_id,
  pricing_key = case
    when item.pricing_key is null then null
    else replace(item.pricing_key, 'catalog:' || rename.old_section_id || ':', 'catalog:' || rename.new_section_id || ':')
  end,
  image_path = case
    when item.image_path = '/uploads/menu-placeholders/desayuno-snack.svg' then '/uploads/menu-placeholders/cafeteria.svg'
    else item.image_path
  end
from section_renames rename
where item.section_id = rename.old_section_id;

with section_renames(old_section_id, new_section_id) as (
  values
    ('desayuno-snack', 'cafeteria'),
    ('minutas-tartas-omelettes', 'tartas-tortillas-omelettes')
)
update public.menu_availability_overlays overlay
set section_id = rename.new_section_id
from section_renames rename
where overlay.section_id = rename.old_section_id;

with section_renames(old_section_id, new_section_id) as (
  values
    ('desayuno-snack', 'cafeteria'),
    ('minutas-tartas-omelettes', 'tartas-tortillas-omelettes')
),
old_sections as (
  delete from menu_content.menu_catalog_sections section
  using section_renames rename
  where section.section_id = rename.old_section_id
  returning rename.new_section_id, section.order_index
)
update menu_content.menu_catalog_sections section
set order_index = old_sections.order_index
from old_sections
where section.section_id = old_sections.new_section_id;

with section_renames(old_section_id, new_section_id) as (
  values
    ('desayuno-snack', 'cafeteria'),
    ('minutas-tartas-omelettes', 'tartas-tortillas-omelettes')
),
old_prices as (
  select price.pricing_key
  from menu_content.menu_prices price
  join section_renames rename
    on price.pricing_key like 'catalog:' || rename.old_section_id || ':%'
)
delete from menu_content.menu_prices price
using old_prices
where price.pricing_key = old_prices.pricing_key
  and not exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.pricing_key = price.pricing_key
  )
  and not exists (
    select 1
    from menu_content.menu_catalog_groups menu_group
    where menu_group.pricing_key = price.pricing_key
  )
  and not exists (
    select 1
    from menu_content.menu_daily_items daily_item
    where daily_item.pricing_key = price.pricing_key
  )
  and not exists (
    select 1
    from menu_content.menu_grill_catalog_items grill_item
    where grill_item.pricing_key = price.pricing_key
  );

do $$
declare
  target_function regprocedure;
  function_definition text;
begin
  foreach target_function in array array[
    'app_private.add_catalog_item(text,text,text,text,text,integer)'::regprocedure,
    'app_private.update_catalog_item(text,text,text,text,text)'::regprocedure,
    'app_private.delete_catalog_item(text,text,text)'::regprocedure
  ]
  loop
    function_definition := pg_get_functiondef(target_function);

    if function_definition like '%minutas-tartas-omelettes%' then
      execute replace(
        function_definition,
        'minutas-tartas-omelettes',
        'tartas-tortillas-omelettes'
      );
    end if;
  end loop;
end $$;

commit;
