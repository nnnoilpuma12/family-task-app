-- Update a category order as one authorized transaction.
create function public.reorder_categories(
  p_category_ids uuid[],
  p_sort_orders integer[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_length integer;
begin
  v_household_id := public.get_my_household_id();
  if auth.uid() is null or v_household_id is null then
    raise exception 'Authentication required';
  end if;

  v_length := coalesce(array_length(p_category_ids, 1), 0);
  if v_length <> coalesce(array_length(p_sort_orders, 1), 0)
     or v_length <> (select count(distinct id) from unnest(p_category_ids) as id)
     or exists (select 1 from unnest(p_category_ids, p_sort_orders) as item(id, sort_order)
                where item.id is null or item.sort_order is null) then
    raise exception 'Invalid category order';
  end if;

  if exists (
    select 1 from unnest(p_category_ids) as item(id)
    where not exists (
      select 1 from public.categories c
      where c.id = item.id and c.household_id = v_household_id
    )
  ) then
    raise exception 'Category does not belong to your household';
  end if;

  update public.categories c
  set sort_order = item.sort_order
  from unnest(p_category_ids, p_sort_orders) as item(id, sort_order)
  where c.id = item.id and c.household_id = v_household_id;
end;
$$;

revoke execute on function public.reorder_categories(uuid[], integer[])
  from public, anon;
grant execute on function public.reorder_categories(uuid[], integer[])
  to authenticated;
