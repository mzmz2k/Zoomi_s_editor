# プロジェクトの基本情報とルール

## コンセプト
小説執筆にも使える、レスポンスの早いシンプルなテキストエディタ。

## 技術スタック
- ターゲットOS: Windows (MSIインストーラー形式)
- フロントエンド: Vanilla JS / HTML / CSS (CodeMirror 6 統合)
- バックエンド: Rust (Tauri v2)
- DB/認証: なし (ローカルファイル直接アクセス / Tauri FS Plugin)
- テスト: 未導入
- 通信/IPC: Tauri v2 Official Plugins (`plugin-fs`, `plugin-dialog`, `plugin-window-state`, `plugin-opener`)

---

## UI・ウィンドウ仕様
- カスタムフレームレスウィンドウ: `decorations: false`（標準枠なし。背景色 `#2c2c2c`）
- グローバルTauri有効化: `withGlobalTauri: true`
- エディタエンジン: CodeMirror 6 (`@codemirror/view`, `@codemirror/state`, `@codemirror/search`, `@codemirror/commands`)

---

## 開発ルール・設計方針

### 1. 責務の分離
- **フロントエンド:** 
  - CodeMirror 6を中心としたエディタ表示・状態管理・各種操作（検索、テキスト装飾等）。
  - カスタムタイトルバーや操作UIのハンドリング。
- **バックエンド (Rust):**
  - ネイティブファイルシステム操作（`plugin-fs`）やダイアログ表示（`plugin-dialog`）。
  - ウィンドウ状態の保存・復元（`plugin-window-state`）。

### 2. コード実装の注意点
- Tauri v2の書き方に準拠すること（v1のAPIや古い構文を使用しない）。
- フレームワーク（React, Vue, Svelte等）を使用しないシンプルな構成のため、DOM操作やCodeMirrorのExtension管理を破綻させない設計に留めること。
- ウィンドウ枠を消去（`decorations: false`）しているため、ドラッグ移動可能な領域（`data-tauri-drag-region`）や閉じる/最小化ボタンのJS制御を意識すること。