begin;

lock table menu_content.menu_catalog_items in access exclusive mode;

do $$
declare
  sequence_name text;
  next_id bigint;
begin
  sequence_name := pg_get_serial_sequence(
    'menu_content.menu_catalog_items',
    'id'
  );

  if sequence_name is null then
    raise exception 'menu_content.menu_catalog_items.id must use an owned sequence.';
  end if;

  select coalesce(max(item.id), 0) + 1
  into next_id
  from menu_content.menu_catalog_items item;

  perform setval(sequence_name::regclass, next_id, false);
end
$$;

commit;
