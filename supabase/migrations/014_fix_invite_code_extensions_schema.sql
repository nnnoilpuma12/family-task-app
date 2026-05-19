-- ============================================
-- 014: 招待コード生成 RPC の gen_random_bytes をスキーマ完全修飾
-- ============================================
-- 011 / 013 で再定義された以下 2 関数は `set search_path = ''` の下で
-- `gen_random_bytes(8)` をスキーマ未修飾で呼んでいた。
-- Supabase では pgcrypto 拡張が `extensions` スキーマに登録されており、
-- search_path が空だと `pg_catalog` しか暗黙検索されないため
-- `function gen_random_bytes(integer) does not exist` で実行時例外となり、
-- 設定画面からの招待コード再発行が失敗していた。
--
-- 修正対象:
--   - public.generate_invite_code(p_household_id uuid)   (011 由来)
--   - public.create_household_with_defaults(p_name text) (013 由来)
--
-- 修正方針:
--   - 関数本体の `gen_random_bytes(8)` を `extensions.gen_random_bytes(8)`
--     に完全修飾する。
--   - `set search_path = ''` / `security definer` / 認可チェック /
--     引数・戻り値シグネチャは既存のまま据え置く。
-- ============================================


-- ============================================
-- F1: generate_invite_code（011 と同一定義 + gen_random_bytes のスキーマ修飾）
-- ============================================
create or replace function public.generate_invite_code(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  -- 呼び出し元が対象世帯のメンバーであることを確認
  if p_household_id is null or p_household_id != public.get_my_household_id() then
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


-- ============================================
-- F2: create_household_with_defaults（013 と同一定義 + gen_random_bytes のスキーマ修飾）
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

  v_code := upper(encode(extensions.gen_random_bytes(8), 'hex'));
  update public.households
  set invite_code = v_code,
      invite_code_expires_at = now() + interval '24 hours'
  where id = v_household_id;

  return v_household_id;
end;
$$;
