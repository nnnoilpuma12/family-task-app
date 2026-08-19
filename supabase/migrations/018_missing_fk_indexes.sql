-- ============================================
-- 018: 未カバーの外部キーにインデックスを追加する
-- ============================================
-- 008 で「不足していた外部キーインデックス」の棚卸しを一度行っているが、
-- その後に追加された 010 / 012 のテーブル、および 003 の push_subscriptions が
-- 棚卸しの対象から漏れていた。
--
-- 015 が扱った「1 世帯あたりの蓄積」とは軸が違うことに注意する。
-- ここで対象になるのは
--   (a) 世帯スコープを持たず、総ユーザー数（総デバイス数）に比例して伸びる表
--   (b) 参照元を削除するときにだけ走る、逆引きのチェック
-- の 2 つで、いずれも「世帯ごとに分割されている」という前提が効かない経路。
--
-- インデックスの無い外部キーは
--   - 参照先の行を DELETE するたびに参照元を全件走査する
--     （CASCADE / SET NULL / NO ACTION いずれでも逆引きは発生する）
--   - アプリからの逆引き検索でも同じ全件走査になる
-- ため、表のサイズがそのままレイテンシになる。
-- ============================================


-- --------------------------------------------
-- 1. push_subscriptions.profile_id
-- --------------------------------------------
-- 現状このアプリで「総ユーザー数に比例して劣化する唯一のクエリ」がここ。
-- 003 は UNIQUE(endpoint) しか張っておらず、profile_id 側の索引が無い。
--
-- push_subscriptions は household_id を持たない = 世帯で分割されていない表で、
-- 全ユーザー × 全デバイスぶんの行が 1 つの表に入る。そこに対して
-- src/app/api/push/send/route.ts が
--   .from("push_subscriptions").select(...).in("profile_id", memberIds)
-- を「タスク追加・完了のたびに」実行するため、通知 1 回ごとに
-- 全ユーザーの購読行を走査していた。
--
-- 加えて profile_id は profiles(id) ON DELETE CASCADE の外部キーなので、
-- アカウント削除時にも同じ全件走査が走る。
create index if not exists idx_push_subscriptions_profile
  on public.push_subscriptions (profile_id);


-- --------------------------------------------
-- 2. staple_items.category_id
-- --------------------------------------------
-- categories(id) ON DELETE SET NULL の逆引き。カテゴリ削除のたびに
-- staple_items を全件走査する（012 は household_id 側にしか索引が無い）。
create index if not exists idx_staple_items_category
  on public.staple_items (category_id);


-- --------------------------------------------
-- 3. staple_items.created_by
-- --------------------------------------------
-- auth.users(id) 参照。ON DELETE 指定が無い = NO ACTION なので、
-- ユーザー削除時に「参照が残っていないか」の確認で全件走査になる。
create index if not exists idx_staple_items_created_by
  on public.staple_items (created_by);


-- --------------------------------------------
-- 4. dismissed_recommendations.dismissed_by
-- --------------------------------------------
-- profiles(id) ON DELETE SET NULL の逆引き。
-- household_id 側は 010 の UNIQUE(household_id, normalized_title) が
-- 先頭キーでカバーしているため追加不要。
create index if not exists idx_dismissed_recommendations_dismissed_by
  on public.dismissed_recommendations (dismissed_by);


-- --------------------------------------------
-- 統計情報を即座に更新しておく
-- --------------------------------------------
-- 015 と同じ理由。autovacuum を待たずにプランナへ反映させる。
analyze public.push_subscriptions;
analyze public.staple_items;
analyze public.dismissed_recommendations;
