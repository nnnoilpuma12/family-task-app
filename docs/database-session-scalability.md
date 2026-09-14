# ユーザー増加時のデータベース接続・セッション調査

調査日: 2026-09-14

## 1. 結論

このアプリで「セッション上限」と呼び得るものは、少なくとも次の 3 種類に分けて考える必要がある。

1. **PostgreSQL の接続数**: DB プロセスが同時に処理できる接続。Compute サイズと接続プール設定に依存する。
2. **Supabase Auth のログインセッション**: access token / refresh token の寿命や、同一ユーザーの同時ログイン数。
3. **Supabase Realtime の接続・購読**: ブラウザタブごとの WebSocket と、そこを流れるメッセージ。

現行実装はブラウザから Supabase Data API（PostgREST）を呼んでいるため、**ユーザーや `createClient()` の個数がそのまま PostgreSQL の常時接続数になる構成ではない**。Data API 側が DB 接続を管理する。一方、各タブは Realtime の持続接続を持ち、画面起動時には複数の DB リクエストが集中する。このため、先に問題になりやすいのは単純な登録ユーザー数ではなく、以下である。

- 同時アクティブなブラウザタブ数
- 起動・復帰が同時刻に集中したときの API リクエスト数と DB クエリ時間
- 1 回の更新を受け取る Realtime 購読者数
- 1 世帯に蓄積されたタスク数（インデックス対策は既に実施済み）

現時点では、推測で接続プール値を変更するよりも、Hosted Supabase の実値と利用率を計測し、段階的に負荷試験するのが妥当である。特に `supabase/config.toml` はローカル開発用であり、本番 Hosted プロジェクトの上限・設定そのものではない。

## 2. 現行構成の棚卸し

### DB 接続経路

| 経路 | 現行実装 | 接続上限への影響 |
|---|---|---|
| ブラウザ | `createBrowserClient` + anon key で Data API を利用 | HTTP リクエストごとに Data API の管理下で DB を利用。ブラウザが PostgreSQL 接続を保持しない |
| Next.js middleware | `createServerClient` で `auth.getClaims()` | 非対称署名鍵なら JWT 検証は原則ローカル。対称鍵では Auth への往復にフォールバック |
| Server Component | cookie 対応 `createServerClient` | 現在の主要データ取得はクライアント側。将来サーバー利用が増えてもリクエスト間でクライアントを共有しない設計 |
| Service role | `@supabase/supabase-js`、session 永続化・自動 refresh 無効 | Push API 等から Data API を利用。直接 PostgreSQL 接続ではない |
| Realtime | ホーム画面で 2 channel | タブごとに持続 WebSocket。DB の「接続数」とは別枠だが、変更配信時に DB/Realtime の負荷を生む |

`@supabase/ssr` の `createBrowserClient` は通常ブラウザ側でクライアントを再利用するため、複数フックの `createClient()` 呼び出しを「DB 接続が同数増える」と数えてはいけない。ただし、この実装詳細に容量設計を依存せず、ブラウザの Network パネルと Realtime Reports で **1 タブあたりの実 WebSocket 数**を確認する。

### 起動時の負荷

ホーム画面では概ね次の取得が発生する。

- session のローカル読み出し後、profile を取得
- tasks、categories、staple items、recommendations を並行取得
- household と members をバックグラウンド取得
- title suggestions をアイドル時に取得
- 初回描画後、tasks と staple items の Realtime channel を購読

したがって、キャッシュが無いコールドスタートを **1 タブあたり約 7〜9 API リクエスト + 1 Realtime WebSocket** として、まず安全側に見積もる。正確な本数は、同じビルドに対するブラウザ計測または負荷試験で確定する。React Query は 30 秒の `staleTime` と 1 日の永続キャッシュを持つため通常利用時の再取得を抑えるが、デプロイ直後、キャッシュ失効、端末の一斉復帰ではバーストが起こり得る。

Realtime は現在 2 channel で、各 channel に INSERT / UPDATE / DELETE の 3 binding、合計 6 binding を登録する。Supabase client が同じ WebSocket に channel を多重化できても、購読数と配信時の認可処理は別に考える必要がある。

## 3. 上限の考え方

### 3.1 PostgreSQL 接続と Supavisor

Supabase Hosted の接続方法には direct connection、Session mode、Transaction mode がある。常駐サーバーや IPv6 対応クライアントでは direct connection、prepared statement やセッション状態が必要な接続では Session mode、サーバーレス/短命で多数の接続では Transaction mode が基本的な選択肢になる。このアプリ自身は Data API 利用のため、Vercel 等から独自に `postgres` / ORM の直接接続を追加しない限り、アプリ側で DB URL のモードを選ぶ場面はない。

将来バッチ、ORM、管理ツールを追加するときは以下を守る。

