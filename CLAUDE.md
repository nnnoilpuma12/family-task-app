# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

家族・カップル向けの家事タスク共有アプリ。モバイル中心の PWA で、世帯（household）単位でタスク・カテゴリ・定番品をリアルタイム共有する。UI 言語は日本語固定。

---

## 技術スタック

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| UI | React 19.2.3, Tailwind CSS v4, framer-motion 12, sonner |
| Data fetching | @tanstack/react-query 5 + query-sync-storage-persister / react-query-persist-client（キャッシュを localStorage に永続化） |
| DnD | @dnd-kit/core 6 / sortable 10 / utilities 3 |
| Icons | lucide-react |
| Backend | Supabase (`@supabase/ssr` 0.8, `supabase-js` 2.95) — Postgres + Auth + Realtime + Storage |
| Push | web-push 3.6（VAPID） |
| Language | TypeScript 5（strict） |
| Lint | ESLint 9 + eslint-config-next |
| Test | Vitest 2 + React Testing Library（happy-dom 環境） |
| Pkg Manager | npm |

---

## よく使うコマンド

```bash
npm run dev          # Next.js 開発サーバー（http://localhost:3000）
npm run build        # 本番ビルド
npm run start        # 本番サーバー
npm run lint         # ESLint
npm test             # Vitest（watch モード）
npm run test:run     # Vitest（単発実行・CI 用）
npm run test:ui      # Vitest UI ダッシュボード（ブラウザで結果確認）

# 特定ファイルのみテスト実行
npx vitest run src/hooks/use-tasks.test.ts

node scripts/generate-icons.mjs   # PWA アイコン一式を再生成

npx supabase start   # ローカル Supabase 起動（要 Docker Desktop）
npx supabase stop    # 停止
npx supabase db reset                           # マイグレーション全適用 + seed
npx supabase migration new <name>               # 新規マイグレーション
npx supabase gen types typescript --local > src/types/database.ts  # 型再生成
npx supabase db push                            # 本番 Supabase へ反映
```

ローカル Supabase の URL：
- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Inbucket（メール確認）: `http://127.0.0.1:54324`

ローカル seed 投入後のテストアカウント：`test@example.com` / `password`

---

## ディレクトリ構成の補足

コードから自明でないものだけ：

- `src/proxy.ts` — **Next.js 16 で `middleware.ts` から改名されたエントリポイント**。`async function proxy(request)` を export する（`middleware` ではない）。中身は `src/lib/supabase/middleware.ts` の `updateSession` に委譲し、セッション更新と未認証リダイレクトを担当。
- `src/app/providers.tsx` — `PersistQueryClientProvider` をマウントする Client ラッパ。`layout.tsx` が `<Providers>` で全ページを包む。`QueryClient` は `useState` の初期化関数で一度だけ生成（リクエスト/レンダ間で共有しない）。`staleTime: 30s` / `gcTime: 24h`（永続化の必須条件 `gcTime >= maxAge`）/ `retry: 1` / `refetchOnWindowFocus`。永続化は成功したクエリのみ dehydrate する。
- `src/app/layout.tsx` — ルートレイアウト。`ServiceWorkerRegister` / `Toaster`（sonner）/ `Providers` をマウント。PWA メタデータ・アイコン・viewport もここ。
- `src/lib/supabase/` — レンダリング文脈ごとにクライアントを使い分ける：
  - `client.ts` — Client Component 用（`createBrowserClient`）
  - `server.ts` — Server Component / Route Handler 用（`createServerClient` + cookies）
  - `middleware.ts` — proxy 専用のセッション更新ロジック
  - `service-role.ts` — サービスロールキー用クライアント。`src/app/api/push/send/route.ts` でのみ使用
