# ディレクトリ構成と主要ファイル

```
Zoomi_s_editor/
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
│   ├── index.html
│   ├── main.js
│   ├── save.test.js
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

📄 `src/save.test.js`
  └── import vitest

## 各ファイル詳細

### scripts/
- `scripts/generate_filemap.js` : （説明未記載）
  - `export const Extractor`
- `scripts/generate_filemap.test.js` : （説明未記載）

### src/
- `src/bundle.js` : （説明未記載）
- `src/main.js` : （説明未記載）
- `src/save.test.js` : （説明未記載）

### src-tauri/
- `src-tauri/build.rs` : （説明未記載）

### src-tauri/src/
- `src-tauri/src/lib.rs` : Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  - `pub fn run()`
- `src-tauri/src/main.rs` : Prevents additional console window on Windows in release, DO NOT REMOVE!!

