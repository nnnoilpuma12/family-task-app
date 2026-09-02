# デザインシステム

家族・カップル向け家事タスク共有アプリ「家族タスク」の UI 設計基準。
カラー・タイポグラフィ・コンポーネントの実装値はすべてこのドキュメントを参照元とする。

対象読者は、このリポジトリで画面や UI コンポーネントを新規に作る・修正する開発者。
トークンの定義本体は `src/app/globals.css`、プリミティブの実装は `src/components/ui/` にある。

---

## 1. 前提と制約

設計判断のほぼすべてがこの 4 点から導かれている。迷ったらここに戻る。

| 前提 | 設計への影響 |
|---|---|
| **モバイル中心の PWA** | 片手・親指操作が基準。デスクトップは「広い画面でも破綻しない」までを担保する副次的な対象 |
| **世帯（2〜数名）でのリアルタイム共有** | 誰の操作かが一目で分かること、他人の変更が割り込んでも画面が飛ばないこと |
| **生活の中で 1 日に何度も開く** | 起動直後の視認性と、1 タップで終わる操作を優先。装飾より情報密度 |
| **UI 言語は日本語固定** | 日本語は同じ文字数でも横幅が広く、字面が濃い。欧文前提の詰めたタイポグラフィは使わない |

ダークモードは未対応（ライトテーマ単一）。トークンは CSS 変数で定義してあるため、
将来対応する場合は `:root` の値を差し替えるだけで済む構造にしてある。

---

## 2. デザイン原則

1. **背景は白ではなく暖色オフホワイト。** ページ地色に `#f6f5f4`、カード面に `#ffffff` を使い、
   面の重なりを影ではなく明度差で表現する。純白に純黒を置いたときのコントラストの刺さり方を避け、
   長時間の閲覧でも疲れにくい紙のような質感にする。
2. **境界は細く、影はほぼ使わない。** 分割は 1px のボーダーと余白で行う。
   影を使うのは「浮いている」ことが機能上の意味を持つ要素（FAB・シート・ダイアログ）だけ。
3. **彩度は情報にだけ与える。** UI の骨格（背景・文字・枠線）は無彩色に近い暖色ニュートラルに保ち、
   彩度の高い色はブランドの青、期日の緊急度、カテゴリ識別の 3 用途に限定する。
   装飾目的で新しい色を足さない。
4. **状態は色だけで伝えない。** 完了は「色 + チェック形状 + 打ち消し線」、期日の切迫は
   「色 + 左端のアクセント枠 + 日本語ラベル」というように、必ず 2 つ以上の手掛かりを重ねる。
5. **触れる要素は指のサイズで作る。** 見た目が小さくても、当たり判定は最低 40px、
   主要な操作は 44〜48px を確保する。

---

## 3. カラー

### 3.1 トークン定義

`src/app/globals.css` の `:root` に CSS 変数として定義し、`@theme inline` 経由で
Tailwind のユーティリティ（`bg-surface`、`text-muted` など）に接続している。
**コンポーネントで生の 16 進数カラーを書かない。** 必ずトークン名で参照する。

#### 面（Surfaces）

| トークン | 値 | Tailwind | 用途 |
|---|---|---|---|
| `--background` | `#f6f5f4` | `bg-background` | ページの地色。すべての画面のルート |
| `--surface` | `#ffffff` | `bg-surface` | カード・シート・ヘッダーなど、地色の上に乗る面 |
| `--surface-strong` | `#ebeae8` | `bg-surface-strong` | セカンダリボタン、ホバー面、スケルトンのプレースホルダ |

#### 文字（Text）

| トークン | 値 | Tailwind | 用途 |
|---|---|---|---|
| `--foreground` | `#111111` | `text-foreground` | 本文・見出し・入力値。既定の文字色 |
| `--text-muted` | `#615d59` | `text-muted` | 補足説明、非選択タブ、アイコンボタンの通常状態 |
| `--text-subtle` | `#a39e98` | `text-subtle` | プレースホルダ、完了済みタスクのタイトル、メタ情報 |

