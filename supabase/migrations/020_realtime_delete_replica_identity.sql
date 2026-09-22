-- ============================================
-- Realtime の DELETE を購読側へ届けるための REPLICA IDENTITY 調整
--
-- postgres_changes の DELETE イベントは「変更前の行」を使って配信可否を判定する。
-- REPLICA IDENTITY が既定（主キーのみ）だと WAL に主キーしか載らないため、
-- 購読側が指定している filter（household_id=eq.<id>）を満たせず、
-- Realtime はそのイベントを配信しない。結果、削除だけが相手の画面に届かない。
--
-- tasks は 009 で FULL 済み。ここで残りの publish 対象 2 表を揃える。
--   - staple_items（012 で publish）: 定番品の削除が相手に届いていなかった
--   - categories（001 で publish）  : カテゴリの削除が相手に届いていなかった
--
-- 代償として UPDATE/DELETE の WAL に旧行全体が載るが、どちらも 1 世帯あたり
-- 数十行規模の小さなマスタなので WAL 量への影響は小さい。
-- （tasks と違って蓄積しない表であることが前提。）
-- ============================================

alter table public.staple_items replica identity full;
alter table public.categories replica identity full;
