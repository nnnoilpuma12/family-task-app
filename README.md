# 家族タスクアプリ

家族・カップルでタスクを共有・管理するモバイルファースト PWA。世帯（household）単位でタスク・カテゴリをリアルタイムに共有する。

---

## 技術スタック

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| UI | React 19.2.3 / Tailwind CSS v4 / framer-motion / sonner |
| DnD | @dnd-kit |
| Backend | Supabase（Postgres + Auth + Realtime + Storage） |
| Push | web-push（VAPID） |
| Test | Vitest + Testing Library（happy-dom / jsdom） |
| Lint | ESLint 9 |
| Language | TypeScript 5（strict） |

---

## 前提条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)（Supabase のローカル実行に必要）
- Node.js 20+
- npm

---

## 初回セットアップ（clone 後）

```bash
# 1. リポジトリをクローン
git clone <repo-url>
cd family-task-app

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数ファイルを作成（後述「環境変数」を参照）
touch .env.local

# 4. Docker Desktop を起動後、Supabase を起動
npx supabase start
# → 起動後に表示される anon key を .env.local の NEXT_PUBLIC_SUPABASE_ANON_KEY にコピー

# 5. DB マイグレーション + seed を投入
npx supabase db reset

# 6. 開発サーバーを起動
npm run dev
```

---

## 毎回の起動手順

```bash
# 1. Docker Desktop を起動（GUIから）

# 2. Supabase をローカルで起動
npx supabase start

# 3. 開発サーバーを起動
npm run dev

# 4. ブラウザで開く
# http://localhost:3000
```

---

## 停止手順

```bash
# 開発サーバー: Ctrl+C

# Supabase を停止
npx supabase stop
```

---

## よく使うコマンド

### npm scripts

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動（http://localhost:3000） |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー起動 |
| `npm run lint` | ESLint 実行 |
| `npm test` | Vitest をウォッチモードで実行 |
| `npm run test:run` | Vitest を 1 回だけ実行（CI 用） |
| `npm run test:ui` | Vitest UI を起動 |

### Supabase CLI

| コマンド | 説明 |
|---|---|
| `npx supabase start` | ローカル Supabase 起動 |
| `npx supabase stop` | 停止 |
| `npx supabase status` | 接続情報・anon key を確認 |
| `npx supabase db reset` | DB をリセット（全マイグレーション + seed 再実行） |
| `npx supabase migration new <name>` | 新規マイグレーション作成 |
| `npx supabase gen types typescript --local > src/types/database.ts` | DB 型を再生成 |
| `npx supabase db push` | 本番 Supabase へマイグレーション反映 |

### ローカル Supabase エンドポイント

| 用途 | URL |
|---|---|
| API | http://127.0.0.1:54321 |
| Studio（DB 管理画面） | http://127.0.0.1:54323 |
| Inbucket（メール確認） | http://127.0.0.1:54324 |

---

## テストアカウント（ローカルのみ）

`npx supabase db reset` 実行後、シードデータが投入される。

| Email | Password |
|---|---|
| test@example.com | password |

> ※ ローカル環境専用。本番環境では使用しないこと。

---

## 環境変数

`.env.local` に以下を設定する。Supabase の値は `npx supabase status` で確認できる。

```bash
# Supabase（必須）
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase status の anon key>

# Supabase service role（サーバー側スクリプトで使用する場合）
SUPABASE_SERVICE_ROLE_KEY=<supabase status の service_role key>

# Web Push / VAPID（プッシュ通知を使う場合）
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<VAPID 公開鍵>
VAPID_PRIVATE_KEY=<VAPID 秘密鍵>
VAPID_SUBJECT=mailto:you@example.com
```

VAPID 鍵は `npx web-push generate-vapid-keys` で生成できる。

本番環境では `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を本番プロジェクトの値に差し替える。

---

## ディレクトリ構成

| パス | 役割 |
|---|---|
| `src/app/` | App Router のページ・Route Handler |
| `src/components/` | UI コンポーネント |
| `src/hooks/` | カスタムフック（`useTasks`, `useRealtimeTasks` など） |
| `src/lib/supabase/` | Supabase クライアント（Client / Server / proxy 用に分離） |
| `src/types/` | 型定義（`database.ts` は自動生成、手書き禁止） |
| `src/proxy.ts` | Next.js 16 のリクエストプロキシ（旧 `middleware.ts`） |
| `supabase/migrations/` | DB マイグレーション |
| `supabase/templates/` | Supabase メールテンプレート |
| `scripts/` | 補助スクリプト |
| `docs/` | 設計・インシデント記録 |

詳細な開発ルールは `CLAUDE.md` および `.claude/rules/` を参照。