`--text-muted` / `--text-subtle` は暖色寄りのグレー（黄〜茶の下地）で、青みグレーは使わない。
`--text-subtle` はコントラスト比が低いため用途に制限がある（§12 参照）。

#### 境界（Borders）

| トークン | 値 | Tailwind | 用途 |
|---|---|---|---|
| `--border` | `#e6e4e1` | `border-border` | 既定の境界線。カード枠、ヘッダー下線、区切り |
| `--border-strong` | `#d6d3cf` | `border-border-strong` | 入力欄の枠、未完了チェックボックス、シートのグラブハンドル |

入力欄だけ `--border-strong` を使うのは、「触れる場所」を一段はっきり見せるため。
表示専用のカードには使わない。

#### ブランド（Brand）

| トークン | 値 | Tailwind | 用途 |
|---|---|---|---|
| `--primary` | `#0075de` | `bg-primary` / `text-primary` | 主要アクション、リンク、選択中の状態 |
| `--primary-dark` | `#005bab` | `bg-primary-dark` | プライマリのホバー / 押下 |
| `--primary-soft` | `#f2f9ff` | `bg-primary-soft` | 青系の淡い面。レコメンド枠、入力候補チップ、選択中のアバター |
| `--focus` | `#097fe8` | `border-focus` / `ring-focus` | 入力欄のフォーカス枠とリング |

青の淡い塗りが必要な箇所（使用回数バッジ、ソート適用中のピル）では
`bg-primary/10` のようにアルファ指定を使う。トークンを増やさない。

#### セマンティック（Semantic）

| トークン | 値 | Tailwind | 意味 |
|---|---|---|---|
| `--danger` | `#c4441e` | `text-danger` / `bg-danger` | 破壊的操作、エラー、**期日超過** |
| `--warning` | `#dd5b00` | `text-warning` | **今日が期日** |
| `--caution` | `#a85420` | `text-caution` | **明日が期日** |
| `--success` | `#1aae39` | `bg-success` | 完了状態 |

`danger` → `warning` → `caution` は期日の切迫度を表す連続的なスケールとして設計してある
（赤 → 橙 → くすんだ茶橙と、彩度が落ちていく）。この 3 色は必ずこの順で使い、
個別に他の意味へ流用しない。

#### 影（Elevation）

| トークン | Tailwind | 内容 |
|---|---|---|
| `--shadow-card` | `shadow-notion-card` | 4 層・最大不透明度 0.04 の淡い影 |
| `--shadow-deep` | `shadow-notion-deep` | 5 層・最大不透明度 0.05 / ぼかし 52px の深い影 |

いずれも「1 枚の濃い影」ではなく、不透明度 0.01〜0.05 の層を重ねて自然な減衰を作る。
使い分けは §7 を参照。

### 3.2 カテゴリカラー

カテゴリは世帯ごとにユーザーが作るため、色はトークンではなくプリセットから選択する
（`src/components/category/color-picker.tsx`）。

```
#ef4444  #f97316  #eab308  #22c55e  #3b82f6  #6366f1  #a855f7  #ec4899
```

選ばれた色は**識別子であって意味を持たない**。扱い方は 3 通りに固定する。

- **ベタ塗り（100%）**：選択中タブのラベル文字
- **アクセント枠（3px の左ボーダー）**：定番品カード、レコメンドカード
- **淡い塗り**：選択中タブの背景は 10%（`${color}1a`）、カテゴリピルの背景は 12.5%（`${color}20`）

アルファ付き 16 進数（`1a` / `20`）をテンプレートリテラルで連結する方式を全箇所で統一している。

---

## 4. タイポグラフィ

### 4.1 フォント

`next/font/google` の **Inter** を CSS 変数 `--font-inter` で読み込み、`--font-sans` に接続する。

```
Inter → -apple-system → BlinkMacSystemFont → Segoe UI → Helvetica → Arial → sans-serif
```

日本語グリフは Inter に含まれないため、実際の和文は各 OS のシステムフォント
（iOS: Hiragino Sans / Android: Noto Sans JP / Windows: Yu Gothic UI）にフォールバックする。
**この前提が字詰めの方針を決めている**——和欧混植で欧文側だけを詰めると行が不揃いになるため、
文字送りの調整は見出しに限定し、本文サイズでは行わない。

