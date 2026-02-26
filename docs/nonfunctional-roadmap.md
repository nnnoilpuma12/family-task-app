# 非機能要件・改善ロードマップ

> 作成日: 2026-02-26
> 目的: 機能要件が一通り揃った状態から、実ユーザーへの提供を見据えた非機能・FinOps面の改善計画

---

## 全体方針

改善項目を **Priority 1（リリースブロッカー）→ P2（初回リリース後1〜2週）→ P3（1ヶ月以内）→ P4（中長期）** の4段階に分類する。
工数はひとり開発を想定した目安値（時間単位）。

---

## Priority 1 — リリース前に必ず対応

### P1-1: 招待コードの強度強化

**問題**
現状は `md5(random())` の先頭6文字を使用。MD5は暗号学的に破綻しており、6文字英数字（約4700万通り）はスクリプトで短時間に全網羅できる。他人の家族グループへの不正参加が可能。

**対応**
`supabase/migrations/` に新規マイグレーションを追加し、`gen_random_bytes()` を使って12文字以上の高エントロピーコードに変更する。

```sql
-- 変更前
invite_code = upper(substring(md5(random()::text), 1, 6))

-- 変更後（例）
invite_code = upper(encode(gen_random_bytes(8), 'hex'))  -- 16文字
```

**影響ファイル**
- `supabase/migrations/` （新規マイグレーション）
- `src/components/household/join-form.tsx`（コード入力UIの文字数制限を合わせる）

**工数目安:** 1h

---

### P1-2: タスクURLの無検証問題

**問題**
タスクの `url` フィールドに `javascript:alert(1)` や `data:text/html,...` を入力できる。家族間でリンクを共有する機能があるため、XSS・フィッシングのベクターになりうる。

**対応**
保存前に `URL` コンストラクタでパース、`http:` / `https:` 以外のプロトコルを拒否するバリデーションを追加する。

```typescript
// src/hooks/use-tasks.ts または TaskDetailModal 内
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
```

**影響ファイル**
- `src/components/task/task-detail-modal.tsx`
- `src/hooks/use-tasks.ts`

**工数目安:** 1h

---

### P1-3: 開発用ヒント文言の本番混入

**問題**
`src/components/auth/forgot-password-form.tsx` にローカル開発環境向けの説明文（Inbucket: localhost:54324）がUIに表示される。本番ユーザーに見せるべき情報ではない。

**対応**
`process.env.NODE_ENV === "development"` の条件分岐で囲むか、該当箇所を削除する。

**影響ファイル**
- `src/components/auth/forgot-password-form.tsx`

**工数目安:** 0.5h

---

## Priority 2 — 初回リリース後 1〜2週以内

### P2-1: エラーの全件サイレント問題

**問題**
Supabase の全呼び出しでエラーを握りつぶしている。タスク保存失敗・カテゴリ削除失敗などがユーザーに伝わらず、データロストに気づけない。開発者側にもエラー発生が見えない。

```typescript
// 現状（use-tasks.ts, use-categories.ts, page.tsx など全般）
const { data, error } = await supabase.from(...).select(...)
// error を一切使っていない
```

**対応**
1. エラー時にトースト通知を表示する UI コンポーネントを追加（Sonner などの軽量ライブラリを検討）
2. すべての Supabase 呼び出しで `error` をチェックし、`console.error` 最低限のログを出力する
3. 中長期では Sentry などの外部エラートラッキングへ転送する

**影響ファイル**
- `src/hooks/use-tasks.ts`
- `src/hooks/use-categories.ts`
- `src/app/page.tsx`
- `src/app/settings/page.tsx`
- `src/components/` 配下フォーム全般

**工数目安:** 3〜4h

---

### P2-2: 入力値バリデーションの追加

**問題**
テキストフィールドに長さ制限がなく、巨大データの挿入による DB 負荷・Storage コスト増大・UI崩壊が起こりうる。

| フィールド | 推奨上限 |
|---|---|
| タスクタイトル | 255文字 |
| メモ | 5,000文字 |
| カテゴリ名 | 50文字 |
| ニックネーム | 30文字 |
| 世帯名 | 50文字 |

**対応**
フォームコンポーネントに `maxLength` 属性を追加。Supabase 側にも `CHECK` 制約をマイグレーションで追加する（アプリ層のバリデーションをすり抜けた場合の防衛）。

