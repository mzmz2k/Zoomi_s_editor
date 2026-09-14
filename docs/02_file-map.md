# ディレクトリ構成と主要ファイル

```
Zoomi_s_editor/
├── .githooks
│   ├── _pre-push
│   └── pre-commit
├── .github
│   └── workflows
│       └── release.yml
├── .gitignore
├── .vscode
│   └── extensions.json
├── LICENSE.txt
├── README.md
├── THIRD_PARTY_LICENSES.txt
├── myicon.png
├── package-lock.json
├── package.json
├── scripts
│   ├── build.js
│   ├── generate_filemap.js
│   ├── generate_filemap.test.js
│   └── generate_licenses.js
├── src
│   ├── assets
│   │   ├── javascript.svg
│   │   └── tauri.svg
│   ├── build.js
│   ├── bundle.js
│   ├── dialog.js
│   ├── diff.js
│   ├── index.html
│   ├── layout.js
│   ├── main.js
│   ├── outline.js
│   ├── save.js
│   ├── save.test.js
│   ├── settings.js
│   └── styles.css
└── src-tauri
    ├── .gitignore
    ├── 2
    ├── Cargo.lock
    ├── Cargo.toml
    ├── build.rs
    ├── capabilities
    │   ├── default.json
    │   └── desktop.json
    ├── gen
    │   └── schemas
    │       ├── acl-manifests.json
    │       ├── capabilities.json
    │       ├── desktop-schema.json
    │       └── windows-schema.json
    ├── src
    │   ├── lib.rs
    │   └── main.rs
    └── tauri.conf.json
```

## 依存関係
📄 `scripts/build.js`
  └── import esbuild
  └── import fs
  └── import ./generate_licenses.js

📄 `scripts/generate_filemap.js`
  └── import fs
  └── import path

📄 `scripts/generate_filemap.test.js`
  └── import vitest
  └── import ./generate_filemap.js
  └── import $lib/components
  └── import lucide-svelte

📄 `scripts/generate_licenses.js`
  └── import fs
  └── import path

📄 `src/build.js`
  └── import esbuild
  └── import fs

📄 `src/dialog.js`
  └── import ./diff.js

📄 `src/diff.js`
  └── import diff

📄 `src/main.js`
  └── import @codemirror/view
  └── import @codemirror/state
  └── import @codemirror/commands
  └── import @codemirror/search
  └── import @codemirror/view
  └── import ./save.js
  └── import ./dialog.js
  └── import ./outline.js
  └── import ./settings.js
  └── import ./layout.js
  └── import lucide

📄 `src/outline.js`
  └── import lucide

📄 `src/save.test.js`
  └── import vitest

📄 `src-tauri/src/lib.rs`
  └── use/mod std::fs

## 各ファイル詳細

### scripts/
- `scripts/build.js` : esbuild を実行し、アプリバージョンとビルド日を自動注入するビルドスクリプト
- `scripts/generate_filemap.js` : （説明未記載）
  - `export const Extractor`
- `scripts/generate_filemap.test.js` : （説明未記載）
- `scripts/generate_licenses.js` : 依存ライブラリのライセンス全文を収集し、THIRD_PARTY_LICENSES.txt を自動生成するスクリプト
  - `export function generateThirdPartyLicenses()`

### src/
- `src/build.js` : esbuild を実行し、アプリバージョンとビルド日を自動注入するビルドスクリプト
- `src/bundle.js` : （説明未記載）
- `src/dialog.js` : HTMLベースのカスタムダイアログの表示・非表示を管理するモジュール
  - `export function showConflictDialog({ diskText, editorText })`
  - `export function showUnsavedDialog()`
- `src/diff.js` : テキスト差分（Diff）計算およびHTML整形を行うモジュール
  - `export function renderDiff(diskText, editorText)`
- `src/layout.js` : src/layout.js
  - `export function initLayout(options)`
  - `export function toggleOutline()`
  - `export function setPreviewState(state)`
  - `export function cyclePreview()`
  - `export function syncPreviewToPos(pos)`
  - `export const updatePreviewContent`
- `src/main.js` : （説明未記載）
- `src/outline.js` : アウトライン（目次）とブックマークの解析・DOM構築を行うモジュール
  - `export function initOutline(editorView, getSettings, defaultPresets, messageFn)`
  - `export function parseOutlineAndBookmarks()`
- `src/save.js` : ファイル保存、自動保存、バックアップ、および競合検知を担当するモジュール
  - `export class SaveManager`
- `src/save.test.js` : （説明未記載）
- `src/settings.js` : 設定・テーマ・ショートカットの管理および設定画面UIモジュール
  - `export const defaultPresets`
  - `export const shortcutDefs`
  - `export const themePresets`
  - `export const currentSettings`
  - `export const shortcuts`
  - `export function hexToRgba(hex, alpha)`
  - `export function applySettingsToStyle()`
  - `export function loadSettings()`
  - `export function saveAllSettings()`
  - `export function initSettingsUI(options)`
  - `export function renderOutlineSettings()`
  - `export function updateTextSlotPreview()`
  - `export function loadTextSlotData(n)`

### src-tauri/
- `src-tauri/build.rs` : （説明未記載）

### src-tauri/src/
- `src-tauri/src/lib.rs` : Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  - `pub fn run()`
- `src-tauri/src/main.rs` : Prevents additional console window on Windows in release, DO NOT REMOVE!!