`body` に以下を適用する。

- `font-feature-settings: "lnum", "locl"` — 数字をライニング（等高）数字に固定し、
  日付や件数が行の中で沈まないようにする
- `-webkit-font-smoothing: antialiased` / `-moz-osx-font-smoothing: grayscale`

等幅フォントとして **Geist Mono** を `--font-geist-mono` → `--font-mono` で接続してある。
用途は招待コード入力欄のみ（`font-mono`）。桁が揃うことに意味がある値だけに使い、
本文や見出しには使わない。

### 4.2 スケール

Tailwind の既定スケールをそのまま使う。独自サイズは定義しない。

| クラス | サイズ / 行高 | 用途 |
|---|---|---|
| `text-3xl` | 30px / 36px | アバター（lg）の絵文字 |
| `text-2xl` | 24px / 32px | **単独画面の見出し（`h1`）**、絵文字アイコン、招待コード入力欄 |
| `text-xl` | 20px / 28px | エラー画面・404 の見出し、絵文字の選択肢 |
| `text-lg` | 18px / 28px | **一覧画面のヘッダー見出し（`h1`）**、シート / ダイアログのタイトル、空状態の主文 |
| `text-base` | 16px / 24px | **入力欄の値**、標準ボタン |
| `text-sm` | 14px / 20px | **UI の基準サイズ**。タスクタイトル、ラベル、リスト項目、ボタン |
| `text-xs` | 12px / 16px | 期日、作成者、件数、セクション見出し、バッジ |
| `text-[10px]` / `text-[9px]` | — | 定番品カード内の数量・カテゴリピルのみ（例外） |

**`text-base`（16px）は入力欄で必須。** iOS Safari は 16px 未満の入力欄にフォーカスすると
ページを自動ズームするため、`Input` の値は必ず 16px 以上にする。

10px / 9px は定番品カードのグリッド内でのみ許可する例外。他の場所に広げない。

### 4.3 ウェイト

Inter の 3 段階だけを使う。`font-normal`（400）は既定値なのでクラスを書かない。

| クラス | 用途 |
|---|---|
| `font-medium`（500） | UI の既定。タスクタイトル、ラベル、リスト項目、タブ |
| `font-semibold`（600） | ボタンのラベル、強調された値 |
| `font-bold`（700） | 見出し（`h1`〜`h3`）、シート / ダイアログのタイトル、アバターの頭文字 |

### 4.4 文字送り

見出し要素にのみ、グローバル CSS で負のトラッキングを与える。

```css
h1, h2, h3 { letter-spacing: -0.02em; }
h1          { letter-spacing: -0.025em; }
```

`em` 指定なのでサイズに比例して自動的にスケールする。px 固定値は使わない。
本文サイズでの字詰めは行わない（§4.1 の理由による）。

---

## 5. スペーシングとサイズ

Tailwind の 4px 基準スケールを使う。任意値（`p-[13px]` など）は書かない。

### 5.1 よく使う値

| 用途 | 値 |
|---|---|
| 画面の左右パディング | `px-4`（16px） |
| カード内パディング | `p-3` / `p-4`（12 / 16px）、タスク行のみ `px-3 py-1.5` |
| 密なリストの行間 | `gap-1`（4px）— タスクリスト |
| 通常のリストの行間 | `gap-2` / `gap-3`（8 / 12px） |
| セクション間 | `gap-6`（24px）— 設定画面 |
| リスト末尾の余白 | `pb-24`（96px）— FAB に隠れないための逃げ |
| シート下端の余白 | `pb-8`（32px） |

### 5.2 角丸

| クラス | 値 | 用途 |
|---|---|---|
| `rounded` | 4px | ボタン、入力欄、メニュー項目。**機能的な要素の既定** |
| `rounded-lg` | 8px | タスクカード、レコメンドカード |
| `rounded-xl` | 12px | 定番品カード、設定カード、シート / ダイアログのパネル |
| `rounded-t-xl` | 上 12px | ボトムシートの上端 |
| `rounded-full` | — | アバター、チェックボックス、FAB、ピル、バッジ、グラブハンドル |

