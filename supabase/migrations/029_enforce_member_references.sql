-- Existing single-column FKs allow a task or staple to name a member of a
-- different household, and task_assignees can pair a task with that member.
update public.tasks t set created_by = null
where created_by is not null and not exists (
  select 1 from public.profiles p
  where p.id = t.created_by and p.household_id = t.household_id
);

update public.staple_items si set created_by = null
where created_by is not null and not exists (
  select 1 from public.profiles p
  where p.id = si.created_by and p.household_id = si.household_id
);

delete from public.task_assignees ta
where not exists (
  select 1 from public.tasks t join public.profiles p on p.id = ta.profile_id
  where t.id = ta.task_id and t.household_id = p.household_id
);

create function public.validate_task_member_references()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.created_by is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.created_by and p.household_id = new.household_id
  ) then
    raise exception 'Task creator must be in the same household';
  end if;
  return new;
end;
$$;
create trigger validate_task_member_references
  before insert or update of created_by, household_id on public.tasks
  for each row execute function public.validate_task_member_references();

create function public.validate_staple_member_references()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.created_by is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.created_by and p.household_id = new.household_id
  ) then
    raise exception 'Staple creator must be in the same household';
  end if;
  return new;
end;
$$;
create trigger validate_staple_member_references
  before insert or update of created_by, household_id on public.staple_items
  for each row execute function public.validate_staple_member_references();

create function public.validate_task_assignee_household()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.tasks t join public.profiles p on p.id = new.profile_id
    where t.id = new.task_id and t.household_id = p.household_id
  ) then
    raise exception 'Task assignee must be in the same household';
  end if;
  return new;
end;
$$;
create trigger validate_task_assignee_household
  before insert or update on public.task_assignees
  for each row execute function public.validate_task_assignee_household();

-- When a member joins a new household, remove references left behind in the
-- former household so they do not become cross-household links later.
create function public.clear_departed_member_references()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.household_id is distinct from old.household_id then
    update public.tasks set created_by = null
    where created_by = new.id and household_id is distinct from new.household_id;
    update public.staple_items set created_by = null
    where created_by = new.id and household_id is distinct from new.household_id;
    delete from public.task_assignees ta
    using public.tasks t
    where ta.task_id = t.id and ta.profile_id = new.id
      and t.household_id is distinct from new.household_id;
  end if;
  return new;
end;
$$;
create trigger clear_departed_member_references
  after update of household_id on public.profiles
  for each row execute function public.clear_departed_member_references();