- `src/lib/query-keys.ts` — React Query のキー定義を一元化（`queryKeys.tasks / categories / stapleItems`、いずれも `householdId` でスコープ）。フックは必ずこれを経由してキーを組み立てる。
- `src/lib/query-persist.ts` — React Query キャッシュの localStorage 永続化設定を一元化。`createAppPersister()` / `clearPersistedQueryCache()` / `APP_CACHE_VERSION` を export。**DB スキーマや型を変えてキャッシュ互換が崩れるときは `APP_CACHE_VERSION` を上げて旧キャッシュを無効化する**。
- `src/lib/household-cache.ts` — 直近の世帯 id / 名前を localStorage にキャッシュする軽量ヘルパ。起動時に `householdId` を即座に得て、profiles 取得を待たずにデータ取得を並列発火させるためのもの（後述「起動フロー」）。
- `src/lib/date.ts` — `formatDueDate` / `getQuickDate` などの日付ユーティリティ
- `src/lib/validation.ts` — `isValidUrl`（タスク URL の XSS/フィッシング対策バリデーション）
- `src/lib/avatar.ts` — 24 種類の絵文字アバタープリセット（動物・花・食べ物・感情）
- `src/lib/push.ts` — fire-and-forget な Web Push 送信ヘルパ
- `src/lib/idle.ts` — `runWhenIdle`。`requestIdleCallback`（非対応時は `setTimeout`）で重い非クリティカルな取得をアイドル時に逃がす。`useTitleSuggestions` で使用。
- `src/app/api/push/` — Web Push の Route Handler。`subscribe/` は購読登録/削除、`send/` は他メンバーへの通知送信。`useTasks` のタスク追加・完了時に呼ばれる。
- `src/app/auth/callback/route.ts` — Supabase OAuth / マジックリンクの code→session 交換。
- `src/app/error.tsx` / `global-error.tsx` / `not-found.tsx` — App Router のエラー・404 境界。
- `src/components/ServiceWorkerRegister.tsx` — `public/sw.js` を登録する Client コンポーネント。
- `scripts/generate-icons.mjs` — PWA アイコン（favicon / icon-*.png / apple-touch-icon）生成スクリプト。
- `supabase/templates/`, `supabase/snippets/` — Supabase のメール / SQL テンプレート置き場（手動編集対象）。
- `.claude/worktrees/` — Claude Code の git worktree 作業領域（gitignore 対象）。

その他の主要ディレクトリ（`src/app`, `src/components`, `src/hooks`, `src/types`）は名前どおり。コンポーネントは機能ごとにサブディレクトリへ分割されている（`auth/`, `category/`, `household/`, `recommendation/`, `settings/`, `staple/`, `task/`, `ui/`）。

---

## アーキテクチャ概要

### データフロー

```
src/app/page.tsx（Client Component）
  ├─ usePageData()             — ユーザー・世帯・メンバー情報の初期ロード
  ├─ useTasks()                — タスク CRUD + 楽観的更新（React Query キャッシュ）
  ├─ useCategories()           — カテゴリ CRUD + 並び順管理（React Query）
  ├─ useStapleItems()          — 定番品 CRUD + 並び順管理（React Query）
  ├─ useRealtimeTasks()        — Supabase Realtime 購読（id dedupe）
  ├─ useRealtimeStapleItems()  — 定番品の Realtime 購読
  ├─ useSort()                 — ソート設定（localStorage 永続化）
  ├─ useSwipeableTab()         — カテゴリタブの横スワイプ ↔ タブ選択の同期
  ├─ useTaskRecommendations()  — 定期タスクレコメンド（RPC）
  └─ useTitleSuggestions()     — 過去タイトルからの入力サジェスト（アイドル時取得）
```

- **サーバーステートは React Query が保持**。`useTasks` / `useCategories` / `useStapleItems` は `useQuery` でフェッチし、キャッシュは `queryClient.setQueryData(queryKeys.xxx(householdId), ...)` で直接書き換える。ページ遷移で戻ってきたときの再取得を避けるのが目的。キャッシュは localStorage に永続化され（`src/lib/query-persist.ts`）、再訪時は即時表示 → 裏で再検証となる。
- **起動フロー（並列化）**：`page.tsx` はマウント直後に `getCachedHouseholdId()`（localStorage）を読み、`householdId = profile?.household_id ?? cachedHouseholdId` として tasks / categories / staple / Realtime を profiles 取得を待たずに並列発火させる。profile 確定後はそちらが正となり、世帯が変わればキー変更で自動再取得される。`usePageData` はネットワーク往復のない `getSession()` を使う（サーバ側検証は middleware 済み）。詳細は `docs/startup-flow.md`。
- **キャッシュのクリア境界**：別ユーザー / 別世帯に切り替わる箇所（ログアウト＝`settings/page.tsx`、世帯参加＝`household/join-form.tsx`）では `clearCachedHousehold()` と `clearPersistedQueryCache()` を必ず呼び、端末に前世帯のデータを残さない。
- **楽観的更新**：`setQueryData` でキャッシュを先に更新 → Supabase 呼び出し。`useCategories` などはエラー時にスナップショットへロールバックする（既存パターンに合わせる）。
- **Realtime と楽観的更新の競合**は id ベースの dedupe で解決（`useRealtimeTasks` / `useRealtimeStapleItems` 参照）。
- **完了済みタスクは段階ロード**。初期は未完了 + 直近の完了のみ表示し、`loadMoreCompleted()`（`COMPLETED_PAGE_SIZE = 30`）で追加取得する。
- **タスク完了時**は `canvas-confetti` でアニメーションを再生し、他メンバーへ Web Push 通知を送信。
- **起動バンドル削減**：重いシート/モーダル（`TaskCreateSheet` / `TaskDetailModal` / `StapleItemsSheet`）は `next/dynamic`（`ssr: false`）で初回オープン時に遅延ロードし、以降はマウントを維持して閉じるアニメを保つ。
- このプロジェクトはほぼ全面 Client Rendering。Server で動くのは `src/app/auth/callback/route.ts`、`src/app/api/push/**/route.ts`、`src/lib/supabase/server.ts`、`src/lib/supabase/middleware.ts`、`src/proxy.ts` のみ。

