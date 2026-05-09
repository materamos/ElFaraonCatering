begin;

revoke select on public.menu_availability_overlays from anon, authenticated;

grant select (
  menu_id,
  section_id,
  group_id,
  item_id,
  available_override
) on public.menu_availability_overlays to anon, authenticated;

commit;