**影響ファイル**
- `src/components/task/task-create-sheet.tsx`
- `src/components/task/task-detail-modal.tsx`
- `src/components/settings/profile-editor.tsx`
- `src/components/category/category-manager.tsx`
- `supabase/migrations/` （新規マイグレーション）

**工数目安:** 2h

---

### P2-3: VAPID環境変数の起動時チェック

**問題**
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` が未設定の場合、プッシュ通知登録が `undefined` を渡して実行時エラーになるが、エラーログが出ないため原因特定に時間がかかる。

**対応**
`src/hooks/use-push-notification.ts` に起動時アサーションを追加する。

```typescript
if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  console.warn("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY が未設定です。プッシュ通知は無効です。");
  return;
}
```

あわせて `.env.local.example` にVAPID変数を追記し、README にVAPIDキー生成手順を記載する。

**影響ファイル**
- `src/hooks/use-push-notification.ts`
- `.env.local.example`（新規作成）

**工数目安:** 0.5h

---

### P2-4: プッシュ通知APIのレート制限・household検証

**問題**
`/api/push/send` にレート制限がなく、認証済みユーザーが無制限に通知を送信できる。また household_id による明示的な絞り込みがなく、RLS のみに依存している。

**対応**
1. Route Handler に簡易レート制限を実装（`Map` を使ったメモリ内カウンター、または Upstash Redis）
2. `household_id` を明示的にフィルタリングする

```typescript
// src/app/api/push/send/route.ts
const { data: subs } = await supabase
  .from("push_subscriptions")
  .select("*")
  .eq("household_id", profile.household_id)  // 追加
  .neq("profile_id", user.id);
```

**影響ファイル**
- `src/app/api/push/send/route.ts`
- `src/app/api/push/subscribe/route.ts`

**工数目安:** 2h

---

## Priority 3 — 初回リリース後 1ヶ月以内

### P3-1: タスクのページネーション

**問題**
全タスクを一括取得している。Supabase のデフォルト上限は1000件で、それを超えると古いタスクが**静かに切り捨てられる**。数ヶ月使い続けたユーザーに「タスクが消えた」と見えるバグになりうる。

```typescript
// 現状（src/hooks/use-tasks.ts）
const { data } = await supabase.from("tasks").select("*")
```

**対応**
- 完了済みタスクを別クエリで遅延ロード（「完了済みを表示」タップ時に取得）
- または `.range(0, 99)` でページネーションを実装し、スクロール末尾で追加取得

**影響ファイル**
- `src/hooks/use-tasks.ts`
- `src/components/task/task-list.tsx`

**工数目安:** 4h

---

### P3-2: パスワードポリシーとメール確認の強化

**問題**
`supabase/config.toml` の設定が緩い。

```toml
minimum_password_length = 6      # 短すぎる
# enable_confirmations = false   # メール確認なし
```

メール確認なしの場合、typoや架空アドレスで登録→招待メールが届かない、というサポートコストが発生する。

**対応**
```toml
minimum_password_length = 8
[auth.email]
enable_confirmations = true
```

本番 Supabase プロジェクトのダッシュボードでも同様に設定変更が必要。

**影響ファイル**
- `supabase/config.toml`

**工数目安:** 0.5h（設定変更のみ、ただし UX への影響をテスト要）

---

### P3-3: エラー監視・オブザーバビリティの導入

**問題**
エラーが発生しても開発者に通知がなく、ユーザーからの「動かない」報告が唯一の検知手段になっている。

**対応**
以下のいずれかを導入する（無料プランあり）:

| ツール | 用途 | 無料枠 |
|---|---|---|
| Sentry | エラートラッキング | 5,000 events/月 |
| Vercel Analytics | パフォーマンス・PV | 2,500 events/月 |
| LogRocket | セッションリプレイ | 1,000 sessions/月 |

最低限 Sentry のみ導入し、未処理の例外と Supabase エラーをキャプチャする。

**影響ファイル**
- `src/app/layout.tsx`（Sentry初期化）
- `src/hooks/use-tasks.ts` など（エラーキャプチャ追加）

**工数目安:** 2h

---

### P3-4: N+1クエリの並列化

**問題**
`src/app/settings/page.tsx` がプロフィール→世帯→メンバーを直列取得しており、ページロード時間が不必要に長い。

```typescript
// 現状: 直列（合計レイテンシ = 3クエリ分）
const profile = await fetchProfile();
const household = await fetchHousehold(profile.household_id);
const members = await fetchMembers(profile.household_id);
```

**対応**
```typescript
// 改善: 並列（合計レイテンシ ≒ 最も遅い1クエリ分）
const [profile, household, members] = await Promise.all([
  fetchProfile(),
  fetchHousehold(id),
  fetchMembers(id),
]);
```

**影響ファイル**
- `src/app/settings/page.tsx`
- `src/app/page.tsx`

**工数目安:** 1h

---

## Priority 4 — 中長期ロードマップ（3ヶ月以上）

### P4-1: オフライン対応（Service Worker キャッシュ戦略）

**問題**
`public/sw.js` はプッシュ受信のみ実装されており、キャッシュ戦略がない。電波の悪い環境でアプリを開くとブランク画面になる。

**対応**
Workbox を導入し、以下のキャッシュ戦略を実装する:
- App Shell（HTML/CSS/JS）: Cache-First
- タスク一覧: Network-First with Cache Fallback
- 画像: Stale-While-Revalidate

**工数目安:** 8h以上

---

### P4-2: 同時編集の競合検知

**問題**
2人が同じタスクを同時に編集した場合、後から保存した方の変更で上書きされる（last-write-wins）。

**対応**
`updated_at` タイムスタンプを使った楽観的ロック、または Supabase Realtime を使ったリアルタイム競合通知。

**工数目安:** 8h以上

---

### P4-3: GDPR・データ削除対応

**問題**
アカウント削除時の世帯データのクリーンアップ、完了済みタスクの自動削除ポリシー、プライバシーポリシーページが未整備。

**対応**
- アカウント削除フローと `ON DELETE CASCADE` の確認
- 完了済みタスクの N日後自動削除（設定可能）
- `/privacy` ページの追加

**工数目安:** 4〜8h

---

### P4-4: 2FA / MFA 対応

**問題**
`supabase/config.toml` で TOTP・電話・WebAuthn がすべて無効。パスワードのみの認証はリスクが高い。

**対応**
Supabase Auth の TOTP MFA を有効化し、設定ページに MFA 登録フローを追加する。

```toml
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