- サーバーレス関数から direct connection をインスタンスごとに作らない。Transaction pooler を第一候補にする。
- トランザクションをまたぐ prepared statement、一時テーブル、セッション変数等に依存する処理は Transaction mode と相性が悪い。必要なら direct / Session mode を分離する。
- migration のような常駐接続を前提とする操作は direct connection を使う。
- pool のクライアント上限を大きくしても PostgreSQL の実処理枠は増えない。待ち行列とタイムアウトを増やすだけになり得るので、DB 使用率・待機時間・遅い SQL を先に確認する。
- 本番の最大接続数、pool size、予約接続は Compute サイズや Supabase 側の変更で変わり得る。固定値をこの文書から設定に転記せず、Dashboard の **Database settings / Pooler** と公式 Compute 文書を都度正とする。

ローカル設定は pooler が `enabled = false` で、例示値は `pool_mode = "transaction"`、`default_pool_size = 20`、`max_client_conn = 100` である。これは本番値の証拠にはならず、ローカルで pooler 経由の挙動を試すなら明示的に有効化する必要がある。

### 3.2 Auth セッション

ローカル設定の access token（JWT）有効期限は 3,600 秒、refresh token rotation は有効、reuse interval は 10 秒である。session の `timebox` と `inactivity_timeout` は未設定なので、ローカルでは固定の絶対期限・無操作期限を課していない。

access token の失効と「ログインセッション全体の終了」は同じではない。SDK は有効な refresh token で access token を更新するため、JWT が 1 時間だから利用者が 1 時間でログアウトするわけではない。長時間アクティブなタブの Auth refresh は、概算上限として `アクティブタブ数 × 24 回/日` 程度を置いて監視する（実際の更新タイミング、休止タブ、SDK の余裕時間により変動）。

ローカルの Auth rate limit は token refresh が IP ごとに 5 分間 150 回、sign-in/sign-up が IP ごとに 5 分間 30 回である。これも Hosted 本番値とは限らない。会社・学校・家庭内 NAT のように多数ユーザーが同一 IP を共有すると IP 単位の制限が先に効く可能性があるため、負荷試験では IP の分散/集中の両方を試す。

セキュリティ要件として無操作ログアウト、絶対有効期間、ユーザーごとの単一セッションを導入する場合、Supabase Auth の Session controls を本番 Dashboard で設定する。ただしプラン制約があり、短すぎる期限は refresh の集中と UX 悪化を招く。設定変更後も既発行 JWT はその有効期限まで通り得ること、session timeout の判定は refresh 時に反映されることを前提に検証する。

### 3.3 Realtime 接続

