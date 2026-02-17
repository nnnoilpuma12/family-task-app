# 家族タスクアプリ

家族でタスクを共有・管理するモバイルファーストWebアプリ。

## 前提条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Supabase のローカル実行に必要)
- Node.js 20+
- npm

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

## 初回セットアップ（clone 後）

```bash
# 1. リポジトリをクローン
git clone <repo-url>
cd family-task-app

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数ファイルを作成
cp .env.local.example .env.local

# 4. Docker Desktop を起動後、Supabase を起動
npx supabase start
# → 起動後に表示される "anon key" を .env.local の NEXT_PUBLIC_SUPABASE_ANON_KEY にコピー

# 5. DBマイグレーションを実行（初回のみ）
npx supabase db reset

# 6. 開発サーバーを起動
npm run dev
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

| コマンド | 説明 |
|---|---|
| `npx supabase start` | Supabase ローカル起動 |
| `npx supabase stop` | Supabase 停止 |
| `npx supabase status` | 接続情報・ANON_KEY を確認 |
| `npx supabase db reset` | DBをリセット＆マイグレーション再実行 |
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |

**Supabase Studio（DB管理画面）**: http://localhost:54323

---

## テストアカウント（ローカルのみ）

`npx supabase db reset` 実行後、シードデータが投入されます。

| Email | Password |
|---|---|
| test@example.com | password |

> ※ ローカル環境専用。本番環境では使用しないこと。

---

## 環境変数

`.env.local.example` を参照してください。`npx supabase status` で表示される値を使います。
