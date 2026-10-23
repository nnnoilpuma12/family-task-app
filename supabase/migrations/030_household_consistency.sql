-- Keep household membership changes serialized and make household/profile
-- changes observable by the clients that share them.

create or replace function public.create_household_with_defaults(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_existing_household uuid;
  v_code text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- create and join use the same row lock. This prevents two tabs from both
  -- observing NULL and creating different households for the same profile.
  select household_id into v_existing_household
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;
  if v_existing_household is not null then
    raise exception 'Already a member of a household';
  end if;

  v_name := coalesce(nullif(trim(p_name), ''), 'わが家');
  insert into public.households(name)
  values (v_name)
  returning id into v_household_id;

  update public.profiles
  set household_id = v_household_id
  where id = auth.uid();

  insert into public.categories (household_id, name, color, icon, sort_order) values
    (v_household_id, '買い物', '#ef4444', 'shopping-cart', 0),
    (v_household_id, '料理', '#f97316', 'chef-hat', 1),
    (v_household_id, '掃除', '#22c55e', 'sparkles', 2),
    (v_household_id, '洗濯', '#3b82f6', 'shirt', 3),
    (v_household_id, 'その他', '#6366f1', 'list', 4);

  v_code := upper(encode(extensions.gen_random_bytes(8), 'hex'));
  update public.households
  set invite_code = v_code,
      invite_code_expires_at = now() + interval '24 hours'
  where id = v_household_id;

  return v_household_id;
end;
$$;

create or replace function public.join_household_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_existing_household uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'Invite code required';
  end if;

  select id into v_household_id
  from public.households
  where invite_code = upper(trim(p_code))
    and invite_code_expires_at > now();

  if v_household_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  select household_id into v_existing_household
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;
  if v_existing_household = v_household_id then
    return v_household_id;
  end if;
  if v_existing_household is not null then
    raise exception 'Already a member of another household';
  end if;

  update public.profiles
  set household_id = v_household_id
  where id = auth.uid();

  return v_household_id;
end;
$$;

-- A newly repaired profile must not use the INSERT policy to bypass the
-- invite/create RPCs and attach itself to an arbitrary household.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (
    (select auth.uid()) = id
    and household_id is null
  );

-- Realtime is used as the fast path. Clients also refetch on focus/online so
-- disconnects and missed events still converge to the database state.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'households'
  ) then
    alter publication supabase_realtime add table public.households;
  end if;
end;
$$;
