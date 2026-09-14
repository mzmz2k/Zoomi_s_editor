# 未保存変更の終了時確認ダイアログ 仕様書

## 1. 機能概要
エディタ上に未保存の変更（ダーティ状態）が存在する状態でアプリケーションを終了しようとした際、自前HTMLモーダルを表示してユーザーに「保存して終了」「保存せず終了」「キャンセル」を選択させる。
また、設定画面から本警告を無効化（スキップ）できるようにする。

## 2. 画面・UI仕様

### 2.1 未保存確認ダイアログ (`index.html`)
- **配置**: `#conflict-modal` の兄弟要素として配置（ID: `#unsaved-modal`）。
- **スタイリング**:
  - CSS変数 (`--menu-bg`, `--text-color`, `--titlebar-bg` 等) を利用し、アプリのテーマに追従。
  - ボタングループ:
    - `#btn-unsaved-save`: 「保存して終了」（強調ボタン）
    - `#btn-unsaved-discard`: 「保存せず終了」（警告・注意スタイル）
    - `#btn-unsaved-cancel`: 「キャンセル」

### 2.2 設定画面 (`#tab-backup`)
- **項目名**: `終了時に未保存の警告を表示しない`
- **ID**: `set-skip-close-unsaved-warning`
- **初期値**: `false` (デフォルトでは警告を表示する)

## 3. 処理ロジック仕様

### 3.1 終了ハンドラ (`main.js: handleAppClose`)
1. `!isDirty` の場合:
   - バックアップ処理（有効時）を実行後、`appWindow.destroy()`。
2. `isDirty && currentSettings.skipCloseUnsavedWarning` の場合:
   - 警告をスキップし、バックアップ処理後に `appWindow.destroy()`。
3. `isDirty && !currentSettings.skipCloseUnsavedWarning` の場合:
   - `showUnsavedDialog()` を表示。
   - **戻り値 `'save'`**: `await saveManager.saveFile()` を実行。成功時のみバックアップ処理を経て終了。ダイアログキャンセル等の場合は終了中止。
   - **戻り値 `'dontsave'`**: 保存せずにバックアップ処理を経て終了。
   - **戻り値 `'cancel'`**: 終了処理を中断し、エディタ画面に復帰。

### 3.2 保存マネージャー拡張 (`src/save.js`)
- `saveFile()` メソッドの返り値として `Promise<boolean>` を保証する。
  - 保存成功: `true`
  - 保存ダイアログキャンセル / エラー / 競合キャンセル: `false`

### 3.3 ウィンドウクローズのインターセプト
- カスタムタイトルバーの「×」ボタンだけでなく、OS標準の Alt+F4 やタスクバーの「閉じる」にも対応するため、Tauriの `onCloseRequested` イベントをハンドルする。

## 4. 変更対象ファイル
- `index.html`: モーダルHTML定義、設定チェックボックス追加
- `src/dialog.js`: `showUnsavedDialog()` の実装
- `src/settings.js`: `skipCloseUnsavedWarning` 設定値の追加およびバインド
- `src/save.js`: `saveFile()` の成否返却対応
- `src/main.js`: 終了ハンドラの統合とイベント紐付け