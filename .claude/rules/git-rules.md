# Git Rules

> 参照タイミング：コミット作成、ブランチ作成、PR 作成のとき。

---

## コミットメッセージ形式

**Conventional Commits 形式**（既存の git log に準拠）。日本語の本文を許容する。

```
<type>: <件名（日本語可、50文字以内目安）>

<本文（任意・なぜ変更したかを書く）>
```

### type 一覧

| type | 用途 |
|---|---|
| `feat` | 新機能の追加 |
| `fix` | バグ修正 |
| `refactor` | 挙動を変えないリファクタリング |
| `style` | フォーマット・スタイル調整（ロジック変更なし） |
| `docs` | ドキュメントのみの変更 |
| `chore` | 設定・依存・ビルド周りなど雑務 |
| `test` | テストの追加・修正 |
| `perf` | パフォーマンス改善 |

### 例（既存ログより）

```
fix: タスク明細でカテゴリなし選択を不可に
feat: add custom monochrome badge icon for push notifications
fix settings.json
```

### ルール

- **件名は命令形 or 体言止め**。「〜した」「〜します」は使わない。
- **件名末尾にピリオド `.` や句点 `。` を付けない**。
- **件名は 50 文字以内目安**、本文は 72 文字で改行。
- **何を / なぜ** を本文に書く（How はコードで読める）。
- **1 コミット 1 論理単位**。無関係な変更を混ぜない。
- **ユーザーから明示的に指示されたときだけ commit する**。勝手に commit しない。
- **`--amend` は使わない**。常に新しいコミットを作る（pre-commit hook 失敗時も同様）。
- **`--no-verify` 禁止**。pre-commit hook が失敗したら根本原因を直す。
- **シークレット（`.env.local` 等）を絶対にコミットしない**。`git add -A` / `git add .` は避け、ファイル名指定で staging する。

---

## ブランチ命名規則

`main` から派生する作業ブランチは以下の形式：

```
<type>/<short-description-in-kebab-case>
```

例：

```
feat/task-priority
fix/realtime-dedup
refactor/use-tasks-cleanup
chore/upgrade-nextjs
```

- `type` はコミットメッセージの type に揃える。
- 説明は **kebab-case（英数小文字 + ハイフン）**。
- Claude Code が自動で作る `claude/...` ブランチも許容（既存運用）。
- `main` への直接 push は避け、PR 経由でマージする。
- **`main` への force push は禁止**。

---

## PR 運用

- タイトルはコミットメッセージと同じ規則（type プレフィックス + 件名）。
- 説明には「変更内容」「目的・背景」「動作確認手順」を含める。
- マイグレーションを含む PR は説明に **マイグレーション番号と影響範囲** を明記する。
- DB スキーマ変更を含む PR は型再生成（`src/types/database.ts`）も同 PR 内で済ませる。