### 主要機能

- **タスク共有**（買い物リスト・家事）：CRUD、担当割り当て、期日、メモ、URL、画像、並び替え（DnD）、完了アニメ。
- **カテゴリ**：世帯ごとのタブ。横スワイプで切り替え（`useSwipeableTab`）。
- **定番品（staple items）**：世帯ごとの「いつもの品」マスタ。ワンタップでタスク（買い物リスト）へ追加。`use_count` / `last_used_at` で使用頻度を記録し、よく使う順に並べられる。
- **定期タスクレコメンド**：完了履歴から周期を推定し、再追加を提案（`get_recurring_recommendations` RPC）。非表示は `dismissed_recommendations` に記録。
- **Web Push 通知**：タスク追加・完了時に他メンバーへ送信。

### 型定義

- `src/types/database.ts` — **手書き禁止・自動生成のみ**（`npx supabase gen types typescript --local`）。
- `src/types/index.ts` — `database.ts` から派生した便利型（`Task`, `TaskWithAssignees`, `StapleItem`, `TaskRecommendation` など）を export。コード全体はこちら経由でインポートする（`database.ts` を直接 import しない）。

---

## テストインフラ

テストファイルは `src/hooks/*.test.ts` / `src/components/**/*.test.tsx` / `src/lib/*.test.ts` に配置。

| ファイル | 役割 |
|---|---|
| `src/test/setup.ts` | Vitest グローバルセットアップ。`next/navigation` を自動モック |
| `src/test/mocks/supabase.ts` | `MockQueryChain`（thenable な Supabase クエリチェーンのモック）と `createMockSupabase()` を提供 |
| `src/test/query-wrapper.tsx` | `createQueryWrapper()`。テストごとに独立した `QueryClient`（`retry: false` / `gcTime: 0`）を持つ React Query ラッパを生成 |

**テスト作成パターン：**

```typescript
// Supabase クライアントはモジュールレベルで vi.mock()
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => createMockSupabase({ /* テーブルごとの返却値 */ }),
}));

// framer-motion, sonner, next/navigation も vi.mock() で差し替える
vi.mock("framer-motion", () => ({ motion: { div: "div" }, AnimatePresence: ({ children }) => children }));

// React Query を使うフックは createQueryWrapper() を renderHook の wrapper に渡す
const { result } = renderHook(() => useStapleItems("household-id"), {
  wrapper: createQueryWrapper(),
});
await waitFor(() => expect(result.current.loading).toBe(false));
```

> React Query を使うフック（`useTasks` / `useCategories` / `useStapleItems`）のテストは **必ず `createQueryWrapper()` を wrapper に渡す**こと。渡さないと `QueryClient` が見つからず失敗する。

---

## Supabase 構成

### 環境切り替え

`.env.local` の `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を差し替えることでローカル⇄本番を切り替える。

- **ローカル**: `npx supabase start` 出力の anon key を `.env.local` に入れる（URL は `http://127.0.0.1:54321`）。
- **本番**: 本番プロジェクトの URL / anon key を入れる。マイグレーション反映は `npx supabase db push`。

