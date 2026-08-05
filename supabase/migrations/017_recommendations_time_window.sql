-- ============================================
-- 017: get_recurring_recommendations に集計期間の上限を入れる
-- ============================================
-- 011 版はこの世帯の完了タスクを「全期間・全件」走査していた。
--   - completed CTE で全完了行に lower(trim(title)) を適用
--   - ROW_NUMBER() OVER (PARTITION BY ... ORDER BY completed_at DESC) で全件ソート
--   - array_agg → generate_series → percentile_cont / stddev をタイトル分だけ実行
-- これを useTaskRecommendations が毎回の起動時に呼ぶ（React Query を
-- 経由しないためキャッシュも永続化も無い）。結果は LIMIT 5 なのに、
-- 入力は世帯の利用年数に比例して増え続ける = 起動コストが単調増加する。
--
-- 推定対象は「周期 5〜45 日」に限定されているので、直近 1 年あれば
-- 最長の 45 日周期でも 8 回前後の完了が入り、中央値・変動係数の推定には十分。
-- ウィンドウを入れることで走査量が「履歴全体」から「直近の活動量」に変わり、
-- 蓄積に対して定数コストになる。
--
-- 【意図的な挙動変更】
--   1. completion_count はウィンドウ内の完了回数になる（全期間の通算ではない）。
--      recommendation-card.tsx は表示に使っていないため UI への影響は無い。
--   2. HAVING count(*) >= 3 は「直近 1 年で 3 回以上」の意味になる。
--   3. 最後の完了が 1 年以上前のタイトルはレコメンドされなくなる。
--      旧実装は days_elapsed に上限が無く、並び順が
--      `days_elapsed - median_days DESC` だったため、
--      「3 年前に数回やったきり」のタイトルが常に最上位に居座っていた。
--      ウィンドウ導入でこれが自然に解消される。
--
-- シグネチャ（引数なし / 戻り値の型）は 011 から変更していないため、
-- src/types/database.ts の再生成は不要。
-- ============================================

create or replace function public.get_recurring_recommendations()
returns table (
  normalized_title text,
  latest_title text,
  latest_category_id uuid,
  latest_memo text,
  median_interval_days int,
  days_since_last int,
  completion_count bigint,
  last_completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_window_start timestamptz;
begin
  v_household_id := public.get_my_household_id();
  if v_household_id is null then
    return;
  end if;

  -- 周期 5〜45 日の推定に必要な履歴長。45 日周期でも 8 回前後を確保できる。
  v_window_start := now() - interval '1 year';

  return query
  with completed as (
    select
      lower(trim(t.title)) as norm_title,
      t.title,
      t.category_id,
      t.memo,
      t.completed_at as done_at,
      row_number() over (
        partition by lower(trim(t.title))
        order by t.completed_at desc
      ) as rn
    from public.tasks t
    where t.household_id = v_household_id
      and t.is_done = true
      and t.completed_at is not null
      -- 015 の idx_tasks_household_completed_at (household_id, completed_at desc)
      -- がそのまま効く
      and t.completed_at >= v_window_start
  ),
  title_stats as (
    select
      c.norm_title,
      count(*) as cnt,
      max(c.done_at) as last_done,
      array_agg(c.done_at order by c.done_at) as done_times
    from completed c
    group by c.norm_title
    having count(*) >= 3
  ),
  intervals as (
    select
      ts.norm_title,
      ts.cnt,
      ts.last_done,
      (
        select array_agg(
          extract(epoch from (ts.done_times[i] - ts.done_times[i-1])) / 86400.0
        )
        from generate_series(2, array_length(ts.done_times, 1)) as i
      ) as interval_days
    from title_stats ts
  ),
  analyzed as (
    select
      iv.norm_title,
      iv.cnt,
      iv.last_done,
      (select percentile_cont(0.5) within group (order by v)
       from unnest(iv.interval_days) as v) as median_iv,
      case
        when (select avg(v) from unnest(iv.interval_days) as v) > 0
        then (select stddev(v) from unnest(iv.interval_days) as v)
             / (select avg(v) from unnest(iv.interval_days) as v)
        else 999
      end as cv
    from intervals iv
  ),
  recommendations as (
    select
      a.norm_title,
      a.cnt,
      a.last_done,
      a.median_iv::int as median_days,
      extract(day from (now() - a.last_done))::int as days_elapsed
    from analyzed a
    where a.median_iv between 5 and 45
      and a.cv < 0.4
      and extract(epoch from (now() - a.last_done)) / 86400.0
          >= a.median_iv * 0.85
  )
  select
    r.norm_title as normalized_title,
    c.title as latest_title,
    c.category_id as latest_category_id,
    c.memo as latest_memo,
    r.median_days as median_interval_days,
    r.days_elapsed as days_since_last,
    r.cnt as completion_count,
    r.last_done as last_completed_at
  from recommendations r
  join completed c on c.norm_title = r.norm_title and c.rn = 1
  where not exists (
    -- 015 の idx_tasks_pending_norm_title (household_id, lower(trim(title)))
    -- where is_done = false がそのまま効く
    select 1 from public.tasks t2
    where t2.household_id = v_household_id
      and lower(trim(t2.title)) = r.norm_title
      and t2.is_done = false
  )
  and not exists (
    select 1 from public.dismissed_recommendations dr
    where dr.household_id = v_household_id
      and dr.normalized_title = r.norm_title
      and dr.dismissed_until > now()
  )
  order by r.days_elapsed - r.median_days desc
  limit 5;
end;
$$;
