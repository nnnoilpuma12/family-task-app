-- 本番の定番品使用回数 RPC を復旧するための運用用 SQL。
-- migration 024 と同じ関数・権限を再適用し、API の定義キャッシュを更新する。
-- 対象: taglzjcbtlttavgvlpuq (family-task-app-eight.vercel.app の接続先)。
-- SQL Editor で対象プロジェクトと既存の関数定義を確認してから実行する。
-- タスクや使用回数のデータは変更しない。関数の作成・置換と権限設定のみ。
-- migration 履歴は変更しない。後で既存 migration の適用状況を照合すること。

begin;

-- Increment on the database row so concurrent devices cannot lose counts.
create or replace function public.record_staple_usage(p_item_id uuid)
returns table(use_count integer, last_used_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  v_household_id := public.get_my_household_id();
  if auth.uid() is null or v_household_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  update public.staple_items si
  set use_count = si.use_count + 1,
      last_used_at = now()
  where si.id = p_item_id and si.household_id = v_household_id
  returning si.use_count, si.last_used_at;

  if not found then
    raise exception 'Item does not belong to your household';
  end if;
end;
$$;

revoke execute on function public.record_staple_usage(uuid)
  from public, anon;
grant execute on function public.record_staple_usage(uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
