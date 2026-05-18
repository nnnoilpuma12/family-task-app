-- ============================================
-- 013: profile.household_id の直接書き換えを禁止
-- ============================================
-- 既存の profiles UPDATE ポリシーは USING のみで WITH CHECK が無いため、
-- 認証ユーザーが自分の profile に対して任意の household_id を書き込めた。
-- 結果として、別世帯の UUID を知っているユーザーは
--   update profiles set household_id = '<target>' where id = auth.uid()
-- だけで標的世帯のメンバーになりすまし、tasks / categories などに
-- フルアクセスできてしまう状態だった（011 のコメントで認識済み）。
--
-- 本マイグレーションでは：
--   1. profiles UPDATE ポリシーに WITH CHECK を追加し、household_id を
--      自分の現在値から変更する UPDATE を弾く。
--   2. 世帯参加は既存の join_household_with_code RPC のみで可能にする。
--   3. 新規世帯作成は create_household_with_defaults RPC（新設）で
--      households 作成・profile 紐付け・デフォルトカテゴリ・招待コードを
--      atomic に行う（SECURITY DEFINER で RLS をバイパス）。
-- ============================================


-- ============================================
-- Step 1: profiles UPDATE ポリシーを差し替え
-- ============================================
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and household_id is not distinct from (
      select p.household_id from public.profiles p where p.id = auth.uid()
    )
  );


-- ============================================
-- Step 2: 世帯作成 + 初期化を atomic に行う RPC
-- ============================================
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

  -- 既に世帯所属の場合は二重作成を拒否
  select household_id into v_existing_household
  from public.profiles where id = auth.uid();

  if v_existing_household is not null then
    raise exception 'Already a member of a household';
  end if;

  -- 世帯名を正規化（空文字 → 'わが家'、長さ制限は households_name_length に委譲）
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

  v_code := upper(encode(gen_random_bytes(8), 'hex'));
  update public.households
  set invite_code = v_code,
      invite_code_expires_at = now() + interval '24 hours'
  where id = v_household_id;

  return v_household_id;
end;
$$;
