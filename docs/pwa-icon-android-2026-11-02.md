# Android PWA アイコンの黒枠調査と互換性対策

## 確認できた事実

- 提供された起動画面では、円形領域の内側に正方形の画像が入り、その外周に黒が見える。
- main のアイコン画像の最終変更は 2026-03-01。manifest の URL 更新は 2026-04-28（v2 → v3）。最近の画像差し替えではない。
- 2026-11-02 に本番 `https://family-task-app-eight.vercel.app` の manifest と 192px / 512px の maskable PNG、512px の通常 PNG を取得。
- 本番 manifest は main と同じく any と maskable を別々に宣言している。Apple Touch Icon を Android 用として指定していない。
- 512px maskable PNG の SHA-256 は `fd0ee3d3be7633dc032fe5efabe5f1d2eafb2e62e648c76599725ea93d1d6678`。本番と main で一致。全画素の alpha は 255、四隅もグラデーションで、黒い余白は含まれない。
- Service Worker は PNG を cache-first で処理する。サーバーの `Cache-Control: no-cache` より先に Cache Storage の画像が返るため、同じ URL の画像更新を隠す経路がある。

## 切り分けと対策

黒い領域は本番画像に含まれない。Android / ブラウザが生成・保持する WebAPK の adaptive icon の描画経路が疑われる。ただし端末上の APK や Android / ブラウザのバージョンを取得できていないため、内部のどの処理が黒を作るかは未確定。Service Worker のキャッシュが今回の黒枠を発生させたとまでは断定しない。

互換性対策として manifest の maskable 宣言を外し、通常の `purpose: any` アイコンをブラウザに整形させる。これにより問題が見える maskable 入力の経路を避ける。端まで背景色が広がる adaptive 表示の代わりに、ブラウザやランチャーによる余白が付く場合がある。既存の maskable PNG と SVG は残すが、インストール時の候補にはしない。

manifest の通常アイコン URL と HTML の通常アイコン URL を v4 に更新し、インストール済み WebAPK の更新検出を促す。Apple Touch Icon と通知アイコンの画像・URLは変更しない。

Service Worker はインストール用 manifest / favicon / app icon を横取りせず、HTTP の再検証に任せる。SW_VERSION を 7 にし、activate 時に旧キャッシュを削除する。アプリ本体・通知アバターのオフラインキャッシュは従来どおり。インストール済みアプリの起動用アイコンは Android 側が保持する。

## 検証

- Service Worker に古いレスポンスがある状態でも、バージョン付き URL と旧アイコン URL を横取りしない回帰テストを追加。
- 通常のアプリ用リソース・通知アバターのキャッシュ動作を回帰テストで確認。
- `npm run test:run`: 44 ファイル・435 テスト成功（追加した回帰テスト 12 件を含む）。`npm run lint`、`npm run typecheck`、`git diff --check` も成功。
- 検証環境の Node.js は 24.19.0。リポジトリ指定の 24.22.1 より古く、依存インストール時に engine 警告が出た。上記チェックはこの環境での結果であり、指定バージョンの CI と実機での確認は別途必要。
- 本番の画像と設定の調査は修正前の状態。修正はローカルであり、まだ本番には反映していない。

## 反映後の実機確認

1. 本番 manifest の icons が any のみ、URL が v4 になっていることを確認する。
2. インストールに使ったブラウザでアプリをオンラインで開き、Service Worker が v7 に更新されたことを確認する。
3. WebAPK の更新にはブラウザ側のチェックと Android の再生成が必要で、反映時刻は保証できない。すぐに比較する場合は、同期済みであることを確認して PWA を削除し、同じブラウザから再インストールする。
4. ホーム画面とコールドスタートの両方で黒い外周が消えるか確認する。Android 12 以降のシステム起動画面はデスクトップの端末エミュレーションだけでは検証できない。
5. まだ黒枠が出る場合は、機種・Android バージョン・ブラウザ名とバージョンを記録し、新規 WebAPK のアイコンを確認する。更新 URL が v4 かも確認し、古い WebAPK と新規インストールを区別する。
