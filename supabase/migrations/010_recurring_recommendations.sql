-- =============================================
-- 010: 定期タスクレコメンド機能
-- - dismissed_recommendations テーブル
-- - get_recurring_recommendations RPC関数
-- - パフォーマンス用インデックス
-- =============================================

-- --------------------------------------------
-- 1. dismissed_recommendations テーブル
-- --------------------------------------------
CREATE TABLE public.dismissed_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  normalized_title text NOT NULL,
  dismissed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  dismissed_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 同一世帯・同一タイトルは1件のみ
CREATE UNIQUE INDEX idx_dismissed_recommendations_unique
  ON public.dismissed_recommendations(household_id, normalized_title);

-- RLS
ALTER TABLE public.dismissed_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can read dismissed_recommendations"
  ON public.dismissed_recommendations FOR SELECT
  USING (household_id = public.get_my_household_id());

CREATE POLICY "Household members can insert dismissed_recommendations"
  ON public.dismissed_recommendations FOR INSERT
  WITH CHECK (household_id = public.get_my_household_id());

CREATE POLICY "Household members can update dismissed_recommendations"
  ON public.dismissed_recommendations FOR UPDATE
  USING (household_id = public.get_my_household_id())
  WITH CHECK (household_id = public.get_my_household_id());

CREATE POLICY "Household members can delete dismissed_recommendations"
  ON public.dismissed_recommendations FOR DELETE
  USING (household_id = public.get_my_household_id());

-- --------------------------------------------
-- 2. パフォーマンス用インデックス
-- --------------------------------------------
CREATE INDEX idx_tasks_household_done_completed
  ON public.tasks(household_id, is_done)
  WHERE is_done = true AND completed_at IS NOT NULL;

-- --------------------------------------------
-- 3. get_recurring_recommendations RPC関数
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.get_recurring_recommendations(p_household_id uuid)
RETURNS TABLE (
  normalized_title text,
  latest_title text,
  latest_category_id uuid,
  latest_memo text,
  median_interval_days int,
  days_since_last int,
  completion_count bigint,
  last_completed_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH completed AS (
    -- この世帯の完了タスクを取得し、正規化タイトルでグループ化用にROW_NUMBER付与
    SELECT
      LOWER(TRIM(t.title)) AS norm_title,
      t.title,
      t.category_id,
      t.memo,
      t.completed_at AS done_at,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(TRIM(t.title))
        ORDER BY t.completed_at DESC
      ) AS rn
    FROM tasks t
    WHERE t.household_id = p_household_id
      AND t.is_done = true
      AND t.completed_at IS NOT NULL
  ),
  title_stats AS (
    -- 3回以上完了のタイトルについて統計情報を計算
    SELECT
      c.norm_title,
      COUNT(*) AS cnt,
      MAX(c.done_at) AS last_done,
      ARRAY_AGG(c.done_at ORDER BY c.done_at) AS done_times
    FROM completed c
    GROUP BY c.norm_title
    HAVING COUNT(*) >= 3
  ),
  intervals AS (
    -- 連続する完了間の日数間隔を計算
    SELECT
      ts.norm_title,
      ts.cnt,
      ts.last_done,
      (
        SELECT ARRAY_AGG(
          EXTRACT(EPOCH FROM (ts.done_times[i] - ts.done_times[i-1])) / 86400.0
        )
        FROM generate_series(2, array_length(ts.done_times, 1)) AS i
      ) AS interval_days
    FROM title_stats ts
  ),
  analyzed AS (
    -- 中央値と変動係数を算出
    SELECT
      iv.norm_title,
      iv.cnt,
      iv.last_done,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v)
       FROM unnest(iv.interval_days) AS v) AS median_iv,
      CASE
        WHEN (SELECT AVG(v) FROM unnest(iv.interval_days) AS v) > 0
        THEN (SELECT STDDEV(v) FROM unnest(iv.interval_days) AS v)
             / (SELECT AVG(v) FROM unnest(iv.interval_days) AS v)
        ELSE 999
      END AS cv
    FROM intervals iv
  ),
  recommendations AS (
    -- フィルタ条件: 周期5〜45日、CV<0.4、85%以上経過
    SELECT
      a.norm_title,
      a.cnt,
      a.last_done,
      a.median_iv::int AS median_days,
      EXTRACT(DAY FROM (now() - a.last_done))::int AS days_elapsed
    FROM analyzed a
    WHERE a.median_iv BETWEEN 5 AND 45
      AND a.cv < 0.4
      AND EXTRACT(EPOCH FROM (now() - a.last_done)) / 86400.0
          >= a.median_iv * 0.85
  )
  SELECT
    r.norm_title AS normalized_title,
    c.title AS latest_title,
    c.category_id AS latest_category_id,
    c.memo AS latest_memo,
    r.median_days AS median_interval_days,
    r.days_elapsed AS days_since_last,
    r.cnt AS completion_count,
    r.last_done AS last_completed_at
  FROM recommendations r
  JOIN completed c ON c.norm_title = r.norm_title AND c.rn = 1
  -- 同名の未完了タスクが既にある場合は除外
  WHERE NOT EXISTS (
    SELECT 1 FROM tasks t2
    WHERE t2.household_id = p_household_id
      AND LOWER(TRIM(t2.title)) = r.norm_title
      AND t2.is_done = false
  )
  -- 非表示にしたレコメンドは除外
  AND NOT EXISTS (
    SELECT 1 FROM dismissed_recommendations dr
    WHERE dr.household_id = p_household_id
      AND dr.normalized_title = r.norm_title
      AND dr.dismissed_until > now()
  )
  ORDER BY r.days_elapsed - r.median_days DESC
  LIMIT 5;
END;
$$;
