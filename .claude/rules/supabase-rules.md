# Supabase Rules

> 参照タイミング：DB スキーマ変更、マイグレーション作成、RLS ポリシー追加・修正、`src/types/database.ts` を触るとき。

---

## RLS の方針

- **すべてのテーブルで RLS を有効にする**。`ENABLE ROW LEVEL SECURITY` を必ず付ける。新規テーブルで RLS なしは禁止。
- **世帯スコープの判定は必ず `get_my_household_id()` を経由する**。`auth.uid()` から `profiles` を JOIN する書き方は **無限再帰の原因になるため禁止**（`docs/incident-profiles-403.md` 参照）。`get_my_household_id()` は SECURITY DEFINER で再帰を断ち切るために存在する。
- 新規テーブルにも以下 4 種類のポリシーを基本セットとして用意する：
  - SELECT：自世帯のみ
  - INSERT：自世帯のみ（`WITH CHECK`）
  - UPDATE：自世帯のみ（`USING` と `WITH CHECK` 両方）
  - DELETE：自世帯のみ
- `profiles` テーブルは自身の行への INSERT を許可するポリシーが別途必要（`002_add_profiles_insert_policy.sql` 参照）。
- **`households` テーブルだけは SELECT が広め**（招待コードでの join を許可するため）。同じパターンを他テーブルに広げない。
- SECURITY DEFINER 関数を新規追加するときは `SET search_path = public, pg_temp` を必ず付ける（権限昇格回避）。

---

## マイグレーション作業手順

1. **必ず新しいマイグレーションファイルを作る**。既存ファイルを編集しない（本番は適用済みなので破壊的）。
   ```bash
   npx supabase migration new <descriptive_snake_case_name>
   ```
2. ファイル名は連番 + 内容を表す snake_case（例：`010_add_task_priority.sql`）。
3. SQL を書く。RLS ポリシーの追加・既存ポリシーの DROP→CREATE もこのファイル内で完結させる。
4. **ローカルで適用して動作確認**：
   ```bash
   npx supabase db reset
   ```
   `db reset` は全マイグレーションを最初から流し直すので、依存関係や順序の問題もここで検出できる。
5. アプリ起動して該当機能を手動テスト。
6. **型定義を再生成**（後述）。
7. 本番反映は `npx supabase db push`（実行前にレビュー必須）。

### 注意

- マイグレーション内で `DROP TABLE` / `DROP COLUMN` を使う場合は、必ず PR 説明にデータ消失リスクを明記する。
- データ移行（バックフィル）が必要なときは、同じマイグレーションファイル内で `INSERT ... SELECT` / `UPDATE` を行う。アプリ側のコードと整合させる。
- マイグレーションは冪等にできなくて良い（`db reset` 前提）が、本番反映を意識した順序で書く。

---

## 型生成（`supabase gen types`）のタイミング

`src/types/database.ts` は **手書き禁止・自動生成のみ**。以下のタイミングで必ず再生成する：

```bash
npx supabase gen types typescript --local > src/types/database.ts
```

- 新しいマイグレーションを書いた直後（`db reset` の後）
- テーブル / カラム / enum / 関数のシグネチャを変更した後
- `src/types/database.ts` と DB スキーマがズレていることに気づいたとき

再生成後は：

1. `src/types/index.ts` の派生型（`Task`, `TaskWithAssignees` など）が壊れていないか確認。
2. `npm run lint` と `npm run build` を通して型エラーがないことを確認。
3. 型エラーが出た場合は、コンポーネント / フック側を修正する（型ファイルを手で書き換えない）。

---

## Realtime

- Realtime publish 対象を増やす場合は、マイグレーション内で `ALTER PUBLICATION supabase_realtime ADD TABLE <name>;` を書く。
- `REPLICA IDENTITY FULL` が必要なテーブル（UPDATE/DELETE で旧値が欲しい場合）は明示する（`009_tasks_replica_identity_full.sql` 参照）。
- フロント側は `useRealtimeTasks` のパターン（id dedupe）を踏襲。

---

## RPC（DB 関数）

- フロントから `supabase.rpc('関数名', { ... })` で呼ぶ関数は、必ず引数・戻り値の型が `database.ts` の `Functions` セクションに反映されていることを確認。
- RLS をバイパスする必要がある操作（並び順一括更新など）は SECURITY DEFINER 関数化する（`reorder_tasks` 参照）。直接 SQL で `UPDATE` を回避する。
