# Coding Rules

> 参照タイミング：TypeScript / React コンポーネント / フック / 型定義を新規作成・編集するとき。

---

## TypeScript 型安全

- **`any` 型は禁止**。外部ライブラリの戻り値が `any` の場合も、最小限の型を定義してから扱う。やむを得ず使う場合は `// eslint-disable-next-line` と理由コメントを必ず添える。
- **型アサーション（`as`）は原則禁止**。例外は以下のみ：
  - `as const`（リテラル型固定）
  - `unknown` からのナローイング（型ガード経由が望ましい）
  - DOM API の `as HTMLElement` 系で他に手段がない場合
- **`as any` / `as unknown as T` は完全禁止**。型が合わないなら設計を見直す。
- **non-null assertion（`!`）は禁止**。`if` ガードか optional chaining (`?.`) を使う。
- **`@ts-ignore` / `@ts-expect-error` は使用前に必ず理由コメントを書く**。`@ts-expect-error` を優先（不要になったら検出される）。
- DB 関連の型は **必ず `@/types` 経由でインポート**。`@/types/database` を直接 import しない。
- Supabase の戻り値 `{ data, error }` は分割代入し、`data` を参照する前に `error` または `data == null` をチェック。

---

## コンポーネント設計

### Server / Client Component の使い分け

このプロジェクトはほぼ全面 Client Rendering。原則：

- **Client Component（`"use client"`）がデフォルト**。`src/components/` 配下、`src/app/` 配下のページ、フックを使うものはすべて Client。
- **Server で動くのは以下のみ**：
  - `src/app/auth/callback/route.ts`（OAuth コールバック Route Handler）
  - `src/app/api/push/**/route.ts`（Web Push の Route Handler）
  - `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
  - `src/proxy.ts`
- **Supabase クライアントの使い分けを厳守**：
  - Client Component → `@/lib/supabase/client` の `createClient()`
  - Server Component / Route Handler → `@/lib/supabase/server` の `createClient()`
  - 取り違えるとセッションが取れない / cookie が読めない

### 構造

- ロジックは可能な限りカスタムフック（`src/hooks/`）に切り出す。コンポーネント本体は表示と props 受け渡しに専念。
- 楽観的更新（optimistic update）は既存パターンに合わせる：state を先に更新 → Supabase 呼び出し → エラー時のロールバックは現状未実装で OK（既存挙動に揃える）。
- Realtime と楽観的更新の競合は **id ベースの dedupe** で解決（`useRealtimeTasks` 参照）。
- エラー表示は現状 silent。新規追加で例外的にユーザーに見せる必要があるときだけ `sonner` のトーストを使う。

---

## 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| ファイル名（コンポーネント） | kebab-case | `task-item.tsx`, `bottom-sheet.tsx` |
| ファイル名（フック） | kebab-case + `use-` 接頭辞 | `use-tasks.ts`, `use-realtime-tasks.ts` |
| React コンポーネント | PascalCase | `TaskItem`, `BottomSheet` |
| フック関数 | camelCase + `use` 接頭辞 | `useTasks`, `useCategories` |
| 変数 / 関数 | camelCase | `addTask`, `householdId` |
| 型 / interface | PascalCase | `Task`, `TaskWithAssignees` |
| 定数（モジュールレベル） | UPPER_SNAKE_CASE | `MAX_TITLE_LENGTH` |
| boolean | `is` / `has` / `can` 接頭辞 | `isDone`, `hasError` |

- import は **常に `@/` エイリアス**を使う。相対パス（`../../`）禁止。
- ディレクトリ名は kebab-case。

---

## UI / 文言

- **すべての user-visible 文字列は日本語**。英語での新規追加禁止。
- 既存のカラー / 余白 / コンポーネント（`src/components/ui/`）を再利用。新しい色を ad-hoc に追加しない。
- `min-h-screen` ではなく `min-h-dvh` を使う（モバイル safe-area 対応）。

---

## 禁止事項まとめ

- `any`、`as any`、`!`（non-null assertion）
- 相対 path import（`../`）
- Server / Client クライアントの取り違え
- 英語 UI 文字列の新規追加
- `console.log` の本番コミット（デバッグ用は削除すること）
