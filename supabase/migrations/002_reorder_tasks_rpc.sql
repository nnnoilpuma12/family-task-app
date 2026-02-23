create or replace function reorder_tasks(p_task_ids uuid[], p_sort_orders int[])
returns void
language plpgsql
security definer
as $$
begin
  update tasks
  set sort_order = v.new_sort_order,
      updated_at = now()
  from unnest(p_task_ids, p_sort_orders) as v(task_id, new_sort_order)
  where tasks.id = v.task_id
    and tasks.household_id = get_my_household_id();
end;
$$;
