begin;

alter table app_private.menu_publish_requests
  add column if not exists menu_content_hash text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_publish_requests_menu_content_hash_valid'
      and conrelid = 'app_private.menu_publish_requests'::regclass
  ) then
    alter table app_private.menu_publish_requests
      add constraint menu_publish_requests_menu_content_hash_valid
      check (menu_content_hash is null or menu_content_hash ~ '^[a-f0-9]{32}$');
  end if;
end $$;

create index if not exists menu_publish_requests_published_hash_idx
  on app_private.menu_publish_requests (completed_at desc, created_at desc)
  where status = 'succeeded' and menu_content_hash is not null;

create or replace function app_private.get_menu_publication_content_hash()
returns text
language sql
stable
security definer
set search_path = public, menu_content, pg_temp
as $$
  with content as (
    select jsonb_build_object(
      'profiles', coalesce((
        select jsonb_agg(to_jsonb(profile) order by profile.id)
        from menu_content.menu_profiles profile
      ), '[]'::jsonb),
      'profile_facts', coalesce((
        select jsonb_agg(to_jsonb(fact) order by fact.profile_id, fact.order_index, fact.fact_id)
        from menu_content.menu_profile_facts fact
      ), '[]'::jsonb),
      'prices', coalesce((
        select jsonb_agg(to_jsonb(price) order by price.pricing_key)
        from menu_content.menu_prices price
      ), '[]'::jsonb),
      'price_variants', coalesce((
        select jsonb_agg(to_jsonb(variant) order by variant.pricing_key, variant.order_index, variant.variant_id)
        from menu_content.menu_price_variants variant
      ), '[]'::jsonb),
      'daily_items', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.order_index, item.item_id)
        from menu_content.menu_daily_items item
      ), '[]'::jsonb),
      'profile_service_settings', coalesce((
        select jsonb_agg(to_jsonb(settings) order by settings.profile_id)
        from menu_content.menu_profile_service_settings settings
      ), '[]'::jsonb),
      'catalog_sections', coalesce((
        select jsonb_agg(to_jsonb(section) order by section.order_index, section.section_id)
        from menu_content.menu_catalog_sections section
      ), '[]'::jsonb),
      'catalog_groups', coalesce((
        select jsonb_agg(to_jsonb(group_entry) order by group_entry.section_id, group_entry.order_index, group_entry.group_id)
        from menu_content.menu_catalog_groups group_entry
      ), '[]'::jsonb),
      'catalog_items', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.section_id, item.group_id, item.order_index, item.item_id)
        from menu_content.menu_catalog_items item
      ), '[]'::jsonb),
      'catalog_item_options', coalesce((
        select jsonb_agg(to_jsonb(option_entry) order by option_entry.catalog_item_id, option_entry.order_index, option_entry.option_id)
        from menu_content.menu_catalog_item_options option_entry
      ), '[]'::jsonb),
      'grill_families', coalesce((
        select jsonb_agg(to_jsonb(family) order by family.order_index, family.family_id)
        from menu_content.menu_grill_families family
      ), '[]'::jsonb),
      'grill_items', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.order_index, item.item_id)
        from menu_content.menu_grill_catalog_items item
      ), '[]'::jsonb)
    ) as data
  )
  select md5(content.data::text)
  from content;
$$;

update app_private.menu_publish_requests request
set menu_content_hash = app_private.get_menu_publication_content_hash()
where request.id = (
  select latest.id
  from app_private.menu_publish_requests latest
  where latest.status = 'succeeded'
  order by latest.completed_at desc nulls last, latest.created_at desc
  limit 1
)
  and request.menu_content_hash is null;

create or replace function app_private.get_menu_publication_state()
returns jsonb
language sql
stable
security definer
set search_path = public, app_private, pg_temp
as $$
  with current_state as (
    select app_private.get_menu_publication_content_hash() as current_content_hash
  ),
  published_state as (
    select request.menu_content_hash as published_content_hash
    from app_private.menu_publish_requests request
    where request.status = 'succeeded'
      and request.menu_content_hash is not null
    order by request.completed_at desc nulls last, request.created_at desc
    limit 1
  )
  select jsonb_build_object(
    'current_content_hash', current_state.current_content_hash,
    'published_content_hash', coalesce(published_state.published_content_hash, current_state.current_content_hash),
    'has_unpublished_changes', current_state.current_content_hash is distinct from coalesce(published_state.published_content_hash, current_state.current_content_hash)
  )
  from current_state
  left join published_state on true;
$$;

create or replace function public.reserve_menu_publish_request(
  user_id uuid,
  cooldown_seconds integer
)
returns table (
  request_id bigint,
  reserved boolean,
  message text,
  cooldown_remaining_seconds integer
)
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  effective_cooldown_seconds integer := least(greatest(coalesce(cooldown_seconds, 60), 0), 3600);
  inserted_request_id bigint;
  recent_request_id bigint;
  recent_created_at timestamptz;
  current_content_hash text := app_private.get_menu_publication_content_hash();
begin
  if user_id is null then
    return query select null::bigint, false, 'user_id_required'::text, null::integer;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('publish_menu_changes')::bigint);

  select request.id, request.created_at
  into recent_request_id, recent_created_at
  from app_private.menu_publish_requests request
  where request.status in ('queued', 'succeeded')
    and request.created_at >= now() - make_interval(secs => effective_cooldown_seconds)
  order by request.created_at desc
  limit 1;

  if recent_request_id is not null then
    insert into app_private.menu_publish_requests (
      requested_by,
      status,
      message,
      menu_content_hash
    )
    values (
      reserve_menu_publish_request.user_id,
      'cooldown',
      'publish_recently_queued',
      current_content_hash
    )
    returning id into inserted_request_id;

    return query select
      inserted_request_id,
      false,
      'publish_recently_queued'::text,
      greatest(
        0,
        ceiling(extract(epoch from (recent_created_at + make_interval(secs => effective_cooldown_seconds) - now())))::integer
      );
    return;
  end if;

  insert into app_private.menu_publish_requests (
    requested_by,
    status,
    message,
    menu_content_hash
  )
  values (
    reserve_menu_publish_request.user_id,
    'queued',
    'publish_reserved',
    current_content_hash
  )
  returning id into inserted_request_id;

  return query select inserted_request_id, true, 'publish_reserved'::text, null::integer;
end;
$$;

create or replace function public.get_admin_operational_state()
returns jsonb
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.get_admin_operational_state()
    || jsonb_build_object(
      'catalog_editor', app_private.get_admin_catalog_editor_state(),
      'grill_editor', app_private.get_admin_grill_editor_state(),
      'publication', app_private.get_menu_publication_state()
    );
$$;

revoke all on function app_private.get_menu_publication_content_hash() from public, anon, authenticated;
revoke all on function app_private.get_menu_publication_state() from public, anon, authenticated;
revoke all on function public.reserve_menu_publish_request(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.get_admin_operational_state() from public, anon, authenticated;

grant execute on function app_private.get_menu_publication_state() to authenticated;
grant execute on function public.reserve_menu_publish_request(uuid, integer) to service_role;
grant execute on function public.get_admin_operational_state() to authenticated;

commit;
