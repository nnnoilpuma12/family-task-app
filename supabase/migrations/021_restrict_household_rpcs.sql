-- A user without a household must not be able to rotate another household's
-- invite code. In PL/pgSQL, `uuid != NULL` evaluates to NULL; an IF only enters
-- its branch for TRUE, so the old guard let the update through.
create or replace function public.generate_invite_code(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if auth.uid() is null
     or p_household_id is distinct from public.get_my_household_id() then
    raise exception 'Not a member of this household';
  end if;

  v_code := upper(encode(extensions.gen_random_bytes(8), 'hex'));
  update public.households
  set invite_code = v_code,
      invite_code_expires_at = now() + interval '24 hours'
  where id = p_household_id;
  return v_code;
end;
$$;

-- Household creation now inserts its default categories inside
-- create_household_with_defaults(). This legacy SECURITY DEFINER function has
-- no application callers and allowed household-less users to write to an
-- arbitrary household. Keep its signature for compatibility with generated
-- types, but remove API roles' permission to invoke it.
revoke execute on function public.create_default_categories(uuid)
  from public, anon, authenticated;