角丸は**要素の性格で決まる**：押すもの＝ 4px、面＝ 8〜12px、丸いもの＝完全な円 or ピル。
サイズが大きいから角丸も大きく、という決め方はしない。

### 5.3 タップターゲット

| 最小高さ | 用途 |
|---|---|
| 40px | 補助的なアクション（完了済み一括削除など） |
| 44px | 標準のセカンダリアクション（もっと見る） |
| 48px | ダイアログの確認 / キャンセル |

見た目のサイズが小さい要素は、パディングで当たり判定を広げる。
タスクのチェックボックスは実寸 20px だが `p-3 -m-3` で 44px 相当の当たり判定を持たせている
（負のマージンでレイアウトへの影響を打ち消す）。このパターンをアイコンボタン全般で使う。

### 5.4 重なり順（z-index）

| 値 | レイヤー |
|---|---|
| `z-10` | 同一コンテナ内での前面（シートの sticky ヘッダー、タブのラベル） |
| `z-30` | 画面ヘッダー（sticky） |
| `z-40` | FAB |
| `z-50` | オーバーレイ全般（ボトムシート、モーダル、確認ダイアログ） |
| `z-[60]` | 別のシートの上に重ねるシート（`BottomSheet` の `elevated` prop） |

この 5 段階から外れる値を新規に作らない。

---

## 6. モーション

`framer-motion` を使う。**すべての動きは 250ms 以内に収める。**
待ち時間を演出するのではなく、要素がどこから来てどこへ行ったかを示すためだけに動かす。

### 6.1 標準パラメータ

| 用途 | 指定 |
|---|---|
| 既定のスプリング | `{ type: "spring", damping: 20, stiffness: 300 }` |
| シートの出現 | `{ type: "spring", damping: 25, stiffness: 300 }` |
| ダイアログの出現 | `{ type: "spring", damping: 24, stiffness: 320 }` |
| チェックマークの出現 | `{ type: "spring", damping: 15, stiffness: 400 }`（最も弾む） |
| 退出 | `tween` 0.15〜0.18s / `easeIn`（出現より速く消す） |
| タブインジケータ | CSS `transition: transform 0.25s ease-out, width 0.25s ease-out` |

減衰が小さいほど弾む。チェックマークだけ `damping: 15` で明確に弾ませ、
「完了した」という達成感を身体的に返す。

### 6.2 決まった動きのパターン

| 状況 | 動き |
|---|---|
| リスト項目の追加 | `opacity: 0, y: 20` → `opacity: 1, y: 0` |
| リスト項目の削除 | `opacity: 0, scale: 0.95`（0.15s） |
| シート / モーダル | `y: "100%"` → `y: 0`、オーバーレイは opacity のフェード |
| 確認ダイアログ | `opacity: 0, scale: 0.95, y: 12` → 等倍・不透明 |
| FAB の初回表示 | `y: 64, opacity: 0` から迫り上がる |
| FAB のホバー / 押下 | `scale: 1.1` / `rotate: 45, scale: 0.9`（＋が × に変わる示唆） |
| 定番品の編集モード | `rotate: [-1, 1, -1, 1, 0]` を 0.35s で無限ループ（削除可能であることの合図） |
| 全タスク完了 | `canvas-confetti` を `particleCount: 100, spread: 70, origin: { y: 0.6 }` で発火 |

`canvas-confetti` は動的 `import()` で読み込む。起動バンドルに含めない。

### 6.3 既知の制約

`prefers-reduced-motion` には未対応。アニメーションを増やす際は、
将来この分岐を一箇所で入れられるよう、モーション定義をコンポーネント内に散らかさないこと。

---

## 7. 面と境界（エレベーション）

