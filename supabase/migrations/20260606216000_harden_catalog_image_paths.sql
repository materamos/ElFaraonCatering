begin;

do $$
begin
  if exists (
    select 1
    from menu_content.menu_catalog_item_images image
    where image.image_path like '%//%'
  ) then
    raise exception 'Catalog image paths must not contain empty path segments.';
  end if;
end
$$;

alter table menu_content.menu_catalog_item_images
  drop constraint menu_catalog_item_images_path_valid;

alter table menu_content.menu_catalog_item_images
  add constraint menu_catalog_item_images_path_valid
  check (
    image_path like '/uploads/%'
    and image_path not like '%//%'
    and image_path not like '%\%'
    and image_path not like '%?%'
    and image_path not like '%#%'
    and image_path !~ '(^|/)\.\.?(/|$)'
    and lower(image_path) ~ '\.(avif|jpeg|jpg|png|svg|webp)$'
  );

commit;
