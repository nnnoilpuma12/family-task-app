# 通知のプロフィールアイコン

タスク追加・完了などの通知では、認証済みの送信者の `profiles.avatar_url` を
`/api/push/send` で取得する。受信者やタスク担当者の設定は使用しない。

- アップロード画像: 自プロジェクトの公開 `avatars/<送信者ID>/` の画像 URL。
- 絵文字: `public/notification-avatars/` の 24 種の PNG。
- 未設定・無効値・画像取得失敗: 従来のアプリアイコン。

Service Worker は画像を最大 3 秒待ち、デコードしてから data URL として
通知に渡す。これにより、通知表示時の再ダウンロードを避ける。
HTTP エラー・通信障害・壊れた画像・タイムアウトでも通知本文を表示する。
ステータスバー用の `badge` はアプリのアイコンを維持する。

## 絵文字画像の再生成

`node scripts/generate-notification-avatars.mjs` を実行する。
Playwright の Chromium とカラー絵文字フォントが必要。
`src/lib/avatar.ts` のプリセットから 192 × 192 PNG を生成する。
生成物をリポジトリに含めるため、通常のビルド時に生成環境は不要。
絵文字の描画は生成環境のフォントに依存する。画像を変更するときは
`notification-icon.ts` の画像 URL のバージョンも更新する。

## 確認

- `npm run test:run`: プリセット画像、送信者の判定、画像取得失敗やタイムアウト。
- `npm run test:e2e -- e2e/push-notification.spec.ts`: Chromium にローカルの
  PushEvent を配信し、実際の Service Worker と通知 API で画像を確認する。
  世帯メンバーへの通知送信は行わない。
- `npm run lint` / `npm run typecheck` / `npm run build`。

本番反映後は受信側で一度 PWA を開き、Service Worker の更新を取得する。
通知の再許可や PWA の再インストールは不要。旧 Service Worker でも通知は
表示されるが、更新されるまではアプリのアイコンになる。

Android 実機では双方から追加・完了を行い、バックグラウンド・ロック画面・
アイコン変更後の表示と通知タップを確認する。アイコンの配置や切り抜きは
Android とブラウザの表示仕様に従う。ブラウザ自動テストだけでは実機の
通知トレイの見た目まで保証できない。