| レベル | 表現 | 対象 |
|---|---|---|
| 0 | 塗りなし | ページ地色 `--background` の上のテキスト |
| 1 | `bg-surface` + `border-border` | カード、リスト項目、ヘッダー。**既定** |
| 2 | `shadow-md` | FAB、確認ダイアログ |
| 3 | オーバーレイ `bg-black/40` + パネル | ボトムシート、モーダル |

**レベル 1 が既定であり、大半の要素はここに収まる。**
影ではなく「白い面 + 細い枠線」で地色から浮かせるのが、このアプリの標準的な見せ方。

`shadow-notion-card` / `shadow-notion-deep` はトークンとして用意してあるが、
現状のコンポーネントは Tailwind 既定の `shadow-md` / `shadow-lg` を使っている。
新しく影を足す場合は、まずレベル 1 で足りないかを検討し、
必要ならこのトークン側に寄せて多層影に統一する。

オーバーレイは常に `bg-black/40`。濃さを画面ごとに変えない。

---

## 8. コンポーネント仕様

`src/components/ui/` のプリミティブは、これらの仕様の唯一の実装とする。
同じ役割のスタイルをページ側で直書きしない。

### 8.1 Button（`ui/button.tsx`）

共通：`rounded`（4px）/ `font-semibold` / `transition-colors` /
`disabled:opacity-50 disabled:pointer-events-none`

| variant | 通常 | ホバー / 押下 |
|---|---|---|
| `primary` | `bg-primary` + 白文字 | `bg-primary-dark` |
| `secondary` | `bg-surface-strong` + `text-foreground` | `bg-border-strong` |
| `ghost` | 透明 + `text-foreground` | `bg-surface-strong` → `bg-border-strong` |
| `danger` | `bg-danger` + 白文字 | `opacity-90` → `opacity-80` |

| size | パディング / 文字 |
|---|---|
| `sm` | `px-3 py-1.5` / `text-sm` |
| `md` | `px-4 py-2` / `text-base`（既定） |
| `lg` | `px-6 py-3` / `text-lg` |

`forwardRef` 対応。1 画面内に `primary` は原則 1 つ。

### 8.2 Input（`ui/input.tsx`）

- ラベル：`text-sm font-medium text-foreground`、`htmlFor` で必ず紐付ける
- 枠：`rounded` + `border-border-strong`、背景 `bg-surface`
- 値：`px-4 py-3` / `text-base`（§4.2 の iOS ズーム対策）
- プレースホルダ：`text-subtle`
- フォーカス：`focus:border-focus` + `focus:ring-2 focus:ring-focus/15`（`outline-none` と併用）
- エラー：枠を `border-danger` に変え、下に `text-sm text-danger` のメッセージを出す

### 8.3 BottomSheet（`ui/bottom-sheet.tsx`）

モバイルの入力・選択 UI はすべてこれを使う。新しくモーダルを作らない。

- オーバーレイ `bg-black/40`（タップで閉じる）、パネル `bg-surface` + `border-border`
- モバイル：画面下端に吸着、`rounded-t-xl`、高さ上限 `80dvh`
- グラブハンドル：`h-1 w-10 rounded-full bg-border-strong`（`md` 以上では非表示）
- 下方向へのドラッグで閉じる（**しきい値：オフセット 100px**）
- タイトルは sticky ヘッダーに `text-lg font-bold`、本文は `px-4 pb-8`
- 開いている間は `document.body` のスクロールをロックする
- **キーボード回避**：`visualViewport` の高さ変化を監視し、80px を超える縮みをキーボードとみなして
  `maxHeight` と `marginBottom` を補正する。80px のしきい値は、モバイルブラウザの
  URL バー伸縮を誤検知しないためのもの
- `md`（768px）以上：画面中央に配置し、全周 `rounded-xl`、ドラッグ操作は無効化
- `elevated` prop：`z-[60]` に上げ、別のシートの上に重ねる

### 8.4 Modal（`ui/modal.tsx`）

`BottomSheet` と同構造だが、ブレークポイントが `sm`（640px）、高さ上限が `90dvh`、
ドラッグが常時有効。タスク詳細のように内容量が多い画面で使う。

### 8.5 ConfirmDialog（`ui/confirm-dialog.tsx`）