Realtime の上限（同時接続、channel 数、毎秒メッセージ数、payload サイズ等）はプランごとに異なり変更され得るため、[公式 Quotas](https://supabase.com/docs/guides/realtime/quotas) と本番 Dashboard の Realtime Reports を基準にする。

容量見積もりの最小モデルは次の通り。

- `C = 同時アクティブ端末数 × 端末あたりのアクティブタブ数`（概ね同時 WebSocket 数）
- 現行の channel 数は最大 `2C`
- ある世帯の 1 更新あたりの配信は概ね、その世帯で接続中の対象タブ数に比例
- 月間メッセージは `変更イベント数 × 対象購読タブ数` を基本に、protocol message や再接続を加算

Postgres Changes は変更順序を保つための処理と購読者ごとの認可確認がスケール時のボトルネックになり得る。大規模化してこの部分が支配的になった場合は、private channel + Broadcast（Database trigger からの broadcast を含む）への移行を検証する。直ちに移行する必要はないが、「DB 接続に余裕があるから Realtime も安全」とは判断しない。

現行コードは effect cleanup で channel を削除しており、明白な channel リークは見当たらない。一方、tasks と staple items は同じ世帯単位なので、上限が近づいた段階では 1 channel に 6 binding をまとめ、channel 数を半減できる。ただし WebSocket 数や認可対象イベント数は減らない可能性があるため、計測なしに効果を断定しない。

## 4. 数字を確定する手順

### 本番 Dashboard で記録する値

環境ごとに以下を同じ時刻に記録し、月次で履歴化する。

1. Compute サイズ、PostgreSQL の最大接続数
2. Database 接続の使用数・使用率、pooler mode / pool size / client limit
3. Database CPU、memory、disk I/O、IOPS、disk size
4. API requests、p50 / p95 / p99 latency、4xx / 5xx
5. Realtime concurrent connections、channels、messages、join/leave、errors
6. Auth MAU、refresh / login の 429、失敗率
7. DB size、テーブル別サイズ、index hit rate、上位の遅いクエリ

接続数は DB で次の読み取り専用 SQL でも確認できる（権限により一部列/行が見えない場合がある）。

```sql
select
  backend_type,
  state,
  application_name,
  count(*) as connections
from pg_stat_activity
group by backend_type, state, application_name
order by connections desc;

select name, setting, unit
from pg_settings
where name in ('max_connections', 'superuser_reserved_connections');
```

長時間占有や待機原因の確認例:

```sql
select
  pid,
  application_name,
  state,
  wait_event_type,
  wait_event,
  now() - coalesce(xact_start, query_start) as age,
  left(query, 200) as query
from pg_stat_activity
where pid <> pg_backend_pid()
order by age desc nulls last;
```

### 負荷試験

本番データを使わない staging プロジェクトで、RLS を有効にした実 API を対象とする。

| 段階 | シナリオ | 合格基準の例 |
|---|---|---|
| 1 | 目標同時数の 25% が 5 分でログイン・ホーム起動 | 429/5xx なし、接続使用率 60% 未満、p95 を記録 |
| 2 | 50%、100% と段階増加 | エラー率 1% 未満、接続待ち/タイムアウトなし、p95 が SLO 内 |
| 3 | 全クライアントが同時再接続・token refresh | Auth/Realtime の 429 と再試行嵐がない |
| 4 | 各世帯 2〜5 タブ購読中に task 更新を連続実行 | Realtime 遅延、欠落、重複、DB CPU が許容内 |
| 5 | 20,000 完了タスクを持つ世帯を混在 | 通常世帯の p95 が悪化せず、対象 SQL が既存 index を利用 |

目標値は「登録ユーザー数」ではなく、例えば `登録 10,000 / DAU 2,000 / ピーク同時 300 / 平均 1.2 タブ` のように分ける。DB の必要同時処理数は概算で `ピーク QPS × 平均 DB 処理秒`（Little の法則）から始め、起動バースト係数と headroom（最低 30〜40%）を加える。HTTP リクエスト本数をそのまま必要 DB 接続数にはしない。

## 5. 推奨アクション

### 今すぐ（設定変更なし）

1. 本番 Dashboard の上記ベースラインを保存し、アラートを設定する。
2. 非対称 Auth signing key への移行済みか確認し、middleware の `getClaims()` が Auth 往復にフォールバックしていないことを計測する。
3. 1 タブあたりの HTTP リクエスト、WebSocket、channel/binding 数を DevTools で実測する。
4. DB の接続使用率だけでなく p95、CPU、Realtime lag/429 を同じグラフで追う。
5. この文書の負荷試験を staging で自動化し、想定ピークの 2 倍まで破綻点を確認する。

### 利用増に応じて

1. **接続使用率が持続的に 60〜70%超**: idle/long transaction と遅い SQL を除去し、外部 direct 接続があれば pooler へ移す。その後 Compute/pool の増強を検討。
2. **DB CPU / I/O が先に上昇**: pool 上限を増やさず、query plan、RLS、index、取得件数を改善。既存の scalability index と RLS InitPlan 最適化が本番適用済みか確認。
3. **起動バーストが支配的**: リクエスト統合、不要な再取得の抑制、指数バックオフ + jitter を検討。無制限のクライアント再試行は避ける。
4. **Realtime が支配的**: まず 2 channel の統合を計測し、次に Postgres Changes から Broadcast への移行を負荷比較する。
5. **直接 DB 利用を追加**: ワークロードごとに専用 DB role と小さな client-side pool を用意し、全サービスの pool 最大値の合計を PostgreSQL の利用可能接続数以下に収める。

## 6. 判断基準と注意点

- 接続上限到達は突然の失敗として現れるため、平均ではなくピークと p95/p99 を見る。
- pooler の `max_client_conn` は「同時に実行できる SQL 数」ではない。
- Auth session、Realtime connection、PostgreSQL connection は別メトリクスで、相互に換算しない。
- 開発用 `config.toml` を変更しても Hosted 本番設定が自動で変わるとは限らない。Dashboard/API 側の本番設定を別途確認する。
- Supabase のプラン別数値は変更され得る。キャパシティ判断時には必ず公式情報と Dashboard の現在値を再確認する。

## 7. 参照資料（公式）

- [Supabase: Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Supavisor](https://supabase.com/docs/guides/database/supavisor)
- [Supabase: Auth Sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase: Realtime Quotas](https://supabase.com/docs/guides/realtime/quotas)
- [Supabase: Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase: Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk)
- [Supabase: Database Reports](https://supabase.com/docs/guides/platform/database-reports)

> 調査時点では実行環境から外部サイトへのアクセスが 401/403 で拒否されたため、公式ページの現行プラン別数値の再取得はできなかった。この文書では変動しやすい絶対値を意図的に固定せず、リポジトリ内の設定・実装から確認できる事実と、公式文書で再確認すべき判断手順を記載した。
