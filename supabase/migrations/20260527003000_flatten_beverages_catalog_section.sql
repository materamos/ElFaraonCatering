begin;

create temporary table tmp_beverage_item_prices on commit drop as
select
  item.id as catalog_item_id,
  item.item_id,
  group_entry.pricing_key as group_pricing_key,
  'catalog:bebidas:item:' || item.item_id || ':price' as pricing_key,
  price.amount,
  row_number() over (
    order by group_entry.order_index, item.order_index, item.id
  ) - 1 as new_order_index
from menu_content.menu_catalog_items item
join menu_content.menu_catalog_groups group_entry
  on group_entry.section_id = item.section_id
 and group_entry.group_id = item.group_id
join menu_content.menu_prices price
  on price.pricing_key = group_entry.pricing_key
where item.section_id = 'bebidas'
  and item.group_id <> ''
  and price.kind = 'fixed'
  and price.amount is not null;

insert into menu_content.menu_prices (
  pricing_key,
  kind,
  amount
)
select
  pricing_key,
  'fixed',
  amount
from tmp_beverage_item_prices
on conflict (pricing_key) do update
set
  kind = excluded.kind,
  amount = excluded.amount;

update menu_content.menu_catalog_items item
set order_index = tmp.catalog_item_id + 10000
from tmp_beverage_item_prices tmp
where item.id = tmp.catalog_item_id;

update menu_content.menu_catalog_items item
set
  group_id = '',
  pricing_key = tmp.pricing_key,
  order_index = tmp.new_order_index
from tmp_beverage_item_prices tmp
where item.id = tmp.catalog_item_id;

update menu_content.menu_catalog_sections
set content_kind = 'items'
where section_id = 'bebidas';

delete from menu_content.menu_catalog_groups
where section_id = 'bebidas';

delete from menu_content.menu_prices price
where price.pricing_key in (
    select distinct group_pricing_key
    from tmp_beverage_item_prices
  )
  and not exists (
    select 1
    from menu_content.menu_catalog_groups group_entry
    where group_entry.pricing_key = price.pricing_key
  )
  and not exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.pricing_key = price.pricing_key
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

commit;
