# 起動パフォーマンス調査・解析レポート

調査日: 2026-03-18

---

## エグゼクティブサマリー

アプリ起動時にローディングが長く感じられる原因を調査した。最大の問題は **「2段階のローディング遷移」** で、ユーザーがコンテンツを見るまでに「ブランク → スピナー → スケルトン → コンテンツ」と3回の画面遷移が発生している。

本PRでは最も体感インパクトの大きい「フルスクリーンスピナーの廃止」とプログレッシブスケルトンへの置き換えを実施した。残りのボトルネックは優先度付きで後述する。

---

## 現状のローディングシーケンス（改善前）

```
t=0ms     ページアクセス
          │
          ▼
          [ブランク画面]
          │
          ▼ (JS バンドルダウンロード・パース)
          [フルスクリーンスピナー] ← page.tsx:87-93 で loading=true の間表示
          │
          │ auth.getUser()       ← ネットワーク往復 #1 (Supabase Auth)
          │   ↓
          │ profiles SELECT      ← ネットワーク往復 #2 (DB クエリ)
          │   ↓ loading=false
          ▼
          [タスクリストスケルトン] ← householdId が確定してから開始
          │
          │ tasks SELECT         ┐
          │ categories SELECT    ├ 並列実行
          │ recommendations RPC  ┘ ← ネットワーク往復 #3
          │   ↓ tasksLoading=false
          ▼
          [コンテンツ完全表示]
```

**遷移回数: 3回（スピナー→スケルトン→コンテンツ）**

---

## 改善後のローディングシーケンス

```
t=0ms     ページアクセス
          │
          ▼ (JS バンドルダウンロード・パース)
          [ページ骨格をスケルトンで即時表示]
          ヘッダー: タイトルスケルトン + アバタースケルトン
          タブ:     カテゴリスケルトン（パルスアニメ）
          本文:     TaskListSkeleton（既存）
          │
          │ auth.getUser() + profiles SELECT ← バックグラウンドで実行
          │   ↓ profile 確定
          │ ヘッダーが実データに切り替わる
          │
          │ tasks / categories / recommendations ← 並列フェッチ
          │   ↓ tasksLoading=false
          ▼
          [コンテンツ完全表示]
```

**遷移回数: 1回（スケルトン→コンテンツ）**

---

## ボトルネック詳細

### 🔴 Critical（本PRで対応済み）

#### 1. フルスクリーンスピナーによる2段階ローディング

**ファイル:** `src/app/page.tsx:87-93`

```tsx
// 問題のコード（改善前）
if (loading) {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  );
}
```

**原因:**
- `usePageData` の `loading` が `true` の間（`auth.getUser()` + `profiles` フェッチ完了まで）、ページ全体がスピナー1つだけになる
- この間に `useTasks` / `useCategories` のフェッチも開始できない（`householdId` が `null` のため）
- スピナーが消えてから初めてタスクスケルトンが出る → 2段階遷移が発生

**対処:** スピナーを廃止し、ページ構造を即時描画（スケルトン表示）するよう変更。

---

### 🟠 High（今後対応推奨）

#### 2. `auth.getUser()` → `profiles` フェッチが直列

**ファイル:** `src/hooks/use-page-data.ts:36-50`

```ts
// auth.getUser() が完了するまで profiles の SELECT が発行できない
const { data: { user } } = await supabase.auth.getUser();  // 往復 #1
// ↓ user.id が必要なため直列は構造上不可避
const { data: profileData } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .maybeSingle();  // 往復 #2
```

**影響:** 2回の独立したネットワーク往復が直列実行される。`auth.getUser()` はサーバーに認証トークンを検証しに行くため、レイテンシが高い。

**対処案:**
- `supabase.auth.getSession()` はローカルキャッシュから取得できるため、`profiles` フェッチの先行開始が可能
- ただし `getSession()` はJWT検証をスキップするため、Supabase公式ドキュメントでは **セキュリティ上 `getUser()` を推奨**。サーバーサイド認証チェック（middleware）がある場合はクライアント側を `getSession()` に切り替える選択肢あり

#### 3. ページ遷移のたびに全データを再フェッチ（キャッシュなし）

**ファイル:** `src/hooks/use-tasks.ts:30-32`, `src/hooks/use-categories.ts:26-28`

```ts
useEffect(() => {
  fetchTasks();  // 毎回フルリフェッチ（ホーム↔設定の往復でも）
}, [fetchTasks]);
```

**影響:** 設定ページからホームに戻るたびに全タスク・カテゴリを再取得。`useMemo` や `useCallback` による最適化はあるが、React状態はアンマウント時に破棄されるためデータは残らない。

**対処案:** React Query (`@tanstack/react-query`) または SWR を導入し、stale-while-revalidate キャッシュ戦略を適用する。

#### 4. メンバー・世帯名がfire-and-forget取得 → ヘッダーCLS

