# PWA プッシュ通知 実装計画

## 現状分析

- `manifest.json` は `layout.tsx` で参照されているが、ファイル自体が存在しない
- Service Worker なし
- プッシュ通知関連のコード・ライブラリなし
- API Routes は `/auth/callback` のみ
- タスクCRUDはすべてクライアントから直接 Supabase を呼び出している

## アーキテクチャ

```
[クライアント]                    [サーバー]                    [デバイス]

ユーザーA                        Next.js API Route            ユーザーBのデバイス
タスク追加/完了
  │
  ├─→ Supabase に保存 (既存)
  │
  └─→ POST /api/push/send ──→ web-push ライブラリ ──→ Push Service ──→ SW → 通知表示
       (タイトル・アクション
        ・household_id を送信)

[初回セットアップ]
ユーザー → 通知許可 → PushManager.subscribe() → POST /api/push/subscribe → DB保存
```

**技術選定: Web Push API + `web-push` npm パッケージ**
- Supabase Edge Functions は使わず、Next.js API Routes で完結させる
- クライアント側でタスク操作後にAPIを呼び出し、サーバー側で household メンバー全員にプッシュ送信

---

## 実装ステップ

### Phase 1: PWA 基盤整備

#### Step 1: `public/manifest.json` 作成
- `name`: "家族タスク"
- `short_name`: "家族タスク"
- `start_url`: "/"
- `display`: "standalone"
- `theme_color`: "#6366f1"
- `background_color`: "#ffffff"
- `icons`: 192x192, 512x512 のアイコン画像（プレースホルダーSVGで対応）

#### Step 2: Service Worker 作成 (`public/sw.js`)
- `push` イベントハンドラ: 受信したペイロードから通知を表示
- `notificationclick` イベントハンドラ: 通知タップでアプリを開く
- キャッシュ戦略は最小限（プッシュ通知に集中）

#### Step 3: Service Worker 登録
- `src/components/ServiceWorkerRegister.tsx` を作成
- `layout.tsx` に配置し、アプリ起動時に SW を登録

---

### Phase 2: データベース

#### Step 4: `push_subscriptions` テーブル作成
新しいマイグレーションファイルを作成:

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(endpoint)  -- 同じデバイスの重複登録を防止
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 自分のサブスクリプションのみ INSERT/DELETE 可能
CREATE POLICY "Users can manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING (profile_id = auth.uid());

-- 同じ household のメンバーのサブスクリプションを SELECT 可能（通知送信用）
CREATE POLICY "Can read household member subscriptions"
  ON push_subscriptions FOR SELECT
  USING (
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.household_id = get_my_household_id()
    )
  );
```

#### Step 5: TypeScript 型定義を更新
- `src/types/database.ts` に `push_subscriptions` テーブルの型を追加
- `src/types/index.ts` に `PushSubscription` 型エイリアスを追加

---

### Phase 3: サーバーサイド API

#### Step 6: `web-push` パッケージインストール
```bash
npm install web-push
npm install -D @types/web-push
```

#### Step 7: VAPID キー生成 & 環境変数
- `web-push.generateVAPIDKeys()` でキーペアを生成
- 環境変数に追加:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (クライアント用)
  - `VAPID_PRIVATE_KEY` (サーバー専用)
  - `VAPID_SUBJECT` (例: `mailto:admin@example.com`)

#### Step 8: API Route `POST /api/push/subscribe`
- `src/app/api/push/subscribe/route.ts`
- リクエスト: `{ endpoint, keys: { p256dh, auth } }`
- 認証済みユーザーの `profile_id` と共に `push_subscriptions` に UPSERT
- 既存の endpoint があれば更新

#### Step 9: API Route `DELETE /api/push/subscribe`
- `src/app/api/push/subscribe/route.ts` に DELETE メソッド追加
- リクエスト: `{ endpoint }`
- 該当の subscription を削除

#### Step 10: API Route `POST /api/push/send`
- `src/app/api/push/send/route.ts`
- リクエスト: `{ title, body, householdId, excludeProfileId }`
- 処理:
  1. 認証チェック
  2. `push_subscriptions` から household メンバーのサブスクリプションを取得（送信者を除外）
  3. `web-push.sendNotification()` で各サブスクリプションに通知送信
  4. 410 Gone レスポンスの場合、期限切れサブスクリプションを DB から削除

---

### Phase 4: クライアント統合

#### Step 11: `usePushNotification` フック作成
- `src/hooks/use-push-notification.ts`
- 機能:
  - `permission`: 現在の通知許可状態
  - `isSubscribed`: プッシュ登録済みかどうか
  - `subscribe()`: 通知許可リクエスト → PushManager.subscribe → API に保存
  - `unsubscribe()`: PushManager.unsubscribe → API から削除
- SW の `ready` を待ってから PushManager を使用

#### Step 12: `useTasks` フックに通知トリガーを追加
- `addTask` 成功後: `/api/push/send` を呼び出し
  - body: `「{title}」が追加されました`
- `updateTask` で `is_done: true` の場合: `/api/push/send` を呼び出し
  - body: `「{title}」が完了しました`
- 通知送信は await せず fire-and-forget（タスク操作のレスポンスに影響させない）

#### Step 13: 設定画面に通知トグル追加
- `src/app/settings/page.tsx` または新コンポーネント
- 通知の許可状態を表示
- ON/OFF トグルで subscribe/unsubscribe
- ブラウザが通知非対応の場合は非表示

---

### Phase 5: 仕上げ

#### Step 14: PWA アイコン作成
- `public/icon-192x192.png` と `public/icon-512x512.png`
- シンプルなプレースホルダーアイコンを生成

#### Step 15: ESLint チェック & ビルド確認
- `npm run lint` でエラーがないことを確認
- `npm run build` でビルドが通ることを確認

---

## 通知の内容

| イベント | タイトル | 本文 |
|---------|---------|------|
| タスク追加 | 家族タスク | 「{タスク名}」が追加されました |
| タスク完了 | 家族タスク | 「{タスク名}」が完了しました |

## 送信ルール
- 操作を行ったユーザー本人には通知しない（`excludeProfileId`）
- 同じ household に所属する他の全メンバーに送信
- 1ユーザーが複数デバイスで登録している場合は全デバイスに送信
- Push Service から 410 レスポンスが返った場合は DB から自動削除

## 新規ファイル一覧

```
public/manifest.json                          # PWA マニフェスト
public/sw.js                                  # Service Worker
public/icon-192x192.png                       # PWA アイコン
public/icon-512x512.png                       # PWA アイコン
src/components/ServiceWorkerRegister.tsx       # SW 登録コンポーネント
src/hooks/use-push-notification.ts            # プッシュ通知フック
src/app/api/push/subscribe/route.ts           # サブスクリプション管理 API
src/app/api/push/send/route.ts                # 通知送信 API
supabase/migrations/003_push_subscriptions.sql # DB マイグレーション
```

## 変更ファイル一覧

```
src/types/database.ts        # push_subscriptions 型追加
src/types/index.ts           # PushSubscription エイリアス追加
src/hooks/use-tasks.ts       # 通知トリガー追加
src/app/settings/page.tsx    # 通知設定 UI 追加
src/app/layout.tsx           # ServiceWorkerRegister 追加
package.json                 # web-push 追加
.env.local                   # VAPID キー追加
```
