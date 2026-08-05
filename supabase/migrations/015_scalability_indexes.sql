-- ============================================
-- 015: 世帯内データ蓄積に対するインデックス最適化
-- ============================================
-- このアプリに論理削除は無く、削除は全て物理 DELETE のため
-- 「削除済み行が溜まる」経路は存在しない。一方で完了済みタスク
-- （is_done = true）はパージもアーカイブもされず tasks に残り続けるため、
-- 実質的な蓄積源はここになる。効いてくる軸は総ユーザー数ではなく
-- 「1 世帯あたりの利用年数」である。
--
-- 蓄積に比例して劣化するクエリは以下の 4 本で、いずれも
-- 「返す件数は一定なのに読む件数が履歴全体に比例する」形になっていた。
-- 完了 20,000 件の世帯を作って EXPLAIN (ANALYZE, BUFFERS) で確認した
-- 実測値を各項に添える。
-- ============================================


-- --------------------------------------------
-- 1 + 2. useTasks 起動時取得（src/hooks/use-tasks.ts）
-- --------------------------------------------
--   where household_id = ? and (is_done = false or completed_at >= ?)
--   order by is_done, sort_order, created_at desc
--
-- 対応前は household_id 一致行を全件読んでから OR をフィルタ評価していた。
--   Bitmap Heap Scan  rows=455  Rows Removed by Filter: 19642  buffers=402
-- つまり 30 日ウィンドウはレスポンスサイズと描画コストを抑えるだけで、
-- DB が読む行数は履歴全体に比例したままだった。
--
-- OR の左右それぞれにインデックスを用意すると BitmapOr で
-- 「該当行だけ」を読める形になる。
--   BitmapOr(idx_tasks_pending_order 40行, idx_tasks_household_completed_at 415行)
--   rows=455  Heap Blocks: exact=8  buffers=26
-- 読むバッファが 402 → 26、実行時間が 5.8ms → 1.0ms。
-- 重要なのは絶対値より、走査量が「履歴全体」から「返す件数」に変わったこと。
--
-- 注: 完了済みブランチ側は部分インデックスにできない。
-- `completed_at >= ?` からは `is_done = true` が導けないため、
-- 述語付きインデックスはプランナに使ってもらえない。

-- 未完了ブランチ用。未完了行だけの小さな部分インデックスなので、
-- reorder_tasks（最大 500 行の sort_order 更新）による書き込み増幅も
-- 全行対象のインデックスに比べて小さく収まる。
create index if not exists idx_tasks_pending_order
  on public.tasks (household_id, sort_order, created_at desc)
  where is_done = false;

-- 完了済みブランチ用。後述の loadMoreCompleted のカーソルも兼ねる。
create index if not exists idx_tasks_household_completed_at
  on public.tasks (household_id, completed_at desc);


-- --------------------------------------------
-- 3. useTasks.loadMoreCompleted のカーソルページング
-- --------------------------------------------
--   where household_id = ? and is_done and completed_at is not null
--     and completed_at < ? order by completed_at desc limit 30
--
-- 010 の idx_tasks_household_done_completed はキーが (household_id, is_done)
-- だけで completed_at を含まないため ORDER BY に使えず、「もっと見る」
-- 1 回ごとに完了行の全件ソートが走っていた。
--
-- 上の idx_tasks_household_completed_at がそのまま keyset ページングに効く：
--   Index Scan using idx_tasks_household_completed_at  rows=30  buffers=4
-- is_done は Filter に落ちるが、completed_at が入っている行はほぼ全て
-- is_done = true なので実質的に何も弾かれない。
--
-- 010 の部分インデックスは上位互換ができたので削除する。
drop index if exists public.idx_tasks_household_done_completed;


-- --------------------------------------------
-- 4. useTitleSuggestions（src/hooks/use-title-suggestions.ts）
-- --------------------------------------------
--   where household_id = ? order by created_at desc limit 500
--
-- created_at を持つインデックスが無く、世帯の全タスクを読んでソートしてから
-- 500 件を取っていた。runWhenIdle でクリティカルパスからは外れているが
-- DB コストは同じ。
--   → Index Scan using idx_tasks_household_created  rows=500  buffers=22
create index if not exists idx_tasks_household_created
  on public.tasks (household_id, created_at desc);


-- --------------------------------------------
-- 5. get_recurring_recommendations の重複除外
-- --------------------------------------------
--   not exists (... where lower(trim(t2.title)) = ? and t2.is_done = false)
--
-- 式インデックスが無いと候補ごとにフィルタ評価になる。
-- lower() / btrim() はいずれも IMMUTABLE なので式インデックスを張れる。
--   → Index Scan using idx_tasks_pending_norm_title  buffers=1
create index if not exists idx_tasks_pending_norm_title
  on public.tasks (household_id, lower(trim(title)))
  where is_done = false;


-- --------------------------------------------
-- 6. 冗長になった単一カラムインデックスを削除
-- --------------------------------------------
-- idx_tasks_household (household_id) は上で追加した
-- idx_tasks_household_completed_at / idx_tasks_household_created の
-- 先頭キーに完全に含まれる。households からの ON DELETE CASCADE も
-- 複合インデックスの先頭キーで解決できるため残す理由が無い。
--
-- tasks は完了トグルと並び替えで更新が多く、インデックス数がそのまま
-- 書き込み増幅に効くため重複分は落としておく。
drop index if exists public.idx_tasks_household;


-- --------------------------------------------
-- 統計情報を即座に更新しておく
-- --------------------------------------------
-- 新しいインデックスをプランナに正しく評価させるため。
-- （autovacuum 待ちだと適用直後だけ旧プランのままになりうる）
analyze public.tasks;