**工数目安:** 4h

---

## FinOps メモ — Supabase 無料枠との関係

| リソース | 無料枠 | 現状の消費パターン | 超過リスク |
|---|---|---|---|
| DB容量 | 500MB | タスク・画像URLのみ | 低（画像本体はStorageへ） |
| Storage | 1GB | 画像添付機能 | 中（ファイルサイズ無制限のため） |
| Realtime Messages | 200万/月 | タスク操作×同時接続ユーザー数 | 低（家族規模なら問題なし） |
| Auth MAU | 50,000/月 | 全ユーザー | 低 |
| Edge Functions | 500,000回/月 | 未使用 | 対象外 |

**現時点での推奨:**
家族・カップル向けの小規模利用であれば無料枠で十分。
将来的にユーザー数を増やす場合は Pro プラン（$25/月）への移行タイミングを DB 容量 400MB 到達を目安に検討する。

**コスト増大リスクがある実装:**
- 画像アップロードサイズ無制限 → Storage 超過（P2-2 のバリデーションで対策）
- Realtime チャンネルの開き放し → メッセージ数増大（現状は `useRealtimeTasks` でクリーンアップ済み）

---

## 完了チェックリスト

### P1 — リリースブロッカー
- [ ] P1-1: 招待コード強度強化
- [ ] P1-2: タスクURL検証
- [ ] P1-3: 開発用ヒント文言の削除

### P2 — リリース後 1〜2週
- [ ] P2-1: エラーのトースト通知化
- [ ] P2-2: 入力値バリデーション追加
- [ ] P2-3: VAPID環境変数の起動時チェック
- [ ] P2-4: プッシュ通知APIのhousehold検証・レート制限

### P3 — 1ヶ月以内
- [ ] P3-1: タスクのページネーション
- [ ] P3-2: パスワードポリシー強化・メール確認有効化
- [ ] P3-3: Sentry等エラー監視導入
- [ ] P3-4: N+1クエリの並列化

### P4 — 中長期
- [ ] P4-1: Service Worker キャッシュ戦略
- [ ] P4-2: 同時編集競合検知
- [ ] P4-3: GDPR・データ削除対応
- [ ] P4-4: 2FA / MFA 対応
