-- ============================================
-- 016: RLS ポリシーの InitPlan 化と部分クエリの EXISTS 化
-- ============================================
-- 全ポリシーが `household_id = public.get_my_household_id()` のように
-- ヘルパ関数を裸で呼ぶ形になっている。get_my_household_id() は STABLE だが、
-- この書き方はプラン次第でスキャン行ごとに評価されうる
-- （Supabase performance advisor の auth_rls_initplan 指摘に該当）。
--
-- `(select ...)` で包むとスカラサブクエリとして InitPlan に落ち、
-- クエリ全体で 1 回だけ評価される。オーバーヘッドが「読む行数 × 関数呼び出し」
-- から定数に変わるため、015 で対象にした蓄積の効くクエリと掛け算にならない。
-- auth.uid() / auth.role() も同じ理由で包む。
--
-- あわせて task_assignees / task_images のポリシーを IN から EXISTS に変える。
-- 現状の
--   task_id in (select id from public.tasks where household_id = ...)
-- は世帯の全タスク id を集めてから突き合わせるため、世帯のタスクが増えるほど
-- 重くなる。EXISTS + 主キー等値なら 1 件のインデックス探索で済む。
--
-- 権限の意味は一切変えていない。判定式の評価タイミングと結合方法のみの変更。
-- ============================================


-- ============================================
-- profiles
-- ============================================
drop policy if exists "Users can read own and household profiles" on public.profiles;

create policy "Users can read own and household profiles"
  on public.profiles for select
  using (
    id = (select auth.uid())
    or household_id = (select public.get_my_household_id())
  );

drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can insert own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

-- 013 で追加した household_id 固定の WITH CHECK を維持したまま InitPlan 化する。
-- 元の相関サブクエリ (select p.household_id from profiles p where p.id = auth.uid())
-- は profiles 自身を読むため SELECT ポリシーの評価を伴っていたが、
-- get_my_household_id() は SECURITY DEFINER で同じ値を返しつつ
-- その内側の RLS 評価を回避できる。
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and household_id is not distinct from (select public.get_my_household_id())
  );


-- ============================================
-- households
-- ============================================
drop policy if exists "Household members can read own" on public.households;

create policy "Household members can read own"
  on public.households for select
  using (id = (select public.get_my_household_id()));

drop policy if exists "Household members can update" on public.households;

create policy "Household members can update"
  on public.households for update
  using (id = (select public.get_my_household_id()));

drop policy if exists "Authenticated users can create households" on public.households;

create policy "Authenticated users can create households"
  on public.households for insert
  with check ((select auth.role()) = 'authenticated');


-- ============================================
-- categories
-- ============================================
drop policy if exists "Household members can manage categories" on public.categories;

create policy "Household members can manage categories"
  on public.categories for all
  using (household_id = (select public.get_my_household_id()))
  with check (household_id = (select public.get_my_household_id()));


-- ============================================
-- tasks
-- ============================================
drop policy if exists "Household members can manage tasks" on public.tasks;

create policy "Household members can manage tasks"
  on public.tasks for all
  using (household_id = (select public.get_my_household_id()))
  with check (household_id = (select public.get_my_household_id()));


-- ============================================
-- task_assignees（IN → EXISTS）
-- ============================================
drop policy if exists "Household members can manage task_assignees" on public.task_assignees;

create policy "Household members can manage task_assignees"
  on public.task_assignees for all
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and t.household_id = (select public.get_my_household_id())
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and t.household_id = (select public.get_my_household_id())
    )
  );


-- ============================================
-- task_images（IN → EXISTS）
-- ============================================
drop policy if exists "Household members can manage task_images" on public.task_images;

create policy "Household members can manage task_images"
  on public.task_images for all
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_images.task_id
        and t.household_id = (select public.get_my_household_id())
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_images.task_id
        and t.household_id = (select public.get_my_household_id())
    )
  );


-- ============================================
-- push_subscriptions
-- ============================================
drop policy if exists "Users can insert own subscriptions" on public.push_subscriptions;

create policy "Users can insert own subscriptions"
  on public.push_subscriptions for insert
  with check (profile_id = (select auth.uid()));

drop policy if exists "Users can delete own subscriptions" on public.push_subscriptions;

create policy "Users can delete own subscriptions"
  on public.push_subscriptions for delete
  using (profile_id = (select auth.uid()));

drop policy if exists "Users can read own subscriptions" on public.push_subscriptions;

create policy "Users can read own subscriptions"
  on public.push_subscriptions for select
  using (profile_id = (select auth.uid()));


-- ============================================
-- dismissed_recommendations
-- ============================================
drop policy if exists "Household members can read dismissed_recommendations"
  on public.dismissed_recommendations;

create policy "Household members can read dismissed_recommendations"
  on public.dismissed_recommendations for select
  using (household_id = (select public.get_my_household_id()));

drop policy if exists "Household members can insert dismissed_recommendations"
  on public.dismissed_recommendations;

create policy "Household members can insert dismissed_recommendations"
  on public.dismissed_recommendations for insert
  with check (household_id = (select public.get_my_household_id()));

drop policy if exists "Household members can update dismissed_recommendations"
  on public.dismissed_recommendations;

create policy "Household members can update dismissed_recommendations"
  on public.dismissed_recommendations for update
  using (household_id = (select public.get_my_household_id()))
  with check (household_id = (select public.get_my_household_id()));

drop policy if exists "Household members can delete dismissed_recommendations"
  on public.dismissed_recommendations;

create policy "Household members can delete dismissed_recommendations"
  on public.dismissed_recommendations for delete
  using (household_id = (select public.get_my_household_id()));


-- ============================================
-- staple_items
-- ============================================
drop policy if exists "staple_items_select" on public.staple_items;

create policy "staple_items_select"
  on public.staple_items for select
  using (household_id = (select public.get_my_household_id()));

drop policy if exists "staple_items_insert" on public.staple_items;

create policy "staple_items_insert"
  on public.staple_items for insert
  with check (household_id = (select public.get_my_household_id()));

drop policy if exists "staple_items_update" on public.staple_items;

create policy "staple_items_update"
  on public.staple_items for update
  using  (household_id = (select public.get_my_household_id()))
  with check (household_id = (select public.get_my_household_id()));

drop policy if exists "staple_items_delete" on public.staple_items;

create policy "staple_items_delete"
  on public.staple_items for delete
  using (household_id = (select public.get_my_household_id()));
