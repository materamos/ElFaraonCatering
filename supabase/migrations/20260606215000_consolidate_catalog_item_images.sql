begin;

do $$
declare
  daily_has_images boolean;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'menu_content'
      and table_name = 'menu_daily_items'
      and column_name = 'image_path'
  ) then
    execute 'select exists (
      select 1
      from menu_content.menu_daily_items
      where image_path is not null
    )'
    into daily_has_images;

    if daily_has_images then
      raise exception 'Daily menu items must not define image_path before removing image support.';
    end if;
  end if;

  if exists (
    select 1
    from menu_content.menu_grill_catalog_items
    where image_path is not null
  ) then
    raise exception 'Grill items must not define image_path before removing image support.';
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.image_path is not null
      and not (
        item.image_path like '/uploads/%'
        and item.image_path not like '//%'
        and item.image_path not like '%\%'
        and item.image_path not like '%?%'
        and item.image_path not like '%#%'
        and item.image_path !~ '(^|/)\.\.?(/|$)'
        and lower(item.image_path) ~ '\.(avif|jpeg|jpg|png|svg|webp)$'
      )
  ) then
    raise exception 'Catalog item image_path values must be valid local upload paths.';
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_item_images image
    where not (
      image.image_path like '/uploads/%'
      and image.image_path not like '//%'
      and image.image_path not like '%\%'
      and image.image_path not like '%?%'
      and image.image_path not like '%#%'
      and image.image_path !~ '(^|/)\.\.?(/|$)'
      and lower(image.image_path) ~ '\.(avif|jpeg|jpg|png|svg|webp)$'
    )
  ) then
    raise exception 'Catalog image rows must contain valid local upload paths.';
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_items item
    join menu_content.menu_catalog_item_images image
      on image.catalog_item_id = item.id
      and image.image_path = item.image_path
    where item.image_path is not null
  ) then
    raise exception 'Catalog primary images must not already exist in menu_catalog_item_images.';
  end if;
end
$$;

update menu_content.menu_catalog_item_images
set order_index = order_index + 1000000;

insert into menu_content.menu_catalog_item_images (
  catalog_item_id,
  image_path,
  order_index
)
select
  item.id,
  item.image_path,
  0
from menu_content.menu_catalog_items item
where item.image_path is not null;

with normalized_orders as (
  select
    image.id,
    row_number() over (
      partition by image.catalog_item_id
      order by image.order_index, image.id
    ) - 1 as order_index
  from menu_content.menu_catalog_item_images image
)
update menu_content.menu_catalog_item_images image
set order_index = normalized.order_index
from normalized_orders normalized
where normalized.id = image.id;

do $$
begin
  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.image_path is not null
      and not exists (
        select 1
        from menu_content.menu_catalog_item_images image
        where image.catalog_item_id = item.id
          and image.image_path = item.image_path
          and image.order_index = 0
      )
  ) then
    raise exception 'Catalog primary images were not migrated to order_index zero.';
  end if;
end
$$;

do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef('app_private.add_catalog_item(text, text, text, text, integer)'::regprocedure)
  into current_definition;

  updated_definition := replace(
    current_definition,
    E'    description,\n    image_path,\n    available,',
    E'    description,\n    available,'
  );
  updated_definition := replace(
    updated_definition,
    E'    target_description,\n    null,\n    true,',
    E'    target_description,\n    true,'
  );

  if current_definition = updated_definition or updated_definition like '%image_path%' then
    raise exception 'Could not remove image_path from app_private.add_catalog_item.';
  end if;

  execute updated_definition;

  select pg_get_functiondef('app_private.add_grill_item(text, text, text, text, integer)'::regprocedure)
  into current_definition;

  updated_definition := replace(
    current_definition,
    E'    variant_name,\n    image_path,\n    available,',
    E'    variant_name,\n    available,'
  );
  updated_definition := replace(
    updated_definition,
    E'    target_variant_name,\n    null,\n    true,',
    E'    target_variant_name,\n    true,'
  );

  if current_definition = updated_definition or updated_definition like '%image_path%' then
    raise exception 'Could not remove image_path from app_private.add_grill_item.';
  end if;

  execute updated_definition;

  select pg_get_functiondef('app_private.add_grill_product(text, text, text, text, integer)'::regprocedure)
  into current_definition;

  updated_definition := replace(
    current_definition,
    E'    variant_name,\n    image_path,\n    available,',
    E'    variant_name,\n    available,'
  );
  updated_definition := replace(
    updated_definition,
    E'    target_variant_name,\n    null,\n    true,',
    E'    target_variant_name,\n    true,'
  );

  if current_definition = updated_definition or updated_definition like '%image_path%' then
    raise exception 'Could not remove image_path from app_private.add_grill_product.';
  end if;

  execute updated_definition;
