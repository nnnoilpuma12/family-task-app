-- A category deletion previously SET NULL on tasks/staple_items. The home
-- screen shows only user categories, so those rows became unreachable there.
-- Repair existing orphans before preventing further direct category deletes.
insert into public.categories (household_id, name, color, icon, sort_order)
select h.id, 'その他', '#6366f1', 'list', 0
from public.households h
where not exists (
  select 1 from public.categories c where c.household_id = h.id
);

update public.tasks t
set category_id = (
  select c.id from public.categories c
  where c.household_id = t.household_id
  order by c.sort_order, c.created_at, c.id
  limit 1
)
where t.category_id is null;

update public.staple_items si
set category_id = (
  select c.id from public.categories c
  where c.household_id = si.household_id
  order by c.sort_order, c.created_at, c.id
  limit 1
)
where si.category_id is null;

create function public.delete_category_with_fallback(
  p_category_id uuid,
  p_fallback_id uuid
)
returns void
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

  if p_category_id is null or p_fallback_id is null
     or p_category_id = p_fallback_id then
    raise exception 'A different fallback category is required';
  end if;

  -- Lock both rows so a concurrent delete cannot invalidate the replacement.
  perform 1 from public.categories
  where id in (p_category_id, p_fallback_id)
    and household_id = v_household_id
  for update;
  if not exists (
    select 1 from public.categories
    where id = p_category_id and household_id = v_household_id
  ) or not exists (
    select 1 from public.categories
    where id = p_fallback_id and household_id = v_household_id
  ) then
    raise exception 'Category or fallback not found in your household';
  end if;

  update public.tasks
  set category_id = p_fallback_id
  where household_id = v_household_id and category_id = p_category_id;

  update public.staple_items
  set category_id = p_fallback_id
  where household_id = v_household_id and category_id = p_category_id;

  delete from public.categories
  where id = p_category_id and household_id = v_household_id;
end;
$$;

revoke execute on function public.delete_category_with_fallback(uuid, uuid)
  from public, anon;
grant execute on function public.delete_category_with_fallback(uuid, uuid)
  to authenticated;

-- The replacement must happen inside the transaction above. A restrictive
-- policy closes the former direct DELETE path for ordinary household members.
create policy "Categories must be deleted with a fallback"
  on public.categories as restrictive for delete to authenticated
  using (false);
