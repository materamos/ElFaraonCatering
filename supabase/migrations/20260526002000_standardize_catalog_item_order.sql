begin;

do $$
declare
  matched_count integer;
begin
  with desired_order (item_id, new_order_index) as (
    values
      ('milanesa-peceto', 0),
      ('milanesa-napolitana', 1),
      ('suprema-pollo', 2),
      ('cuarto-pollo', 3),
      ('pechuga-grill', 4)
  )
  select count(*)
  into matched_count
  from menu_content.menu_catalog_items item
  join desired_order desired
    on desired.item_id = item.item_id
  where item.section_id = 'platos-principales'
    and item.group_id = '';

  if matched_count <> 5 then
    raise exception 'Expected all platos principales items before reordering.';
  end if;
end $$;

with desired_order (item_id, new_order_index) as (
  values
    ('milanesa-peceto', 0),
    ('milanesa-napolitana', 1),
    ('suprema-pollo', 2),
    ('cuarto-pollo', 3),
    ('pechuga-grill', 4)
)
update menu_content.menu_catalog_items item
set order_index = desired.new_order_index + 1000
from desired_order desired
where item.section_id = 'platos-principales'
  and item.group_id = ''
  and item.item_id = desired.item_id;

with desired_order (item_id, new_order_index) as (
  values
    ('milanesa-peceto', 0),
    ('milanesa-napolitana', 1),
    ('suprema-pollo', 2),
    ('cuarto-pollo', 3),
    ('pechuga-grill', 4)
)
update menu_content.menu_catalog_items item
set order_index = desired.new_order_index
from desired_order desired
where item.section_id = 'platos-principales'
  and item.group_id = ''
  and item.item_id = desired.item_id;

create or replace function app_private.get_admin_catalog_editor_state()
returns jsonb
language sql
stable
security definer
set search_path = public, menu_content, pg_temp
as $$
  select case
    when not public.can_edit_menu_content() then
      jsonb_build_object(
        'sections', '[]'::jsonb,
        'groups', '[]'::jsonb,
        'items', '[]'::jsonb
      )
    else
      jsonb_build_object(
        'sections', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'section_id', section.section_id,
              'title', section.title,
              'content_kind', section.content_kind,
              'order_index', section.order_index,
              'item_count', (
                select count(*)
                from menu_content.menu_catalog_items item
                where item.section_id = section.section_id
              )
            )
            order by section.order_index, section.section_id
          )
          from menu_content.menu_catalog_sections section
        ), '[]'::jsonb),
        'groups', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'section_id', group_entry.section_id,
              'group_id', group_entry.group_id,
              'title', group_entry.title,
              'pricing_key', group_entry.pricing_key,
              'order_index', group_entry.order_index,
              'item_count', (
                select count(*)
                from menu_content.menu_catalog_items item
                where item.section_id = group_entry.section_id
                  and item.group_id = group_entry.group_id
              )
            )
            order by section.order_index, group_entry.order_index, group_entry.group_id
          )
          from menu_content.menu_catalog_groups group_entry
          join menu_content.menu_catalog_sections section
            on section.section_id = group_entry.section_id
        ), '[]'::jsonb),
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'section_id', item.section_id,
              'section_title', section.title,
              'group_id', item.group_id,
              'group_title', group_entry.title,
              'item_id', item.item_id,
              'name', item.name,
              'description', item.description,
              'note', item.note,
              'pricing_key', item.pricing_key,
              'price_amount', price.amount,
              'order_index', item.order_index,
              'option_count', (
                select count(*)
                from menu_content.menu_catalog_item_options option
                where option.catalog_item_id = item.id
              )
            )
            order by section.order_index, group_entry.order_index nulls first, item.order_index, item.item_id
          )
          from menu_content.menu_catalog_items item
          join menu_content.menu_catalog_sections section
            on section.section_id = item.section_id
          left join menu_content.menu_catalog_groups group_entry
            on group_entry.section_id = item.section_id
           and group_entry.group_id = item.group_id
          left join menu_content.menu_prices price
            on price.pricing_key = item.pricing_key
           and price.kind = 'fixed'
        ), '[]'::jsonb)
      )
  end;
$$;

revoke all on function app_private.get_admin_catalog_editor_state() from public, anon, authenticated;
grant execute on function app_private.get_admin_catalog_editor_state() to authenticated;

commit;
