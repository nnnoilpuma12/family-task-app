begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select ok(
  not has_function_privilege('anon', 'public.create_default_categories(uuid)', 'EXECUTE'),
  'legacy category creation RPC is not callable by anon'
);

insert into public.households (id, name)
values ('b0000000-0000-0000-0000-000000000002', 'other household');
insert into public.categories (id, household_id, name, color)
values ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'other category', '#6366f1');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

select ok(
  char_length(public.generate_invite_code('b0000000-0000-0000-0000-000000000001')) = 16,
  'a household member can generate an invite code'
);

do $$
declare
  v_household uuid := 'b0000000-0000-0000-0000-000000000001';
  v_source uuid;
  v_fallback uuid;
  v_task uuid;
  v_item uuid;
  v_count integer;
begin
  select id into v_source from public.categories
  where household_id = v_household order by sort_order, id limit 1;
  select id into v_fallback from public.categories
  where household_id = v_household and id <> v_source order by sort_order, id limit 1;

  insert into public.tasks (household_id, category_id, title)
  values (v_household, v_source, 'migration smoke task') returning id into v_task;
  insert into public.staple_items (household_id, category_id, name)
  values (v_household, v_source, 'migration smoke item') returning id into v_item;

  perform public.delete_category_with_fallback(v_source, v_fallback);
  if (select category_id from public.tasks where id = v_task) <> v_fallback
     or (select category_id from public.staple_items where id = v_item) <> v_fallback then
    raise exception 'category deletion did not move dependent rows';
  end if;

  select use_count into v_count from public.record_staple_usage(v_item);
  select use_count into v_count from public.record_staple_usage(v_item);
  if v_count <> 2 then
    raise exception 'usage increments were lost';
  end if;
end;
$$;

select ok(true, 'category deletion moves tasks and staples atomically');
select ok(true, 'staple usage increments on the database row');

do $$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.tasks (household_id, category_id, title)
    values ('b0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000002', 'wrong household');
  exception when foreign_key_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'cross-household category was accepted'; end if;
end;
$$;
select ok(true, 'cross-household category references are rejected');

do $$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.tasks (household_id, title)
    values ('b0000000-0000-0000-0000-000000000001', '   ');
  exception when check_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'blank task title was accepted'; end if;
end;
$$;
select ok(true, 'blank task titles are rejected');

reset role;
do $$
declare
  v_task uuid;
begin
  insert into public.tasks (household_id, title, created_by)
  values ('b0000000-0000-0000-0000-000000000001', 'member departure test',
          'a0000000-0000-0000-0000-000000000001') returning id into v_task;
  insert into public.task_assignees (task_id, profile_id)
  values (v_task, 'a0000000-0000-0000-0000-000000000001');

  update public.profiles set household_id = 'b0000000-0000-0000-0000-000000000002'
  where id = 'a0000000-0000-0000-0000-000000000001';
  if (select created_by from public.tasks where id = v_task) is not null
     or exists (select 1 from public.task_assignees where task_id = v_task) then
    raise exception 'departed member references remain';
  end if;
end;
$$;
select ok(true, 'moving households clears old task creator and assignee links');

do $$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.tasks (household_id, title, created_by)
    values ('b0000000-0000-0000-0000-000000000001', 'wrong creator',
            'a0000000-0000-0000-0000-000000000001');
  exception when raise_exception then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'cross-household creator was accepted'; end if;
end;
$$;
select ok(true, 'task creator must belong to the same household');
select * from finish();
rollback;