Web Push を扱うため `.env.local` に以下も必要：
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...        # サーバーサイドのみ
VAPID_SUBJECT=mailto:...
```

### スキーマ概要

すべて `household_id` でスコープされ、RLS でアクセス制御される。

| Table | 役割 |
|---|---|
| `households` | 世帯グループ。24時間有効の招待コードを持つ |
| `profiles` | `auth.users` と 1:1。`household_id`, `nickname`, `avatar_url` |
| `categories` | 世帯ごとのカテゴリ（name/color/icon/sort_order） |
| `tasks` | タスク本体（title/memo/url/due_date/is_done/sort_order/completed_at） |
| `task_assignees` | tasks ↔ profiles の N:N |
| `task_images` | タスク画像の Storage パス |
| `staple_items` | 定番品マスタ（name/category_id/default_quantity/default_unit/note/icon/sort_order/use_count/last_used_at） |
| `push_subscriptions` | Web Push 購読情報（profile に紐づく） |
| `dismissed_recommendations` | ユーザーが非表示にしたレコメンドの記録（household_id / profile_id / normalized_title / dismissed_until） |

主要な DB 関数（`supabase.rpc()` で呼べる）：
- `get_my_household_id()` — RLS の無限再帰回避用 SECURITY DEFINER ヘルパ
- `create_default_categories(p_household_id)` — 世帯作成時のデフォルトカテゴリ投入
- `create_household_with_defaults(p_name text)` — **世帯の新規作成はこの RPC のみ**。households 作成・profile 紐付け・デフォルトカテゴリ・招待コード発行をアトミックに実行（SECURITY DEFINER で RLS バイパス）
- `generate_invite_code(p_household_id)` — 6 文字招待コード生成（`extensions.gen_random_bytes` を完全修飾）
- `reorder_tasks(p_task_ids, p_sort_orders)` — タスク並び順の一括更新（RLS 対応）
- `reorder_staple_items(p_item_ids, p_sort_orders)` — 定番品並び順の一括更新（RLS 対応）
- `handle_new_user()` / `handle_updated_at()` — トリガ関数
- `verify_invite_code(p_code text)` — 招待コード検証（有効期限チェック）
- `get_recurring_recommendations()` — 定期タスクレコメンド取得（引数なし、`get_my_household_id()` で自動スコープ）
- `join_household_with_code(p_code text)` — 招待コード検証 + `profiles.household_id` 更新をアトミックに実行（**世帯参加はこの RPC のみ**）

`tasks` / `categories` / `staple_items` は `supabase_realtime` に publish されており、対応する Realtime フックが世帯単位で購読する。

> **セキュリティ注意**：`profiles` の UPDATE ポリシーは `WITH CHECK` で `household_id` の直接書き換えを禁止している（013）。世帯の参加・作成は必ず RPC（`join_household_with_code` / `create_household_with_defaults`）経由で行うこと。`profiles` を直接 UPDATE して世帯を移動させてはいけない。

### マイグレーション一覧

`supabase/migrations/` 配下に 14 ファイル：

1. `001_initial_schema.sql` — 全スキーマ + RLS + トリガ + 関数
2. `002_add_profiles_insert_policy.sql`
3. `003_push_subscriptions.sql`
4. `004_reorder_tasks_rpc.sql`
5. `005_strengthen_invite_code.sql`
6. `006_add_length_constraints.sql`
7. `007_security_hardening.sql`
8. `008_security_and_performance_fixes.sql`
9. `009_tasks_replica_identity_full.sql`
10. `010_recurring_recommendations.sql` — `dismissed_recommendations` テーブル追加、`get_recurring_recommendations` RPC 新設
11. `011_restore_rpc_auth_checks.sql` — RPC 認可チェック復元、`get_recurring_recommendations` を引数なしに再定義、`join_household_with_code` RPC 新設
12. `012_staple_items.sql` — `staple_items` テーブル + RLS + Realtime publish、`reorder_staple_items` RPC 新設
13. `013_lock_profile_household_update.sql` — `profiles` UPDATE に `WITH CHECK` を追加し household_id 直接変更を禁止、`create_household_with_defaults` RPC 新設
14. `014_fix_invite_code_extensions_schema.sql` — 招待コード生成 RPC の `gen_random_bytes` を `extensions` スキーマで完全修飾（再発行失敗の修正）

---

## 認証フロー（要点）

1. `/signup` → `auth.users` 作成 → トリガで `profiles` 自動生成
2. ログイン後、`src/app/page.tsx` は profile 未作成なら `/login`、`household_id` 未設定なら `/household/new` にリダイレクト
3. 世帯作成は `/household/new`（`create_household_with_defaults` RPC）、参加は `/household/join`（`join_household_with_code` RPC）
4. proxy（middleware）の認証必須対象外パス：`/login`, `/signup`, `/auth/callback`, `/forgot-password`

---

## docs/ の中身

- `docs/incident-profiles-403.md` — profiles テーブルへの 403 エラーに関する過去インシデント記録（RLS 設計の経緯把握に有用）
- `docs/nonfunctional-roadmap.md` — 非機能要件（パフォーマンス・セキュリティ・運用）のロードマップ
- `docs/performance-analysis.md` — パフォーマンス分析記録（直列クエリ・未ページネーション・バンドルサイズの課題を記録）
- `docs/startup-flow.md` — アプリ起動〜初回描画のシーケンス図（householdId キャッシュによる並列化の対応前後を Mermaid で図解）

ルートにある `plan.md` は機能開発の計画メモ、`DESIGN.md` は Notion 風デザインシステムの詳細ドキュメント（カラー・タイポグラフィ・コンポーネントスタイルの参照元）。

---

## ルール参照

詳細なコーディング規約・Supabase 運用ルール・Git ルールは `.claude/rules/` 配下に分割：

- `.claude/rules/coding-rules.md` — TypeScript / コンポーネント設計 / 命名規則
- `.claude/rules/supabase-rules.md` — RLS / マイグレーション / 型生成
- `.claude/rules/git-rules.md` — コミットメッセージ / ブランチ命名

該当する作業時に都度参照すること。
