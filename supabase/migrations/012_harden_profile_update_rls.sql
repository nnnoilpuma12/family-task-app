-- ============================================
-- 012: profiles.household_id の自力改変を禁止 (F4)
-- ============================================
-- 現状の profiles UPDATE ポリシーは `using (auth.uid() = id)` のみで
-- WITH CHECK がないため、ユーザは自分の profile の household_id を
-- 任意の UUID に書き換え可能だった（= 招待コード検証をバイパスして他世帯に「参加」できる）。
--
-- 対策:
--   1. 世帯作成〜初期設定を 1 トランザクションで実行する
--      create_household_with_defaults(p_name text) RPC を新設
--   2. create-form が担っていた 4 手順（households INSERT, profile UPDATE,
--      create_default_categories, generate_invite_code）をすべて RPC 内部に集約
--   3. profiles UPDATE ポリシーに WITH CHECK を追加し、
--      household_id は現在値と同一でなければ通さないように制限
--
-- SECURITY DEFINER の RPC（create_household_with_defaults,
-- join_household_with_code）は RLS をバイパスするため、新ポリシー下でも
-- 正規ルートの「NULL → X」遷移は可能。
-- ============================================


-- ============================================
-- 1. 世帯作成〜初期化を atomic にまとめる RPC
-- ============================================
create or replace function public.create_household_with_defaults(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_invite_code text;
  v_current_household_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- 既に世帯所属中のユーザは新規作成不可
  -- （多重所属防止。現 UI もこのケースは発生しない想定）
  select household_id into v_current_household_id
  from public.profiles
  where id = auth.uid();

  if v_current_household_id is not null then
    raise exception 'Already belongs to a household';
  end if;

  -- 名前の正規化（空白のみ / null はデフォルト名）
  v_name := coalesce(nullif(btrim(p_name), ''), 'わが家');

  -- households に INSERT
  insert into public.households (name)
  values (v_name)
  returning id into v_household_id;

  -- 招待コード生成（migration 011 の generate_invite_code と同等の強度）
  v_invite_code := upper(encode(gen_random_bytes(8), 'hex'));
  update public.households
  set invite_code = v_invite_code,
      invite_code_expires_at = now() + interval '24 hours'
  where id = v_household_id;

  -- profile に紐付け
  update public.profiles
  set household_id = v_household_id
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  -- デフォルトカテゴリ投入
  insert into public.categories (household_id, name, color, icon, sort_order) values
    (v_household_id, '買い物', '#ef4444', 'shopping-cart', 0),
    (v_household_id, '料理', '#f97316', 'chef-hat', 1),
    (v_household_id, '掃除', '#22c55e', 'sparkles', 2),
    (v_household_id, '洗濯', '#3b82f6', 'shirt', 3),
    (v_household_id, 'その他', '#6366f1', 'list', 4);

  return v_household_id;
end;
$$;


-- ============================================
-- 2. profiles UPDATE ポリシーに WITH CHECK を追加
-- ============================================
-- 既存:
--   using (auth.uid() = id)
-- 新:
--   using (auth.uid() = id)
--   with check (auth.uid() = id
--              and household_id is not distinct from get_my_household_id())
--
-- nickname / avatar_url の更新は household_id が変わらないため通る。
-- household_id を書き換えようとすると新旧が不一致になり拒否される。
-- SECURITY DEFINER な join_household_with_code / create_household_with_defaults
-- は RLS をバイパスするためこの制約の影響を受けない。
-- ============================================

drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and household_id is not distinct from public.get_my_household_id()
  );
