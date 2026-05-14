begin;

with target_profile as (
  select profile.id
  from menu_content.menu_profiles profile
  where profile.id = 'teleinde'
),
next_order as (
  select coalesce(max(profile_fact.order_index), -1) + 1 as order_index
  from menu_content.menu_profile_facts profile_fact
  join target_profile
    on target_profile.id = profile_fact.profile_id
)
insert into menu_content.menu_profile_facts (
  profile_id,
  fact_id,
  label,
  value,
  link_text,
  link_href,
  order_index
)
select
  target_profile.id,
  'contacto',
  'Contacto',
  'Contactanos por WhatsApp',
  'Abrir WhatsApp',
  'https://wa.me/1154003333?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%3A%20',
  next_order.order_index
from target_profile
cross join next_order
on conflict (profile_id, fact_id) do update
set
  label = excluded.label,
  value = excluded.value,
  link_text = excluded.link_text,
  link_href = excluded.link_href;

commit;