破壊的操作の確認に使う。`window.confirm` は使わない。

- **`createPortal` で `document.body` 直下に描画する。** `transform` / `will-change` を持つ祖先は
  `position: fixed` の包含ブロックになり、配置がリストの量に応じてずれる。
  ポータルによって常にビューポート基準で中央に出す。この挙動はテストで固定してある
- パネル：`max-w-sm rounded-xl bg-surface border-border p-5 shadow-md`
- ボタンは縦積み、それぞれ `min-h-[48px]`。確認は `variant="destructive"` で `bg-danger`
- **キャンセルに初期フォーカスを当てる**（マウント 50ms 後）。Escape でキャンセル
- `role="dialog"` / `aria-modal="true"` / `aria-labelledby` / `aria-describedby`

### 8.6 Fab（`ui/fab.tsx`）

- `fixed bottom-6 right-6 z-40`、`h-14 w-14 rounded-full bg-primary` + 白アイコン + `shadow-md`
- アイコンは lucide の `Plus`（28px）、`aria-label` 必須
- 補助 FAB（定番品を開く）は `right-24`・`h-12 w-12`・`bg-surface` + `border-border` として、
  主 FAB より一段弱く見せる

### 8.7 Avatar（`ui/avatar.tsx`）

- `rounded-full bg-surface-strong`、`title` に表示名
- サイズ：`sm` 32px / `md` 40px / `lg` 64px
- 絵文字プリセット（`src/lib/avatar.ts` の 24 種）を表示。未設定なら表示名の頭文字
- 写真アップロードは行わない。**軽さと、生活アプリとしての気安さを優先した選択**

### 8.8 Toast

`sonner` を `position="top-center"` / `richColors` で使う（`ui/toaster.tsx`、ルートに 1 つだけ）。
エラー表示は原則サイレント。ユーザーの操作が失われた場合など、
知らせないと困るときにだけトーストを出す。

---

## 9. 機能コンポーネントの型

`src/components/` 配下の機能別ディレクトリにある、繰り返し現れるパターン。

### 9.1 タスク行（`task/task-item.tsx`）

このアプリで最も多く表示される要素。密度を優先し `px-3 py-1.5` と浅く取る。

- カード：`bg-surface rounded-lg border-border`、行間は `gap-1`（4px）
- **期日による左端アクセント**：`border-l-2` の色で切迫度を示す

  | 状態 | 色 |
  |---|---|
  | 期日超過 | `border-l-danger` |
  | 今日 | `border-l-warning`（日付ラベルの後に `!` を添える） |
  | 明日 | `border-l-caution` |
  | それ以外 | 通常の `border-border` のみ |

  期日ラベルの文字色も同じスケールで連動させる。
- チェックボックス：20px の円 + `border-2`。未完了は `border-border-strong`（ホバーで `border-primary`）、
  完了は `border-success bg-success` + 白いチェック
- タイトル：`text-sm font-medium truncate`。完了時は `text-subtle line-through`
- メタ行：`text-xs` で期日と作成者
- **左スワイプで削除できるのは完了済みタスクのみ**（ドラッグ上限 72px / 確定しきい値 60px）。
  スワイプにつれて背面の `bg-danger` とゴミ箱アイコンが不透明度と拡大でせり出す。
  未完了タスクを誤って消せないようにするための制限
- 並べ替えハンドル（`GripVertical` 14px）は、手動並び順の未完了タスクにのみ表示する

### 9.2 カテゴリタブ（`category/category-tabs.tsx`）

- タブは `flex-1` で等幅。`text-sm font-medium`、`py-1.5`
- 選択中の背景は、カテゴリ色 10%（`${color}1a`）の角丸ピルを絶対配置し、
  `transform` と `width` を 0.25s `ease-out` でスライドさせる
- ラベル色：選択中はカテゴリ色、非選択は `--text-muted`
- 横スワイプでのカテゴリ切り替えとインジケータ位置を同期させる
  （`useSwipeableTab` に測定値を渡す設計）
- 読み込み中は `bg-surface-strong` のパルスするピルを 3 個並べる

