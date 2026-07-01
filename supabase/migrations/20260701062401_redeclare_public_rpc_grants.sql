revoke all on function public.set_profile_service_kind(text,text) from public, anon, authenticated, service_role;
grant execute on function public.set_profile_service_kind(text,text) to authenticated;

revoke all on function public.set_daily_menu(text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.set_daily_menu(text,text,text,text) to authenticated;

revoke all on function public.set_global_fixed_price(text,integer) from public, anon, authenticated, service_role;
grant execute on function public.set_global_fixed_price(text,integer) to authenticated;

revoke all on function public.set_global_price_variant(text,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.set_global_price_variant(text,text,integer) to authenticated;

revoke all on function public.add_catalog_item(text,text,text,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.add_catalog_item(text,text,text,text,integer) to authenticated;

revoke all on function public.delete_catalog_item(text,text) from public, anon, authenticated, service_role;
grant execute on function public.delete_catalog_item(text,text) to authenticated;

revoke all on function public.update_catalog_item(text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.update_catalog_item(text,text,text,text) to authenticated;

revoke all on function public.add_catalog_item_option(text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.add_catalog_item_option(text,text,text,text) to authenticated;

revoke all on function public.delete_catalog_item_option(text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.delete_catalog_item_option(text,text,text) to authenticated;

revoke all on function public.update_catalog_item_option(text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.update_catalog_item_option(text,text,text,text) to authenticated;

revoke all on function public.add_grill_item(text,text,text,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.add_grill_item(text,text,text,text,integer) to authenticated;

revoke all on function public.delete_grill_item(text) from public, anon, authenticated, service_role;
grant execute on function public.delete_grill_item(text) to authenticated;

revoke all on function public.update_grill_item(text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.update_grill_item(text,text,text) to authenticated;

revoke all on function public.add_grill_product(text,text,text,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.add_grill_product(text,text,text,text,integer) to authenticated;

revoke all on function public.delete_grill_product(text) from public, anon, authenticated, service_role;
grant execute on function public.delete_grill_product(text) to authenticated;

revoke all on function public.update_grill_product(text,text) from public, anon, authenticated, service_role;
grant execute on function public.update_grill_product(text,text) to authenticated;

revoke all on function public.complete_menu_publish_request(bigint,text,text,integer,text) from public, anon, authenticated, service_role;
grant execute on function public.complete_menu_publish_request(bigint,text,text,integer,text) to service_role;
