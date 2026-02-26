-- ============================================
-- P1-1: 招待コードの強度強化
-- MD5(random()) の6文字 → gen_random_bytes(8) の16文字hexに変更
-- ============================================

create or replace function public.generate_invite_code(p_household_id uuid)
returns text as $$
declare
  v_code text;
begin
  v_code := upper(encode(gen_random_bytes(8), 'hex'));
  update public.households
  set invite_code = v_code,
      invite_code_expires_at = now() + interval '24 hours'
  where id = p_household_id;
  return v_code;
end;
$$ language plpgsql security definer;
