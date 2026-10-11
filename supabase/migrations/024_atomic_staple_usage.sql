-- Increment on the database row so concurrent devices cannot lose counts.
create function public.record_staple_usage(p_item_id uuid)
returns table(use_count integer, last_used_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  v_household_id := public.get_my_household_id();
  if auth.uid() is null or v_household_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  update public.staple_items si
  set use_count = si.use_count + 1,
      last_used_at = now()
  where si.id = p_item_id and si.household_id = v_household_id
  returning si.use_count, si.last_used_at;

  if not found then
    raise exception 'Item does not belong to your household';
  end if;
end;
$$;

revoke execute on function public.record_staple_usage(uuid)
  from public, anon;
grant execute on function public.record_staple_usage(uuid)
  to authenticated;
