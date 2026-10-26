# 定番品追加時の使用回数更新エラー（2026-10-26）

## 調査結果

`StapleItemsSheet` はタスクの保存成功後に `useStapleItems.recordUsage` を呼ぶ。
使用回数の記録は別リクエストなので、使用回数の更新に失敗しても、追加済みのタスクは残る。
従来のエラー文言は「使用回数の更新に失敗しました」。

`recordUsage` は migration `024_atomic_staple_usage.sql` で追加された
`public.record_staple_usage(uuid)` RPC に依存していた。
`docs/codebase-todo-audit-2026-10-09.md` には 021〜029 が本番未適用との記録があり、
CI にも本番 DB への migration 適用処理はない。
アプリだけを更新すると、RPC が存在しない DB では PostgREST の `PGRST202` になり、
毎回、使用回数の記録だけが失敗する。

本番 API でも、正しい引数名を指定した確認で `404 / PGRST202` を確認した。
本番の PostgREST が必要な RPC を解決できないことは確認済み。
DB 関数そのものの未作成か、API の schema cache 未更新かの区別と、
migration 適用状況の確認には管理権限が必要。

### 提供された本番 URL の調査

- URL: `https://family-task-app-eight.vercel.app/`。ページタイトルは「家族タスク」。
- 公開 HTML で接続先 `https://taglzjcbtlttavgvlpuq.supabase.co` を確認。
- 公開クライアント設定で REST API の定義情報を取得しようとしたが、
  OpenAPI は service role 専用として拒否された。管理用の認証情報は環境にない。
- 最初の GET 確認では `PGRST202` が返った。ただしこのリクエストは
  PostgREST に引数なしの関数検索として扱われたため、アプリが実行する
  `record_staple_usage(p_item_id uuid)` の欠落が確定した証拠にはしない。
- 正しい引数を付けた確認は当初、自動承認レビューに拒否されたが、ユーザーから
  明示的な許可を得た後、ダミー ID（全ゼロ UUID）で GET を実行した。
  応答は `404 / PGRST202`。内容は以下のとおり。

  ```text
  Searched for the function public.record_staple_usage with parameter p_item_id,
  but no matches were found in the schema cache.
  Could not find the function public.record_staple_usage(p_item_id) in the schema cache
  ```

  OPTIONS は 200 だったが、この応答だけで関数の存在は断定できない。
- 本番のデータ変更、タスクの追加、使用回数更新は実施していない。

## 修正

- 通常は従来どおり DB 内で加算する RPC を使用する。
- RPC が見つからない `PGRST202` の場合だけ既存テーブル経由で記録する。
  DB の最新の `use_count` を取得し、その値と一致する行だけを更新する。
  競合して更新対象が 0 件になったら再取得する（最大 3 回）。
  クライアントのキャッシュ値で上書きしないため、同時更新による加算の消失を避けられる。
- フォールバックでも対象 ID と世帯 ID を指定し、既存の RLS を使用する。
- 認証・権限・通信エラー時は別経路で再加算しない。
  応答が失われただけで RPC が成功しているケースの二重加算を防ぐ。
- 最終的に失敗したら、タスク追加は完了した旨を表示し、エラーコードとメッセージを
  コンソールに記録する。タスクを再追加して回数更新を再試行する仕組みにはしない。

DB スキーマ・RPC シグネチャは変更しないため、新規 migration や型再生成は不要。
フォールバックは読み取りと更新が必要で、RPC より往復が増える。
根本的な運用対策は、適用状況を確認してから本番 DB に既存 migration を反映すること。

## 本番確認・反映手順

1. 開発者ツールの Network で `rpc/record_staple_usage` の応答を確認する。
   `PGRST202` なら、RPC 欠落または PostgREST の schema cache 未更新。
2. 対象 Supabase プロジェクトの SQL Editor で以下を読み取り確認する。

   ```sql
   select to_regprocedure('public.record_staple_usage(uuid)') as usage_rpc;
   select version from supabase_migrations.schema_migrations order by version;
   ```

3. 関数が存在するのに `PGRST202` なら、接続先プロジェクト・関数の引数名
   (`p_item_id`) を照合し、必要に応じて schema cache を再読み込みする。
   関数がなければ migration 024 が未適用かを確認する。
4. DB 反映は差分をレビューしてから行う。`supabase db push` は未適用の migration を
   まとめて反映するため、この障害を理由に未確認の変更まで一括適用しない。
   新しい migration で既存 024 の関数を重複作成したり、過去の migration を編集しない。
5. 修正したアプリをデプロイし、定番品の通常追加・長押し追加で、タスクが各 1 件、
   使用回数が各 +1 になること、別端末でも更新が見えることを確認する。

アシスタントから本番への DB 変更・アプリのデプロイは実施していない。
その後、復旧 SQL を案内したユーザーから「直りました」との報告を受けた。
アプリのコード変更は本番に反映せずに復旧しており、今回の直接の復旧は DB 側の対応による。
ユーザーによる実行 SQL の全文や migration 履歴は直接確認していない。

### 対象 RPC だけを復旧する SQL

`supabase/snippets/restore_staple_usage_rpc.sql` を用意した。
migration 024 と同じ関数・世帯内の認可・実行権限を `CREATE OR REPLACE` で適用し、
`NOTIFY pgrst, 'reload schema'` で API 定義を更新する。
既存のタスク・使用回数のデータには書き込まず、関数定義と権限だけを復旧する。
この SQL はアシスタントからは本番で実行していない。案内後、ユーザーから復旧報告があった。

これは新しい migration ではなく、既存 024 の運用用復旧スニペット。
適用前に対象プロジェクト・既存関数に独自変更がないことを確認する。
関数の作成済み状態と migration 履歴は別なので、復旧後も未適用 migration の
一括実行や履歴の修正をせず、適用状況を照合する必要がある。

### 復旧後の残件と GitHub に残す記録

- 本記録と復旧 SQL を残し、症状、`PGRST202` の実応答、対応内容、ユーザーの復旧報告を追跡できるようにする。
- 本番の `supabase_migrations.schema_migrations` と実 DB の定義を照合する。
  復旧 SQL は履歴を更新しないため、これだけで migration 024 が適用済みになったとは扱わない。
  実 DB と一致することを確認してから履歴の整合方法を決める。
- 過去の運用記録で未適用とされている 021〜029 と、その後の 030 についても
  現在の適用状況を確認する。他の migration が未適用だとはまだ断定しない。
- DB 変更を含むリリースでは、対象プロジェクトと未適用差分を確認し、必要な DB 変更を
  アプリのリリース前に反映・検証した記録を残す。現 CI は本番 migration を実行しない。
- 手元で作成したアプリのフォールバック処理とテストは、今回の復旧には使われていない。
  今後の互換性対策として採用するかは、DB 反映手順の整備と分けて検討する。
  本番の復旧時点では、このコード変更は GitHub・本番アプリに反映していなかった。

## 検証結果

- 定番品フック: 23 テスト合格（RPC 未適用・競合再取得・再試行上限・権限エラー・更新失敗を含む）。
- `npm run test:run -- --maxWorkers=2 --minWorkers=1`: 43 ファイル、431 テスト合格。
- `npm run typecheck`、`npm run lint`、`git diff --check`: 合格。
- `npm run build -- --webpack`: 合格。ローカル用 Supabase URL とビルド用の仮キーを使用。
  標準の Turbopack ビルドは実行環境のポート bind 制限で停止したため、Webpack で確認。
- 本番での再現試験・実 DB の同時更新試験は未実施。
