begin;

drop function if exists public.reserve_menu_publish_request(uuid, integer);

create function public.reserve_menu_publish_request(
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
  recent_request_created_at timestamptz;
  remaining_seconds integer;
begin
  if user_id is null then
    return query select null::bigint, false, 'user_id_required'::text, null::integer;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('publish_menu_changes')::bigint);

  select request.id, request.created_at
  into recent_request_id, recent_request_created_at
  from app_private.menu_publish_requests request
  where request.status in ('queued', 'succeeded')
    and request.created_at >= now() - make_interval(secs => effective_cooldown_seconds)
  order by request.created_at desc
  limit 1;

  if recent_request_id is not null then
    remaining_seconds := greatest(
      0,
      ceil(extract(epoch from (
        recent_request_created_at
          + make_interval(secs => effective_cooldown_seconds)
          - now()
      )))::integer
    );

    insert into app_private.menu_publish_requests (
      requested_by,
      status,
      message
    )
    values (
      reserve_menu_publish_request.user_id,
      'cooldown',
      'publish_recently_queued'
    )
    returning id into inserted_request_id;

    return query select inserted_request_id, false, 'publish_recently_queued'::text, remaining_seconds;
    return;
  end if;

  insert into app_private.menu_publish_requests (
    requested_by,
    status,
    message
  )
  values (
    reserve_menu_publish_request.user_id,
    'queued',
    'publish_reserved'
  )
  returning id into inserted_request_id;

  return query select inserted_request_id, true, 'publish_reserved'::text, 0;
end;
$$;

revoke all on function public.reserve_menu_publish_request(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_menu_publish_request(uuid, integer) to service_role;

commit;