end
$$;

alter table menu_content.menu_catalog_items
  drop column image_path;

alter table menu_content.menu_grill_catalog_items
  drop column image_path;

alter table menu_content.menu_daily_items
  drop column if exists image_path;

alter table menu_content.menu_catalog_item_images
  add constraint menu_catalog_item_images_path_valid
  check (
    image_path like '/uploads/%'
    and image_path not like '//%'
    and image_path not like '%\%'
    and image_path not like '%?%'
    and image_path not like '%#%'
    and image_path !~ '(^|/)\.\.?(/|$)'
    and lower(image_path) ~ '\.(avif|jpeg|jpg|png|svg|webp)$'
  );

create or replace function app_private.get_menu_publication_content_hash()
returns text
language sql
stable
security definer
set search_path = public, menu_content, pg_temp
as $$
  with content as (
    select jsonb_build_object(
      'profiles', coalesce((
        select jsonb_agg(to_jsonb(profile) order by profile.id)
        from menu_content.menu_profiles profile
      ), '[]'::jsonb),
      'profile_facts', coalesce((
        select jsonb_agg(to_jsonb(fact) order by fact.profile_id, fact.order_index, fact.fact_id)
        from menu_content.menu_profile_facts fact
      ), '[]'::jsonb),
      'prices', coalesce((
        select jsonb_agg(to_jsonb(price) order by price.pricing_key)
        from menu_content.menu_prices price
      ), '[]'::jsonb),
      'price_variants', coalesce((
        select jsonb_agg(to_jsonb(variant) order by variant.pricing_key, variant.order_index, variant.variant_id)
        from menu_content.menu_price_variants variant
      ), '[]'::jsonb),
      'daily_items', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.order_index, item.item_id)
        from menu_content.menu_daily_items item
      ), '[]'::jsonb),
      'profile_service_settings', coalesce((
        select jsonb_agg(to_jsonb(settings) order by settings.profile_id)
        from menu_content.menu_profile_service_settings settings
      ), '[]'::jsonb),
      'catalog_sections', coalesce((
        select jsonb_agg(to_jsonb(section) order by section.order_index, section.section_id)
        from menu_content.menu_catalog_sections section
      ), '[]'::jsonb),
      'catalog_items', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.section_id, item.order_index, item.item_id)
        from menu_content.menu_catalog_items item
      ), '[]'::jsonb),
      'catalog_item_images', coalesce((
        select jsonb_agg(to_jsonb(image) order by image.catalog_item_id, image.order_index, image.id)
        from menu_content.menu_catalog_item_images image
      ), '[]'::jsonb),
      'catalog_item_options', coalesce((
        select jsonb_agg(to_jsonb(option_entry) order by option_entry.catalog_item_id, option_entry.order_index, option_entry.option_id)
        from menu_content.menu_catalog_item_options option_entry
      ), '[]'::jsonb),
      'grill_families', coalesce((
        select jsonb_agg(to_jsonb(family) order by family.order_index, family.family_id)
        from menu_content.menu_grill_families family
      ), '[]'::jsonb),
      'grill_items', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.order_index, item.item_id)
        from menu_content.menu_grill_catalog_items item
      ), '[]'::jsonb)
    ) as data
  )
  select md5(content.data::text)
  from content;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'menu_content'
      and table_name in (
        'menu_catalog_items',
        'menu_daily_items',
        'menu_grill_catalog_items'
      )
      and column_name = 'image_path'
  ) then
    raise exception 'Legacy item image_path columns remain after consolidation.';
  end if;
end
$$;

revoke all on function app_private.get_menu_publication_content_hash()
  from public, anon, authenticated;

commit;
