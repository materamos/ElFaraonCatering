begin;

-- Harden security definer function lookup without changing signatures, bodies,
-- grants, policies, or RPC return contracts. This migration is intended for
-- databases where staff_users and operational edit RPCs are already installed.

alter function public.set_staff_users_updated_at()
  set search_path = public, pg_temp;

alter function public.is_active_staff()
  set search_path = public, pg_temp;

alter function public.can_edit_availability(text)
  set search_path = public, pg_temp;

alter function public.can_manage_staff()
  set search_path = public, pg_temp;

alter function public.can_publish_menu()
  set search_path = public, pg_temp;

alter function public.can_edit_menu_content()
  set search_path = public, pg_temp;

alter function public.menu_availability_target_exists(text, text, text, text)
  set search_path = public, menu_content, pg_temp;

alter function public.set_menu_availability_overlay(text, text, text, text, boolean)
  set search_path = public, menu_content, pg_temp;

alter function public.clear_menu_availability_overlay(text, text, text, text)
  set search_path = public, menu_content, pg_temp;

alter function public.set_profile_service_kind(text, text)
  set search_path = public, menu_content, pg_temp;

alter function public.set_daily_menu(text, text, text, boolean, text, text, text, boolean)
  set search_path = public, menu_content, pg_temp;

alter function public.set_global_fixed_price(text, integer)
  set search_path = public, menu_content, pg_temp;

alter function public.set_global_price_variant(text, text, integer, boolean)
  set search_path = public, menu_content, pg_temp;

commit;
