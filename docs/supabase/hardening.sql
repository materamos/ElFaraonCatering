-- Idempotent hardening reference for the active flat menu_content model.
-- The canonical baseline already excludes legacy tables and columns.

alter table menu_content.menu_prices
  drop constraint if exists menu_prices_kind_amount_valid;

alter table menu_content.menu_prices
  add constraint menu_prices_kind_amount_valid check (
    (kind = 'fixed' and amount is not null)
    or (kind in ('included', 'variants') and amount is null)
  );

alter table menu_content.menu_profile_facts
  drop constraint if exists menu_profile_facts_link_pair_valid;

alter table menu_content.menu_profile_facts
  add constraint menu_profile_facts_link_pair_valid check (
    (link_text is null and link_href is null)
    or (link_text is not null and link_href is not null)
  );

-- Unique indexes for menu_content are created automatically by the inline
-- `unique (...)` clauses and primary keys in schema.sql. Do not duplicate them
-- here under alternative names; that produces redundant indexes covering the
-- same columns and adds write overhead without query benefit.
-- Normalized visible-name indexes depend on app_private.normalize_visible_name
-- and are defined in operational-edit-rpcs.sql and the canonical baseline.

revoke all on schema menu_content from anon, authenticated;
revoke all on all tables in schema menu_content from anon, authenticated;
revoke all on all sequences in schema menu_content from anon, authenticated;