### 9.3 定番品カード（`staple/staple-item-card.tsx`）

グリッド表示。**タップ＝タスクへ追加、長押し（500ms）＝編集** という二段構えの操作。

- カード：`rounded-xl border-border bg-surface`、押下時 `bg-surface-strong`
- カテゴリがあれば左に 3px のカテゴリ色ボーダー
- 縦積み：絵文字（`text-2xl`）→ 名前（`text-xs font-medium`）→ 数量（`text-[10px]`）→
  使用回数バッジ（`bg-primary/10 text-primary`）→ カテゴリピル（カテゴリ色 12.5% 背景）
- 編集モードでは無限ループの微小な回転で「触ると消せる」ことを示し、
  左上に削除バッジを出す

### 9.4 レコメンドカード（`recommendation/recommendation-card.tsx`）

- `rounded-lg border-border p-3`、カテゴリ色の 3px 左ボーダー
- タイトル `text-sm font-medium`、経過日数と推定周期を `text-xs text-muted`
- アクションは右寄せで `ghost`「スキップ」＋ `primary`「作成する」の 2 択

### 9.5 スケルトン

読み込み中はスピナーではなく、**実際のレイアウトと同じ形のプレースホルダ**を出す。
`bg-surface-strong` + `animate-pulse` で、確定後のレイアウトシフトを起こさない形状にする。

### 9.6 空状態

`py-20` の余白を取り、`text-subtle` で 2 行。
主文（`text-lg`）で状況を、副文（`text-sm`）で次にすべき操作を示す。

```
タスクがありません
右下の＋ボタンで追加しましょう
```

---

## 10. 画面レイアウト

### 10.1 一覧画面（ホーム・設定）

```
<div class="min-h-dvh bg-background">
  <header class="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-border">
    …タイトル（text-lg font-bold）／メンバーアバター／設定ボタン
    …カテゴリタブ行
  </header>
  <main class="pt-2 mx-auto w-full md:max-w-2xl">
    …コンテンツ（リストは px-4 pb-24）
  </main>
  <Fab />
</div>
```

- ルートは常に `min-h-dvh`（`min-h-screen` は使わない。モバイルの URL バー伸縮に追随しないため）
- ヘッダーは半透明 `bg-surface/95` + `backdrop-blur` で、スクロール中も下の内容が透ける
- コンテンツ幅は広い画面で `md:max-w-2xl`（設定画面は `max-w-lg`）に制限して中央寄せ
- リスト末尾に `pb-24` を必ず入れ、最後の項目が FAB に隠れないようにする

### 10.2 単独画面（ログイン・世帯作成 / 参加・エラー・404）

```
<div class="flex min-h-dvh items-center justify-center bg-background px-4">
```

垂直中央に寄せ、その中にカードとフォームを置く。ヘッダーも FAB も持たない。

見出しは `text-2xl font-bold`（一覧画面のヘッダー見出しは `text-lg font-bold`）。
画面の性格でサイズが 2 段階に分かれる：**単独画面はその見出しが画面の主役**なので大きく、
**一覧画面の見出しは常時表示される枠**なのでコンテンツを圧迫しないよう小さく取る。

招待コードの入力欄だけは特殊で、`text-2xl font-mono tracking-widest uppercase` に
中央揃えを組み合わせる。桁の区切りを目で数えられること、
小文字と大文字の見間違いが起きないことを優先した形。

### 10.3 設定画面のカード

セクションごとに `rounded-xl bg-surface p-4 border border-border` のカードを
`gap-6` で縦に並べる。カード内にさらに枠線を入れ子にしない。

---

## 11. レスポンシブ

モバイルファースト。無指定のスタイルがモバイル、`md:` などの接頭辞で広い画面を上書きする。

| ブレークポイント | 幅 | 変化 |
|---|---|---|
| 既定 | 〜639px | 単一カラム。シートは下端吸着 |
| `sm` | 640px〜 | `Modal` が中央配置に切り替わる |
| `md` | 768px〜 | `BottomSheet` が中央配置・全周角丸・ドラッグ無効・ハンドル非表示。<br>コンテンツ幅が `max-w-2xl` に制限される |

