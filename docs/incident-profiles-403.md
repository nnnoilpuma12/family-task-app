# インシデント記録: profiles テーブルへの 403 Forbidden エラー

**発生日:** 2026-02-18
**解決日:** 2026-02-18
**影響範囲:** 本番環境 — 一部ユーザーでホームページが表示されない（スピナーが回り続ける）

---

## 症状

本番環境でホームページを読み込むと、以下のエラーがコンソールに表示される:

```
POST /rest/v1/profiles?select=* 403 (Forbidden)
```

タスク一覧が取得できず、画面はローディングスピナーのまま止まる。

---

## 調査の流れ

### 1. エラーの特定

ブラウザの DevTools で確認したところ、Supabase の `profiles` テーブルへの POST リクエストが `403 Forbidden` で拒否されていた。

### 2. 該当コードの確認

`src/app/page.tsx` にプロフィールのフォールバック処理があった:

```typescript
// プロフィールが存在しない場合、upsert で作成を試みる
const { data: profile } = await supabase
  .from('profiles')
  .upsert({ id: user.id, display_name: user.email })
  .select()
  .single();
```

通常、プロフィールは Supabase の `handle_new_user()` トリガー（`SECURITY DEFINER` で RLS をバイパス）によってサインアップ時に自動作成される。しかし何らかの理由（トリガー未実行、タイミング問題等）でプロフィールが存在しない場合、このフォールバックがクライアント側から実行される。

### 3. RLS ポリシーの確認

`supabase/migrations/001_initial_schema.sql` の `profiles` テーブルに設定されていた RLS ポリシー:

| 操作 | ポリシー | 条件 |
|------|----------|------|
| SELECT | あり | `id = auth.uid() OR household_id = get_my_household_id()` |
| UPDATE | あり | `auth.uid() = id` |
| **INSERT** | **なし** | — |

**INSERT ポリシーが存在しなかった。**

Supabase は RLS が有効なテーブルに対して、該当操作のポリシーがない場合、すべてのリクエストを拒否する。つまり `upsert`（内部的に INSERT を含む）は必ず 403 になる。

---

## 根本原因

`profiles` テーブルの Row Level Security (RLS) に **INSERT ポリシーが定義されていなかった**。

初期マイグレーションで SELECT と UPDATE のポリシーは定義されていたが、INSERT ポリシーが漏れていた。通常は `SECURITY DEFINER` トリガーが RLS をバイパスしてプロフィールを作成するため問題にならないが、トリガーが実行されなかったケースでフォールバック処理が 403 で失敗していた。

---

## 修正内容

### マイグレーション追加

`supabase/migrations/002_add_profiles_insert_policy.sql`:

```sql
-- profiles テーブルに INSERT ポリシーを追加
-- ユーザーは自分自身のプロフィールのみ作成可能
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
```

`auth.uid() = id` の条件により、ユーザーは自分自身のプロフィールのみ作成可能。他人のプロフィールを作成することはできない。

---

## 学び・教訓

### 1. RLS は「許可がなければ拒否」がデフォルト
Supabase（PostgreSQL）の RLS は、ポリシーが存在しない操作に対してすべてのリクエストを拒否する。SELECT/UPDATE だけでなく、INSERT/DELETE も含めて必要なポリシーをすべて定義する必要がある。

### 2. トリガーに依存する設計のリスク
`SECURITY DEFINER` トリガーで RLS をバイパスする設計は便利だが、トリガーが実行されなかった場合のフォールバックパスも考慮すべき。フォールバック処理がクライアント側で実行される場合、対応する RLS ポリシーが必要になる。

### 3. 403 と 401 の違いに注意
- **401 Unauthorized**: 認証されていない（トークンがない・無効）
- **403 Forbidden**: 認証はされているが、権限がない（RLS ポリシーで拒否）

今回は認証済みユーザーが正しいトークンでリクエストしていたため 403 だった。RLS ポリシーの不備を疑うべきシグナル。

### 4. Supabase ダッシュボードで確認できる
Supabase ダッシュボード > Authentication > Policies で、各テーブルの RLS ポリシーを視覚的に確認できる。新しいテーブルを作成したら、必要な操作（SELECT/INSERT/UPDATE/DELETE）すべてにポリシーがあるか確認する習慣をつけると良い。

---

## タイムライン

| 時刻 | アクション |
|------|-----------|
| 調査開始 | ブラウザ DevTools で 403 エラーを確認 |
| 原因特定 | `profiles` テーブルの RLS に INSERT ポリシーがないことを発見 |
| 修正実装 | マイグレーションファイル `002_add_profiles_insert_policy.sql` を作成 |
| デプロイ | `git push origin main` で反映、本番 Supabase に SQL を適用 |
| 解決確認 | ホームページが正常に表示されることを確認 |
