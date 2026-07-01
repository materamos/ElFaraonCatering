create or replace function public.add_catalog_item_option(section_id text, item_id text, option_id text, name text)
returns table(ok boolean, changed boolean, requires_redeploy boolean, operation text, message text)
language plpgsql
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
declare
  generated_option_id text := app_private.generate_admin_id('option');
  ignored_option_id text := nullif(btrim(add_catalog_item_option.option_id), '');
begin
  if ignored_option_id is not null then
    null;
  end if;

  select result.ok, result.changed, result.requires_redeploy, result.operation, result.message
  into ok, changed, requires_redeploy, operation, message
  from app_private.add_catalog_item_option($1, $2, generated_option_id, $4) result;

  if ok and changed and requires_redeploy then
    perform app_private.record_menu_change_event(
      operation,
      jsonb_build_object(
        'section_id', $1,
        'item_id', $2,
        'option_id', generated_option_id,
        'name', $4
      ),
      message
    );
  end if;

  return next;
end;
$function$;

create or replace function public.add_grill_item(
  family_id text,
  item_id text,
  name text,
  variant_name text,
  amount integer
)
returns table(ok boolean, changed boolean, requires_redeploy boolean, operation text, message text)
language plpgsql
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
declare
  generated_item_id text := app_private.generate_admin_id('grill-item');
  ignored_item_id text := nullif(btrim(add_grill_item.item_id), '');
begin
  if ignored_item_id is not null then
    null;
  end if;

  select result.ok, result.changed, result.requires_redeploy, result.operation, result.message
  into ok, changed, requires_redeploy, operation, message
  from app_private.add_grill_item($1, generated_item_id, $3, $4, $5) result;

  if ok and changed and requires_redeploy then
    perform app_private.record_menu_change_event(
      operation,
      jsonb_build_object(
        'family_id', $1,
        'item_id', generated_item_id,
        'name', $3,
        'variant_name', $4,
        'amount', $5
      ),
      message
    );
  end if;

  return next;
end;
$function$;

create or replace function public.add_grill_product(
  family_id text,
  title text,
  item_id text,
  variant_name text,
  amount integer
)
returns table(ok boolean, changed boolean, requires_redeploy boolean, operation text, message text)
language plpgsql
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
declare
  generated_family_id text := app_private.generate_admin_id('grill-product');
  generated_item_id text := app_private.generate_admin_id('grill-item');
  ignored_family_id text := nullif(btrim(add_grill_product.family_id), '');
  ignored_item_id text := nullif(btrim(add_grill_product.item_id), '');
begin
  if ignored_family_id is not null then
    null;
  end if;

  if ignored_item_id is not null then
    null;
  end if;

  select result.ok, result.changed, result.requires_redeploy, result.operation, result.message
  into ok, changed, requires_redeploy, operation, message
  from app_private.add_grill_product(generated_family_id, $2, generated_item_id, $4, $5) result;

  if ok and changed and requires_redeploy then
    perform app_private.record_menu_change_event(
      operation,
      jsonb_build_object(
        'family_id', generated_family_id,
        'title', $2,
        'item_id', generated_item_id,
        'variant_name', $4,
        'amount', $5
      ),
      message
    );
  end if;

  return next;
end;
$function$;

revoke all on function public.add_catalog_item_option(text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.add_catalog_item_option(text,text,text,text) to authenticated;

revoke all on function public.add_grill_item(text,text,text,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.add_grill_item(text,text,text,text,integer) to authenticated;

revoke all on function public.add_grill_product(text,text,text,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.add_grill_product(text,text,text,text,integer) to authenticated;
