-- ============================================
-- 011: RPC 認可チェック復元 + get_recurring_recommendations 修正
-- ============================================
-- 008 で generate_invite_code / create_default_categories に対する
-- search_path 追加時に、007 で入っていた所有権チェックおよび
-- 招待コードの強度（gen_random_bytes(8) -> md5(random(),6)）が
-- 退行していたため復元する。
--
-- また 010 で追加された get_recurring_recommendations は
--   - SECURITY DEFINER だが set search_path = '' が未設定
--   - 引数 p_household_id を無検証で使用（他世帯データが読める）
-- という問題があったため、引数を撤廃し get_my_household_id() 経由に変更する。
--
-- さらに、招待コード検証と profile.household_id 更新を 1 トランザクションで
-- 行う join_household_with_code RPC を新設する（profile 直接更新への依存を減らす布石）。
-- ============================================


-- ============================================
-- F1: generate_invite_code に 007 相当の所有権チェック + 強い乱数を復元
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
  -- 呼び出し元が対象世帯のメンバーであることを確認
  if p_household_id is null or p_household_id != public.get_my_household_id() then
    raise exception 'Not a member of this household';
  end if;

  v_code := upper(encode(gen_random_bytes(8), 'hex'));
  update public.households
  set invite_code = v_code,
      invite_code_expires_at = now() + interval '24 hours'
  where id = p_household_id;
  return v_code;
end;
$$;


-- ============================================
-- F2: create_default_categories に 007 相当の認可チェックを復元
-- ============================================
create or replace function public.create_default_categories(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 呼び出し元が認証済みであることを確認
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- 新規世帯作成直後は profile.household_id がまだ NULL のケースがあるため、
  -- 既に所属していればその世帯、未所属なら任意の世帯への初期化を許容する。
  -- 既に別の世帯に所属しているユーザが他世帯へ初期カテゴリを注入することは防ぐ。
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (household_id = p_household_id or household_id is null)
  ) then
    raise exception 'Not authorized for this household';
  end if;

  insert into public.categories (household_id, name, color, icon, sort_order) values
    (p_household_id, '買い物', '#ef4444', 'shopping-cart', 0),
    (p_household_id, '料理', '#f97316', 'chef-hat', 1),
    (p_household_id, '掃除', '#22c55e', 'sparkles', 2),
    (p_household_id, '洗濯', '#3b82f6', 'shirt', 3),
    (p_household_id, 'その他', '#6366f1', 'list', 4);
end;
$$;


-- ============================================
-- F3: get_recurring_recommendations を引数なしに再定義
-- 旧シグネチャ (uuid) は DROP してから CREATE（引数が変わるため）
-- ============================================
drop function if exists public.get_recurring_recommendations(uuid);

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
begin
  v_household_id := public.get_my_household_id();
  if v_household_id is null then
    return;
  end if;

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


-- ============================================
-- F4: 招待コード検証 + profile 更新を atomic に行う RPC
-- クライアントの profiles.update({ household_id }) 直接呼び出しを
-- 将来的に閉じるための足がかり。現状の RLS では profile.household_id は
-- 自分で書き換え可能なため、この RPC を使うことでサーバ側で検証を強制する。
-- ============================================
create or replace function public.join_household_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_code is null or length(p_code) = 0 then
    raise exception 'Invite code required';
  end if;

  -- 招待コードを検証
  select id into v_household_id
  from public.households
  where invite_code = upper(p_code)
    and invite_code_expires_at > now();

  if v_household_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  -- 自分の profile に紐付け
  update public.profiles
  set household_id = v_household_id
  where id = auth.uid();

  return v_household_id;
end;
$$;
