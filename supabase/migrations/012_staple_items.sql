-- ============================================
-- 012: 定番品(staple_items)テーブル追加
-- ============================================
-- 世帯ごとに「いつもの定番品」をマスタとして登録し、
-- ワンタップで買い物リスト(tasks)に追加できる機能のDB基盤。
-- RLS は supabase-rules.md の方針に従い get_my_household_id() 経由。
-- ============================================

-- テーブル作成
create table public.staple_items (
  id               uuid        primary key default gen_random_uuid(),
  household_id     uuid        not null references public.households(id) on delete cascade,
  name             text        not null,
  category_id      uuid        references public.categories(id) on delete set null,
  default_quantity numeric,
  default_unit     text,
  note             text,
  icon             text,
  sort_order       integer     not null default 0,
  use_count        integer     not null default 0,
  last_used_at     timestamptz,
  created_by       uuid        references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- インデックス
create index idx_staple_items_household
  on public.staple_items(household_id);

create index idx_staple_items_usage
  on public.staple_items(household_id, use_count desc, last_used_at desc nulls last);

-- updated_at 自動更新トリガー（handle_updated_at は 001 で定義済み）
create trigger handle_staple_items_updated_at
  before update on public.staple_items
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.staple_items enable row level security;

create policy "staple_items_select"
  on public.staple_items for select
  using (household_id = public.get_my_household_id());

create policy "staple_items_insert"
  on public.staple_items for insert
  with check (household_id = public.get_my_household_id());

create policy "staple_items_update"
  on public.staple_items for update
  using  (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

create policy "staple_items_delete"
  on public.staple_items for delete
  using (household_id = public.get_my_household_id());

-- Realtime 購読対象に追加
alter publication supabase_realtime add table public.staple_items;

-- 並び順一括更新 RPC（reorder_tasks と同パターン）
create or replace function public.reorder_staple_items(
  p_item_ids   uuid[],
  p_sort_orders integer[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  v_household_id := public.get_my_household_id();
  if v_household_id is null then
    raise exception 'Authentication required';
  end if;

  if array_length(p_item_ids, 1) is null then
    return;
  end if;

  -- 全アイテムが自世帯に属することを検証
  if exists (
    select 1 from unnest(p_item_ids) as item_id
    where not exists (
      select 1 from public.staple_items si
      where si.id = item_id and si.household_id = v_household_id
    )
  ) then
    raise exception 'Item does not belong to your household';
  end if;

  for i in 1..array_length(p_item_ids, 1) loop
    update public.staple_items
    set sort_order = p_sort_orders[i]
    where id = p_item_ids[i] and household_id = v_household_id;
  end loop;
end;
$$;
