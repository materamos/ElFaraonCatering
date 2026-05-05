-- Drop redundant menu_prices.currency.
-- ARS is a presentation decision in the application, not row-level price data.
-- This migration is idempotent and aborts if existing data contains any non-ARS value.

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'menu_content'
      and table_name = 'menu_prices'
      and column_name = 'currency'
  ) then
    if exists (
      select 1
      from menu_content.menu_prices
      where currency is distinct from 'ARS'
    ) then
      raise exception 'menu_content.menu_prices.currency contains non-ARS values. Review data before dropping the column.';
    end if;

    alter table menu_content.menu_prices
      drop column currency;
  end if;
end $$;

commit;
