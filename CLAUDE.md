# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

家族・カップル向けの家事タスク共有アプリ。モバイル中心の PWA で、世帯（household）単位でタスク・カテゴリをリアルタイム共有する。UI 言語は日本語固定。

---

## 技術スタック

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| UI | React 19.2.3, Tailwind CSS v4, framer-motion 12, sonner |
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
- `src/lib/supabase/` — レンダリング文脈ごとにクライアントを使い分ける：
  - `client.ts` — Client Component 用（`createBrowserClient`）
  - `server.ts` — Server Component / Route Handler 用（`createServerClient` + cookies）
  - `middleware.ts` — proxy 専用のセッション更新ロジック
  - `service-role.ts` — サービスロールキー用クライアント。`src/app/api/push/send/route.ts` でのみ使用
- `src/lib/date.ts` — `formatDueDate` / `getQuickDate` などの日付ユーティリティ
- `src/lib/validation.ts` — `isValidUrl`（タスク URL の XSS/フィッシング対策バリデーション）
- `src/lib/avatar.ts` — 24 種類の絵文字アバタープリセット（動物・花・食べ物・感情）
- `src/lib/push.ts` — fire-and-forget な Web Push 送信ヘルパ
- `src/app/api/push/` — Web Push の Route Handler。`subscribe/` は購読登録/削除、`send/` は他メンバーへの通知送信。`useTasks` のタスク追加・完了時に呼ばれる。
- `src/app/auth/callback/route.ts` — Supabase OAuth / マジックリンクの code→session 交換。
- `supabase/templates/`, `supabase/snippets/` — Supabase のメール / SQL テンプレート置き場（手動編集対象）。
- `scripts/` — 補助スクリプト用ディレクトリ。
- `.claude/worktrees/` — Claude Code の git worktree 作業領域（gitignore 対象）。

その他の主要ディレクトリ（`src/app`, `src/components`, `src/hooks`, `src/types`）は名前どおり。

---

## アーキテクチャ概要

### データフロー

```
src/app/page.tsx（Client Component）
  ├─ usePageData()        — ユーザー・世帯情報の初期ロード
  ├─ useTasks()           — タスク CRUD + 楽観的更新
  ├─ useCategories()      — カテゴリ CRUD + 並び順管理
  ├─ useRealtimeTasks()   — Supabase Realtime 購読（id dedupe）
  ├─ useSort()            — ソート設定（localStorage 永続化）
  └─ useTaskRecommendations() — 定期タスクレコメンド（RPC）
```

- **楽観的更新**：state を先に更新 → Supabase 呼び出し。エラー時のロールバックは現状未実装（既存パターンに合わせる）。
- **Realtime と楽観的更新の競合**は id ベースの dedupe で解決（`useRealtimeTasks` 参照）。
- **タスク完了時**は `canvas-confetti` でアニメーションを再生し、他メンバーへ Web Push 通知を送信。
- このプロジェクトはほぼ全面 Client Rendering。Server で動くのは `src/app/auth/callback/route.ts`、`src/app/api/push/**/route.ts`、`src/lib/supabase/server.ts`、`src/lib/supabase/middleware.ts`、`src/proxy.ts` のみ。

### 型定義

- `src/types/database.ts` — **手書き禁止・自動生成のみ**（`npx supabase gen types typescript --local`）。
- `src/types/index.ts` — `database.ts` から派生した便利型（`Task`, `TaskWithAssignees`, `TaskRecommendation` など）を export。コード全体はこちら経由でインポートする（`database.ts` を直接 import しない）。

---

## テストインフラ

テストファイルは `src/hooks/*.test.ts` / `src/components/**/*.test.tsx` に配置。

| ファイル | 役割 |
|---|---|
| `src/test/setup.ts` | Vitest グローバルセットアップ。`next/navigation` を自動モック |
| `src/test/mocks/supabase.ts` | `MockQueryChain`（thenable な Supabase クエリチェーンのモック）と `createMockSupabase()` を提供 |

**テスト作成パターン：**

```typescript
// Supabase クライアントはモジュールレベルで vi.mock()
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => createMockSupabase({ /* テーブルごとの返却値 */ }),
}));

// framer-motion, sonner, next/navigation も vi.mock() で差し替える
vi.mock("framer-motion", () => ({ motion: { div: "div" }, AnimatePresence: ({ children }) => children }));

// フックのテストは renderHook + act + waitFor
const { result } = renderHook(() => useCategories("household-id"));
await waitFor(() => expect(result.current.loading).toBe(false));
```

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
| `push_subscriptions` | Web Push 購読情報（profile に紐づく） |
| `dismissed_recommendations` | ユーザーが非表示にしたレコメンドの記録（household_id / profile_id / normalized_title / dismissed_until） |

主要な DB 関数（`supabase.rpc()` で呼べる）：
- `get_my_household_id()` — RLS の無限再帰回避用 SECURITY DEFINER ヘルパ
- `create_default_categories(p_household_id)` — 世帯作成時のデフォルトカテゴリ投入
- `generate_invite_code(p_household_id)` — 6 文字招待コード生成
- `reorder_tasks(p_task_ids, p_sort_orders)` — タスク並び順の一括更新（RLS 対応）
- `handle_new_user()` / `handle_updated_at()` — トリガ関数
- `verify_invite_code(p_code text)` — 招待コード検証（有効期限チェック）
- `get_recurring_recommendations()` — 定期タスクレコメンド取得（引数なし、`get_my_household_id()` で自動スコープ）
- `join_household_with_code(p_code text)` — 招待コード検証 + `profiles.household_id` 更新をアトミックに実行

`tasks` と `categories` は `supabase_realtime` に publish されており、`useRealtimeTasks` が世帯単位で購読する。

### マイグレーション一覧

`supabase/migrations/` 配下に 11 ファイル：

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

---

## 認証フロー（要点）

1. `/signup` → `auth.users` 作成 → トリガで `profiles` 自動生成
2. ログイン後、`src/app/page.tsx` は profile 未作成なら `/login`、`household_id` 未設定なら `/household/new` にリダイレクト
3. proxy（middleware）の認証必須対象外パス：`/login`, `/signup`, `/auth/callback`, `/forgot-password`

---

## docs/ の中身

- `docs/incident-profiles-403.md` — profiles テーブルへの 403 エラーに関する過去インシデント記録（RLS 設計の経緯把握に有用）
- `docs/nonfunctional-roadmap.md` — 非機能要件（パフォーマンス・セキュリティ・運用）のロードマップ
- `docs/performance-analysis.md` — パフォーマンス分析記録（直列クエリ・未ページネーション・バンドルサイズの課題を記録）

ルートにある `plan.md` は機能開発の計画メモ。

---

## ルール参照

詳細なコーディング規約・Supabase 運用ルール・Git ルールは `.claude/rules/` 配下に分割：

- `.claude/rules/coding-rules.md` — TypeScript / コンポーネント設計 / 命名規則
- `.claude/rules/supabase-rules.md` — RLS / マイグレーション / 型生成
- `.claude/rules/git-rules.md` — コミットメッセージ / ブランチ命名

該当する作業時に都度参照すること。
