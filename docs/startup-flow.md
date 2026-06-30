# アプリ起動〜初回描画のフロー

家族タスクアプリを開いてからタスクが表示されるまでの流れ。
「対応前」は profiles 取得を待ってからタスク取得が始まる直列構造、
「対応後」は householdId を localStorage にキャッシュして並列化した構造。

## 対応前：profiles を待ってからタスク取得（直列）

```mermaid
sequenceDiagram
    autonumber
    participant U as ブラウザ(画面)
    participant MW as middleware
    participant SB as Supabase

    U->>MW: アプリを開く
    MW->>SB: 認証チェック(getUser)
    SB-->>MW: OK
    MW-->>U: ページ返却

    Note over U: usePageData 実行
    U->>SB: profiles取得(どの家族?)
    SB-->>U: household_id 判明
    Note over U: ここで初めて家族IDが分かる

    U->>SB: tasks取得
    U->>SB: categories取得
    U->>SB: staple取得
    SB-->>U: データ返却
    Note over U: 描画（往復が直列に積み上がる）
```

## 対応後：キャッシュ済みIDで即並列取得

```mermaid
sequenceDiagram
    autonumber
    participant U as ブラウザ(画面)
    participant LS as localStorage
    participant SB as Supabase

    U->>LS: household_id を読む(即時・往復なし)
    LS-->>U: household_id

    par 同時に開始
        U->>SB: tasks取得
    and
        U->>SB: categories取得
    and
        U->>SB: staple取得
    and
        U->>SB: profiles取得(確認・是正用)
    end
    SB-->>U: データ返却
    Note over U: 描画（profiles待ちが消え往復1回分速い）

    Note over U,SB: 万一IDが古ければ profiles の結果で自動的に取り直す
```

## ポイント

- 変わったのは「タスク取得の開始タイミング」。対応前は profiles の応答を待ってから、
  対応後はキャッシュした household_id を使って profiles と同時にスタートする。
- 初回（キャッシュ無し）は対応前と同じ流れ。2回目以降の起動が速くなる。
- ログアウト・世帯切り替え時はキャッシュを消すため、別の家族の情報が混ざらない。

## 関連ファイル

- `src/lib/household-cache.ts` — localStorage への id/名前キャッシュ（get/set/clear）
- `src/hooks/use-page-data.ts` — キャッシュ反映・更新・無効化
- `src/app/page.tsx` — キャッシュ済み householdId をフォールバックに各クエリを早期発火
```