`viewport` 設定（`src/app/layout.tsx`）：

- `maximumScale: 1` / `userScalable: false` — アプリらしい操作感のためピンチズームを止める。
  その代わり、文字を拡大しなくても読めるサイズ（§4.2）を守る責任がこちら側にある
- `interactiveWidget: "resizes-content"` — キーボード表示時にビューポートを縮める。
  `BottomSheet` のキーボード回避（§8.3）はこの設定を前提にしている
- `themeColor: "#ffffff"`

---

## 12. アクセシビリティ

### 12.1 コントラスト比

| 前景 / 背景 | 比 | 判定 |
|---|---|---|
| `#111111` / `#f6f5f4` | 約 17:1 | AAA |
| `#615d59`（muted）/ `#ffffff` | 約 6.5:1 | AA（本文可） |
| `#c4441e`（danger）/ `#ffffff` | 約 5.0:1 | AA |
| `#a85420`（caution）/ `#ffffff` | 約 5.3:1 | AA |
| `#0075de`（primary）/ `#ffffff` | 約 4.6:1 | AA（余裕は小さい） |
| `#dd5b00`（warning）/ `#ffffff` | 約 3.8:1 | 大きい文字・UI 部品のみ |
| `#1aae39`（success）/ `#ffffff` | 約 2.9:1 | **文字色に使わない** |
| `#a39e98`（subtle）/ `#ffffff` | 約 2.7:1 | **本文に使わない** |

守るべきルール：

- **`--text-subtle` は、それだけが情報を担うテキストに使わない。** 用途はプレースホルダ、
  すでに別の手掛かり（打ち消し線）を持つ完了済みタイトル、補助的なメタ情報に限る
- **`--success` は塗りとして使い、文字色にしない。** 完了チェックが緑地に白いチェックで
  比 2.9:1 しかないことは、形状（チェックマーク）と打ち消し線の冗長化で補っている
- **`--warning` は `text-xs` の期日ラベルで使っている。** 色だけでなく左端のアクセント枠と
  `!` 記号を併記することが前提であり、単独で使わない

### 12.2 フォーカスと操作

- 入力欄は `focus:border-focus` + `focus:ring-2 focus:ring-focus/15` で明示する
- **ボタン類はブラウザ既定のフォーカスリングに委ねている（既知の弱点）。**
  スタイルを追加する際は `outline: none` で潰さないこと
- アイコンのみのボタンには `aria-label` を必ず付ける（設定・並び替え・タスク追加・削除など）
- 確認ダイアログは `role="dialog"` / `aria-modal="true"` を持ち、
  初期フォーカスをキャンセル側に置き、Escape で閉じられる
- モーダル / シートが開いている間は背面のスクロールをロックする

### 12.3 文言

- **すべての表示文字列は日本語。** 英語の新規追加は不可
- ボタンラベルは動詞で終える（「作成する」「削除する」「スキップ」）
- 破壊的操作の確認文には、対象の件数と取り消せるかどうかを書く
  （例：「11件の完了済みタスクを削除します。削除後は『元に戻す』から復元できます。」）

---

## 13. 新しい UI を作るときのチェックリスト

1. `src/components/ui/` に使えるプリミティブがないか確認する。あれば必ずそれを使う
2. 色はトークン名で書く。16 進数を直書きしていないか
3. 面はまず「`bg-surface` + `border-border`」で作る。影を足す前に §7 を読む
4. 文字は `text-sm` / `font-medium` を起点にする。10px 以下を使っていないか
5. 触れる要素の当たり判定が 40px 以上あるか。足りなければパディングと負マージンで広げる
6. 状態を色だけで表していないか。形・位置・文言のいずれかを重ねているか
7. アニメーションは 250ms 以内か。§6.1 の標準パラメータから外れていないか
8. アイコンのみのボタンに `aria-label` があるか
9. 表示文字列はすべて日本語か
10. ルート要素は `min-h-dvh` か（`min-h-screen` になっていないか）
