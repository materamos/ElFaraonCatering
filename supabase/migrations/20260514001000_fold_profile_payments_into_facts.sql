begin;

do $$
begin
  if to_regclass('menu_content.menu_profile_payments') is not null
    and to_regclass('menu_content.menu_profile_payment_methods') is not null then
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
      payment.profile_id,
      'pagos',
      payment.label,
      string_agg(method.method, ', ' order by method.order_index),
      null,
      null,
      coalesce(
        (
          select existing_fact.order_index
          from menu_content.menu_profile_facts existing_fact
          where existing_fact.profile_id = payment.profile_id
            and existing_fact.fact_id = 'pagos'
        ),
        (
          select coalesce(max(profile_fact.order_index), -1) + 1
          from menu_content.menu_profile_facts profile_fact
          where profile_fact.profile_id = payment.profile_id
        )
      )
    from menu_content.menu_profile_payments payment
    join menu_content.menu_profile_payment_methods method
      on method.profile_id = payment.profile_id
    group by payment.profile_id, payment.label
    on conflict (profile_id, fact_id) do update
      set label = excluded.label,
          value = excluded.value,
          link_text = null,
          link_href = null;
  end if;
end $$;

drop table if exists menu_content.menu_profile_payment_methods;
drop table if exists menu_content.menu_profile_payments;

commit;
