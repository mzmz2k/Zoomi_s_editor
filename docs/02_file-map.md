# ディレクトリ構成と主要ファイル

```
ZoomisEditor/
├── .githooks
│   ├── _pre-push
│   └── pre-commit
├── .gitignore
├── .vscode
│   └── extensions.json
├── README.md
├── myicon.png
├── package-lock.json
├── package.json
├── scripts
│   ├── generate_filemap.js
│   └── generate_filemap.test.js
├── src
│   ├── assets
│   │   ├── javascript.svg
│   │   └── tauri.svg
│   ├── bundle.js
│   ├── dialog.js
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
📄 `scripts/generate_filemap.js`
  └── import fs
  └── import path

📄 `scripts/generate_filemap.test.js`
  └── import vitest
  └── import ./generate_filemap.js
  └── import $lib/components
  └── import lucide-svelte

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

📄 `src/save.test.js`
  └── import vitest

📄 `src-tauri/src/lib.rs`
  └── use/mod std::fs

## 各ファイル詳細

### scripts/
- `scripts/generate_filemap.js` : （説明未記載）
  - `export const Extractor`
- `scripts/generate_filemap.test.js` : （説明未記載）

### src/
- `src/bundle.js` : （説明未記載）
- `src/dialog.js` : HTMLベースのカスタムダイアログの表示・非表示を管理するモジュール
  - `export function showConflictDialog()`
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

