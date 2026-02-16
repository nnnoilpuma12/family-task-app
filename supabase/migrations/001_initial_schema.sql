-- ============================================
-- 家族タスク共有アプリ - 初期スキーマ
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- households テーブル
-- ============================================
create table public.households (
  id uuid primary key default uuid_generate_v4(),
  name text not null default 'わが家',
  invite_code text unique,
  invite_code_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- profiles テーブル
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  nickname text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- categories テーブル
-- ============================================
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- tasks テーブル
-- ============================================
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  memo text,
  url text,
  due_date date,
  is_done boolean not null default false,
  sort_order int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- task_assignees テーブル（多対多）
-- ============================================
create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (task_id, profile_id)
);

-- ============================================
-- task_images テーブル
-- ============================================
create table public.task_images (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- ============================================
-- updated_at 自動更新トリガー
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.households
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.categories
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.tasks
  for each row execute function public.handle_updated_at();

-- ============================================
-- 新規ユーザー登録時に profile を自動作成
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- デフォルトカテゴリ挿入関数
-- ============================================
create or replace function public.create_default_categories(p_household_id uuid)
returns void as $$
begin
  insert into public.categories (household_id, name, color, icon, sort_order) values
    (p_household_id, '買い物', '#ef4444', 'shopping-cart', 0),
    (p_household_id, '料理', '#f97316', 'chef-hat', 1),
    (p_household_id, '掃除', '#22c55e', 'sparkles', 2),
    (p_household_id, '洗濯', '#3b82f6', 'shirt', 3),
    (p_household_id, 'その他', '#6366f1', 'list', 4);
end;
$$ language plpgsql security definer;

-- ============================================
-- 招待コード生成関数
-- ============================================
create or replace function public.generate_invite_code(p_household_id uuid)
returns text as $$
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
$$ language plpgsql security definer;

-- ============================================
-- RLS 用ヘルパー関数（無限再帰を回避）
-- ============================================
create or replace function public.get_my_household_id()
returns uuid as $$
  select household_id from public.profiles where id = auth.uid()
$$ language sql security definer stable;

-- ============================================
-- RLS ポリシー
-- ============================================
alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_images enable row level security;

-- profiles: 自分 or 同じ household のメンバー
create policy "Users can read own and household profiles"
  on public.profiles for select
  using (id = auth.uid() or household_id = public.get_my_household_id());

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- households: メンバーのみ読み書き可 + 招待コードで読み取り可
create policy "Household members can read"
  on public.households for select
  using (true);

create policy "Household members can update"
  on public.households for update
  using (id = public.get_my_household_id());

create policy "Authenticated users can create households"
  on public.households for insert
  with check (auth.role() = 'authenticated');

-- categories: household メンバーのみ
create policy "Household members can manage categories"
  on public.categories for all
  using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- tasks: household メンバーのみ
create policy "Household members can manage tasks"
  on public.tasks for all
  using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- task_assignees: household メンバーのみ（task 経由で判定）
create policy "Household members can manage task_assignees"
  on public.task_assignees for all
  using (
    task_id in (
      select id from public.tasks where household_id = public.get_my_household_id()
    )
  )
  with check (
    task_id in (
      select id from public.tasks where household_id = public.get_my_household_id()
    )
  );

-- task_images: household メンバーのみ
create policy "Household members can manage task_images"
  on public.task_images for all
  using (
    task_id in (
      select id from public.tasks where household_id = public.get_my_household_id()
    )
  )
  with check (
    task_id in (
      select id from public.tasks where household_id = public.get_my_household_id()
    )
  );

-- ============================================
-- Realtime 有効化
-- ============================================
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.categories;

-- ============================================
-- インデックス
-- ============================================
create index idx_profiles_household on public.profiles(household_id);
create index idx_categories_household on public.categories(household_id);
create index idx_tasks_household on public.tasks(household_id);
create index idx_tasks_category on public.tasks(category_id);
create index idx_tasks_due_date on public.tasks(due_date);
create index idx_task_assignees_profile on public.task_assignees(profile_id);
