-- ============================================
-- セキュリティ・パフォーマンス修正
-- ============================================
-- Supabase Advisor で検出された問題を修正する
--
-- SECURITY (6件):
--   SECURITY DEFINER 関数に SET search_path = '' を追加
--   (search path injection 攻撃への対策)
--
-- PERFORMANCE (4件):
--   外部キーカラムへのインデックスを追加
-- ============================================


-- ============================================
-- SECURITY FIX: handle_updated_at
-- ============================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================
-- SECURITY FIX: handle_new_user
-- ============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', ''));
  return new;
end;
$$;


-- ============================================
-- SECURITY FIX: create_default_categories
-- ============================================
create or replace function public.create_default_categories(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (household_id, name, color, icon, sort_order) values
    (p_household_id, '買い物', '#ef4444', 'shopping-cart', 0),
    (p_household_id, '料理', '#f97316', 'chef-hat', 1),
    (p_household_id, '掃除', '#22c55e', 'sparkles', 2),
    (p_household_id, '洗濯', '#3b82f6', 'shirt', 3),
    (p_household_id, 'その他', '#6366f1', 'list', 4);
end;
$$;


-- ============================================
-- SECURITY FIX: generate_invite_code
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
  v_code := upper(substr(md5(random()::text), 1, 6));
  update public.households
  set invite_code = v_code,
      invite_code_expires_at = now() + interval '24 hours'
  where id = p_household_id;
  return v_code;
end;
$$;


-- ============================================
-- SECURITY FIX: get_my_household_id
-- ============================================
create or replace function public.get_my_household_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select household_id from public.profiles where id = auth.uid()
$$;


-- ============================================
-- PERFORMANCE FIX: 不足していた外部キーインデックス
-- ============================================
create index if not exists idx_tasks_created_by on public.tasks(created_by);
create index if not exists idx_task_images_task  on public.task_images(task_id);