**ファイル:** `src/hooks/use-page-data.ts:101-119`

```ts
// ホーム画面では members と household 名をバックグラウンドで取得
supabase.from("profiles").select("*").eq("household_id", p.household_id)
  .then(({ data }) => { if (data) setMembers(data); });  // 後から追加

supabase.from("households").select("name").eq("id", p.household_id)
  .single().then(({ data }) => {
    if (data?.name) setHouseholdName(data.name);  // 後から上書き
  });
```

**影響:**
- ヘッダーに「家族タスク」（デフォルト値）が表示 → 数百ms後に実際の世帯名に書き換わる
- アバターエリアが空 → 後から出現 → Cumulative Layout Shift (CLS) が発生

**対処案:** `profile` フェッチと同じ `Promise.all` に含め、`loading=false` になる前に世帯名・メンバーを確定させる（現在 `fetchHousehold=true` の場合のみ並列フェッチになっている）。

---

### 🟡 Medium（中期的に対応推奨）

#### 5. 全タスクをページネーションなしで一括取得

**ファイル:** `src/hooks/use-tasks.ts:17-23`

```ts
const { data } = await supabase
  .from("tasks")
  .select("*")        // 全カラム取得
  .eq("household_id", householdId)
  .order("is_done")
  .order("sort_order")
  .order("created_at", { ascending: false });  // ソート3段階
```

**影響:** タスクが増えるほどレスポンスサイズとレンダリングコストが線形増加。`.select("*")` は不要なカラムも含む。

**対処案:** `.select("id,title,is_done,sort_order,due_date,category_id,created_by,created_at")` で必要カラムを絞り、`.limit(100)` を追加。完了済みタスクは別途遅延ロード。

#### 6. 重いライブラリが初期バンドルに含まれる

**ファイル:** `src/components/task/task-list.tsx:4`, `src/components/task/task-item.tsx`

```ts
import { AnimatePresence, motion } from "framer-motion";  // ~29KB gzip
// @dnd-kit/* も全コンポーネントで静的インポート (~50KB combined)
```

**影響:** ホーム画面の初期バンドルにアニメーション・DnDライブラリが含まれ、パースに時間がかかる。`canvas-confetti` は動的インポート済み（✅ 問題なし）。

**対処案:** `next/dynamic` で `TaskList` ごと遅延ロード（スケルトン表示中に並列でバンドルダウンロード）。

```ts
// src/app/page.tsx
const TaskList = dynamic(
  () => import("@/components/task/task-list").then(m => m.TaskList),
  { loading: () => <TaskListSkeleton /> }
);
```

#### 7. Supabase クライアントが複数インスタンス生成

**ファイル:** 各フック

```ts
// use-tasks.ts:10
const supabase = useMemo(() => createClient(), []);
// use-categories.ts:9
const supabase = useMemo(() => createClient(), []);
// use-realtime-tasks.ts:14 ← メモ化なし
const supabase = createClient();
// use-page-data.ts:35 ← useEffect 内で毎回生成
const supabase = createClient();
```

**影響:** Supabase は内部でシングルトン管理しているため WebSocket 重複は回避されるが、設計上冗長。`use-realtime-tasks` と `use-page-data` はメモ化されていない。

**対処案:** `src/lib/supabase/client.ts` でモジュールレベルのシングルトンを提供し、全フックで共有する。

---

### ⚪ Low（余裕があれば対応）

#### 8. フォント読み込みに `display: 'swap'` なし

**ファイル:** `src/app/layout.tsx:7-15`

```ts
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // display: 'swap' が未指定
});
```

**影響:** フォントファイル取得中にテキストが不可視になる可能性（FOIT: Flash of Invisible Text）。

**対処案:** `display: 'swap'` を追加。Next.js の `next/font` は通常デフォルトで `swap` を使うが、明示指定が推奨。

---

## 本PRで実施した改善

| 変更 | ファイル | 効果 |
|---|---|---|
| フルスクリーンスピナー廃止 | `src/app/page.tsx` | ローディング遷移を3回→1回に削減 |
| ヘッダースケルトン追加 | `src/app/page.tsx` | データ確定前も構造が見える |
| カテゴリタブスケルトン追加 | `src/components/category/category-tabs.tsx` | タブ領域の高さ崩れを防止 |

---

## 今後の改善ロードマップ（優先順）

1. **[High]** `use-page-data`: メンバー・世帯名を `loading` 前に確定させCLSを解消
2. **[High]** React Query / SWR 導入：ページ遷移時のキャッシュ活用
3. **[Medium]** `TaskList` を `next/dynamic` で遅延ロード
4. **[Medium]** タスク取得カラム絞り込み + ページネーション（`limit`）
5. **[Medium]** Supabase クライアントをシングルトン化
6. **[Low]** フォント `display: 'swap'` 明示化
