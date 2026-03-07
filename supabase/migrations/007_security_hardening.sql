-- ============================================
-- 007: セキュリティ強化
-- ============================================
-- CRITICAL: households SELECT ポリシーを制限（招待コード漏洩対策）
-- HIGH: RPC 関数に所有権チェック追加
-- HIGH: push_subscriptions SELECT ポリシーを自分のみに制限
-- HIGH: reorder_tasks に配列ガード追加
-- ============================================


-- ============================================
-- CRITICAL: households SELECT ポリシーを制限
-- 現状 using(true) で全世帯の招待コードが漏洩
-- → 自世帯のみ読み取り可 + 招待コード検証は RPC 経由
-- ============================================

-- 既存ポリシーを削除して再作成
drop policy if exists "Household members can read" on public.households;

-- 自世帯のみ読み取り可
create policy "Household members can read own"
  on public.households for select
  using (id = public.get_my_household_id());

-- 招待コード検証用 RPC（households テーブルを直接 SELECT しない）
create or replace function public.verify_invite_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  select id into v_household_id
  from public.households
  where invite_code = upper(p_code)
    and invite_code_expires_at > now();

  return v_household_id; -- NULL if not found
end;
$$;


-- ============================================
-- HIGH: generate_invite_code に所有権チェック追加
-- 005 で再定義されたが set search_path = '' が脱落
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
  if p_household_id != public.get_my_household_id() then
    raise exception 'Not a member of this household';
  end if;

  v_code := upper(encode(gen_random_bytes(8), 'hex'));
  update public.households
  set invite_code = v_code,
      invite_code_expires_at = now() + interval '24 hours'
  where id = p_household_id;
  return v_code;
end;
$$;


-- ============================================
-- HIGH: create_default_categories に所有権チェック追加
-- ============================================

create or replace function public.create_default_categories(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 呼び出し元が対象世帯のメンバーであることを確認
  -- 新規世帯作成時は profile がまだ紐づいていない場合があるため、
  -- profile の存在チェックのみ行う
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- 対象世帯にメンバーがいるか確認（新規作成者含む）
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (household_id = p_household_id or household_id is null)
  ) then
    raise exception 'Not authorized for this household';
  end if;

  insert into public.categories (household_id, name, color, icon, sort_order) values
    (p_household_id, '買い物', '#ef4444', 'shopping-cart', 0),
    (p_household_id, '料理', '#f97316', 'chef-hat', 1),
    (p_household_id, '掃除', '#22c55e', 'sparkles', 2),
    (p_household_id, '洗濯', '#3b82f6', 'shirt', 3),
    (p_household_id, 'その他', '#6366f1', 'list', 4);
end;
$$;


-- ============================================
-- HIGH: reorder_tasks に set search_path + 配列ガード追加
-- ============================================

create or replace function public.reorder_tasks(p_task_ids uuid[], p_sort_orders int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 配列長の一致チェック
  if array_length(p_task_ids, 1) != array_length(p_sort_orders, 1) then
    raise exception 'Array length mismatch';
  end if;

  -- 上限ガード（DoS 対策）
  if array_length(p_task_ids, 1) > 500 then
    raise exception 'Too many tasks to reorder (max 500)';
  end if;

  update public.tasks
  set sort_order = v.new_sort_order,
      updated_at = now()
  from unnest(p_task_ids, p_sort_orders) as v(task_id, new_sort_order)
  where tasks.id = v.task_id
    and tasks.household_id = public.get_my_household_id();
end;
$$;


-- ============================================
-- HIGH: push_subscriptions SELECT を自分のみに制限
-- サーバー側 API は service_role で読むため問題なし
-- ============================================

drop policy if exists "Can read household member subscriptions" on public.push_subscriptions;

create policy "Users can read own subscriptions"
  on public.push_subscriptions for select
  using (profile_id = auth.uid());
