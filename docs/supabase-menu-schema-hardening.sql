-- Incremental hardening for the structural menu_content schema.
-- This file is idempotent and does not truncate data or touch runtime overlay tables.

do $$
begin
  if exists (
    select 1
    from menu_content.menu_prices
    where not (
      (kind = 'fixed' and amount is not null)
      or (kind in ('included', 'variants') and amount is null)
    )
  ) then
    raise exception 'menu_prices contains rows that violate fixed/included/variants amount rules. Run docs/supabase-menu-schema-audit.sql for diagnostics.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where connamespace = 'menu_content'::regnamespace
      and conrelid = 'menu_content.menu_prices'::regclass
      and conname = 'menu_prices_kind_amount_valid'
  ) then
    alter table menu_content.menu_prices
      add constraint menu_prices_kind_amount_valid
      check (
        (kind = 'fixed' and amount is not null)
        or (kind in ('included', 'variants') and amount is null)
      );
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from menu_content.menu_sections
    where not (
      (section_scope = 'catalog' and menu_id is null)
      or (section_scope = 'daily' and menu_id is not null)
    )
  ) then
    raise exception 'menu_sections contains rows that violate section_scope/menu_id rules. Run docs/supabase-menu-schema-audit.sql for diagnostics.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where connamespace = 'menu_content'::regnamespace
      and conrelid = 'menu_content.menu_sections'::regclass
      and conname = 'menu_sections_scope_menu_id_valid'
  ) then
    alter table menu_content.menu_sections
      add constraint menu_sections_scope_menu_id_valid
      check (
        (section_scope = 'catalog' and menu_id is null)
        or (section_scope = 'daily' and menu_id is not null)
      );
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from menu_content.menu_profile_facts
    where not (
      (link_text is null and link_href is null)
      or (link_text is not null and link_href is not null)
    )
  ) then
    raise exception 'menu_profile_facts contains rows that violate link_text/link_href pairing. Run docs/supabase-menu-schema-audit.sql for diagnostics.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where connamespace = 'menu_content'::regnamespace
      and conrelid = 'menu_content.menu_profile_facts'::regclass
      and conname = 'menu_profile_facts_link_pair_valid'
  ) then
    alter table menu_content.menu_profile_facts
      add constraint menu_profile_facts_link_pair_valid
      check (
        (link_text is null and link_href is null)
        or (link_text is not null and link_href is not null)
      );
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from menu_content.menu_daily_menu
    where id <> 'current'
  ) then
    raise exception 'menu_daily_menu contains rows that violate singleton rules. Run docs/supabase-menu-schema-audit.sql for diagnostics.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where connamespace = 'menu_content'::regnamespace
      and conrelid = 'menu_content.menu_daily_menu'::regclass
      and conname = 'menu_daily_menu_singleton_valid'
  ) then
    alter table menu_content.menu_daily_menu
      add constraint menu_daily_menu_singleton_valid
      check (id = 'current');
  end if;
end $$;

create unique index if not exists menu_daily_service_settings_profile_key
  on menu_content.menu_daily_service_settings (profile_id);

create unique index if not exists menu_grill_items_item_id_key
  on menu_content.menu_grill_items (item_id);

create unique index if not exists menu_grill_items_order_index_key
  on menu_content.menu_grill_items (order_index);

create unique index if not exists menu_prices_pricing_key_kind_key
  on menu_content.menu_prices (pricing_key, kind);

create unique index if not exists menu_price_variants_pricing_key_order_key
  on menu_content.menu_price_variants (pricing_key, order_index);

create unique index if not exists menu_sections_context_section_id_key
  on menu_content.menu_sections (section_scope, coalesce(menu_id, ''), section_id);

create unique index if not exists menu_sections_context_order_key
  on menu_content.menu_sections (section_scope, coalesce(menu_id, ''), order_index);

create unique index if not exists menu_groups_section_group_id_key
  on menu_content.menu_groups (section_row_id, group_id);

create unique index if not exists menu_groups_section_order_key
  on menu_content.menu_groups (section_row_id, order_index);

create unique index if not exists menu_items_id_item_id_key
  on menu_content.menu_items (id, item_id);

create unique index if not exists menu_section_items_section_item_id_key
  on menu_content.menu_section_items (section_row_id, item_id);

create unique index if not exists menu_section_items_section_order_key
  on menu_content.menu_section_items (section_row_id, order_index);

create unique index if not exists menu_group_items_group_item_id_key
  on menu_content.menu_group_items (group_row_id, item_id);

create unique index if not exists menu_group_items_group_order_key
  on menu_content.menu_group_items (group_row_id, order_index);

create unique index if not exists menu_item_options_item_order_key
  on menu_content.menu_item_options (item_row_id, order_index);

create unique index if not exists menu_overrides_menu_id_key
  on menu_content.menu_overrides (menu_id);

create unique index if not exists menu_override_sections_override_section_id_key
  on menu_content.menu_override_sections (override_row_id, section_id);

create unique index if not exists menu_override_sections_override_order_key
  on menu_content.menu_override_sections (override_row_id, order_index);

create unique index if not exists menu_override_groups_section_group_id_key
  on menu_content.menu_override_groups (override_section_row_id, group_id);

create unique index if not exists menu_override_groups_section_order_key
  on menu_content.menu_override_groups (override_section_row_id, order_index);

create unique index if not exists menu_override_section_items_section_item_id_key
  on menu_content.menu_override_section_items (override_section_row_id, item_id);

create unique index if not exists menu_override_section_items_section_order_key
  on menu_content.menu_override_section_items (override_section_row_id, order_index);

create unique index if not exists menu_override_group_items_group_item_id_key
  on menu_content.menu_override_group_items (override_group_row_id, item_id);

create unique index if not exists menu_override_group_items_group_order_key
  on menu_content.menu_override_group_items (override_group_row_id, order_index);

revoke all on all tables in schema menu_content from anon, authenticated;
revoke all on all sequences in schema menu_content from anon, authenticated;
