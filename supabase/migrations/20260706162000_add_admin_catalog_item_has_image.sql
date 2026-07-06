CREATE OR REPLACE FUNCTION app_private.get_admin_catalog_editor_state()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'menu_content', 'pg_temp'
AS $function$
  select case
    when not public.can_edit_menu_content() then
      jsonb_build_object(
        'sections', '[]'::jsonb,
        'items', '[]'::jsonb
      )
    else
      jsonb_build_object(
        'sections', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'section_id', section.section_id,
              'title', section.title,
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
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'section_id', item.section_id,
              'section_title', section.title,
              'item_id', item.item_id,
              'name', item.name,
              'description', item.description,
              'pricing_key', item.pricing_key,
              'price_amount', price.amount,
              'order_index', item.order_index,
              'has_image', exists (
                select 1
                from menu_content.menu_catalog_item_images image
                where image.catalog_item_id = item.id
              ),
              'option_count', (
                select count(*)
                from menu_content.menu_catalog_item_options option
                where option.catalog_item_id = item.id
              ),
              'options', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'section_id', item.section_id,
                    'item_id', item.item_id,
                    'option_id', option.option_id,
                    'name', option.name,
                    'order_index', option.order_index
                  )
                  order by option.order_index, option.option_id
                )
                from menu_content.menu_catalog_item_options option
                where option.catalog_item_id = item.id
              ), '[]'::jsonb)
            )
            order by section.order_index, item.order_index, item.item_id
          )
          from menu_content.menu_catalog_items item
          join menu_content.menu_catalog_sections section
            on section.section_id = item.section_id
          left join menu_content.menu_prices price
            on price.pricing_key = item.pricing_key
           and price.kind = 'fixed'
        ), '[]'::jsonb)
      )
  end;
$function$;

revoke all on function app_private.get_admin_catalog_editor_state() from public, anon, authenticated, service_role;
grant execute on function app_private.get_admin_catalog_editor_state() to authenticated;
