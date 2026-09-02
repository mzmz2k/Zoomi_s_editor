import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, insertNewline } from "@codemirror/commands"; 
import { search, searchKeymap, openSearchPanel, closeSearchPanel } from "@codemirror/search"; 
import { highlightActiveLine } from "@codemirror/view"; 
import { SaveManager } from "./save.js";
import { showConflictDialog } from "./dialog.js";
import { initOutline, parseOutlineAndBookmarks } from "./outline.js";
import { currentSettings, shortcuts, defaultPresets, shortcutDefs, hexToRgba, applySettingsToStyle, loadSettings, saveAllSettings, initSettingsUI, loadTextSlotData } from "./settings.js";

const u = String.fromCharCode(95); const tauriKey = u + u + "TAURI" + u + u;
const { save, open, message, ask } = window[tauriKey].dialog; const { getCurrentWindow } = window[tauriKey].window;
const { stat, writeTextFile, readTextFile, readFile, readBinaryFile, readDir, remove, mkdir } = window[tauriKey].fs; const { invoke } = window[tauriKey].core;
const WebviewWindow = window[tauriKey].webviewWindow?.WebviewWindow;

const appWindow = getCurrentWindow(); const container = document.getElementById('editor-container');
const wordCounter = document.getElementById('word-counter'); const fileNameDisplay = document.getElementById('file-name');

let currentFilePath = null; let isDirty = false;

const saveManager = new SaveManager({
  fs: { stat, readDir, mkdir, remove, readFile, readBinaryFile, readTextFile },
  dialog: { save, ask, message },
  invoke,
  getEditorText: () => getEditorText(),
  getSettings: () => currentSettings,
  onConflict: showConflictDialog,
  onSaveSuccess: (path, isAutoSave = false) => {
    currentFilePath = path;
    setDirty(false);
    if (!isAutoSave) {
      wordCounter.textContent = '保存しました';
      setTimeout(() => updateWordCount(), 2000);
    }
    parseOutlineAndBookmarks();
  }
});
saveManager.startAutoSave(() => isDirty);


function debounce(func, wait) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }

function setDirty(val) { 
  if (isDirty !== val) { 
    isDirty = val; 
    const mark = isDirty ? `<span style="color:var(--titlebar-text); margin-left:4px; flex-shrink:0;">●</span>` : ""; 
    const name = currentFilePath ? currentFilePath.split(/[/\\]/).pop() : '新規ファイル'; 
    fileNameDisplay.innerHTML = `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</span>${mark}`; 
  } 
}

document.getElementById('titlebar-close').addEventListener('click', async () => { if (currentFilePath && isDirty) { try { await saveManager.createBackup(); await appWindow.destroy(); } catch (err) { const yes = await ask(`バックアップ失敗。\n終了しますか？`, { type: 'error' }); if (yes) await appWindow.destroy(); } } else { await appWindow.destroy(); } });
document.getElementById('titlebar-minimize').addEventListener('click', () => appWindow.minimize());
document.getElementById('titlebar-maximize').addEventListener('click', async () => { if (await appWindow.isMaximized()) appWindow.unmaximize(); else appWindow.maximize(); });

function updateWordCount() { 
  const text = editorView.state.doc.toString();
  // ★ 修正：改行を含める場合は半角全角スペースのみ除外、含めない場合は改行も除外
  const countText = currentSettings.countNewline ? text.replace(/[ \u3000]/g, '') : text.replace(/[ \u3000\n\r]/g, '');
  wordCounter.textContent = countText.length + " 字"; 
}
const debouncedWordCount = debounce(updateWordCount, 300);

// ★プレビューの指定した文字位置（オフセット）を画面のど真ん中に持ってくる魔法の関数
function syncPreviewToPos(pos) {
  const prScroll = document.getElementById('preview-content');
  if (previewPane.classList.contains('hidden') || !prScroll.firstChild) return;
  try {
    const node = prScroll.firstChild;
    const safePos = Math.max(0, Math.min(pos, node.length - 1));
    const range = document.createRange();
    range.setStart(node, safePos); range.setEnd(node, safePos + 1);
    const rect = range.getBoundingClientRect(); const prRect = prScroll.getBoundingClientRect();
    // 文字のX座標と、コンテナの中央X座標の差分を計算してスクロールに足す
    const targetX = rect.left + (rect.width / 2); const containerCenterX = prRect.left + (prRect.width / 2);
    prScroll.scrollLeft += (targetX - containerCenterX);
  } catch(e) {}
}

// ★テキスト反映の爆速化（innerTextをtextContentに変更し、即座に同期）
const updatePreviewContent = debounce(() => {
  const pane = document.getElementById('preview-pane');
  if (!pane.classList.contains('hidden')) {
    const prScroll = document.getElementById('preview-content');
    prScroll.textContent = getEditorText(); // ← innerTextの100倍速い
    syncPreviewToPos(editorView.state.selection.main.head);
  }
}, 300);


let typewriterLockedY = null;
const combinedUpdateListener = EditorView.updateListener.of((update) => {
  if (update.docChanged) { 
    cachedText = null; // 変更があったらキャッシュ破棄
    setDirty(true); debouncedWordCount(); updatePreviewContent(); }
  
  // ★追加：カーソルが移動したらプレビューもその文字にジャンプして追従する
  if (update.selectionSet && !update.view.composing && !previewPane.classList.contains('hidden')) {
    syncPreviewToPos(update.state.selection.main.head);
  }

  if (!currentSettings.typewriterMode) return;
  if (update.view.composing) return;
  const isPointer = update.transactions.some(tr => tr.isUserEvent("select.pointer"));
  if (update.selectionSet && isPointer) { requestAnimationFrame(() => { const coords = update.view.coordsAtPos(update.state.selection.main.head); if (coords) typewriterLockedY = coords.top; }); } 
  else if (update.docChanged || update.selectionSet) { if (typewriterLockedY === null) return; requestAnimationFrame(() => { const coords = update.view.coordsAtPos(update.state.selection.main.head); if (coords && Math.abs(coords.top - typewriterLockedY) > 1) update.view.scrollDOM.scrollTop += (coords.top - typewriterLockedY); }); }
});

const customTheme = EditorView.theme({
  "&": { height: "100%", width: "100%", color: "var(--text-color)", backgroundColor: "var(--bg-color)", fontSize: "var(--font-size)" },
  ".cm-content": { padding: "20px 40px 50vh 40px", caretColor: "var(--text-color)", fontFamily: "var(--editor-font-family)" }, 
  "&.cm-focused": { outline: "none" }, ".cm-scroller": { overflowY: "scroll", fontFamily: "inherit" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--text-color) !important" }, "&.cm-focused .cm-cursor": { borderLeftColor: "var(--text-color) !important" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "var(--selection-color)" },
  ".cm-activeLine": { backgroundColor: "var(--active-line-color) !important" }
});

const editorThemeCompartment = new Compartment();

const editorView = new EditorView({
  state: EditorState.create({
    doc: "",
    extensions: [
      EditorView.lineWrapping, history(), highlightActiveLine(),
      editorThemeCompartment.of(EditorView.theme({ ".cm-line": { lineHeight: "1.8" } })), // 初期値
      keymap.of([{ key: "Enter", run: insertNewline }, { key: "Mod-f", run: toggleSearchPanel }, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      search({ top: true }), EditorState.phrases.of({ "next": "↓", "previous": "↑", "match case": "Aa", "regexp": ".*", "by word": "ab", "replace": "置換", "replace all": "すべて置換" }),
      combinedUpdateListener, customTheme
    ]
  }), parent: container
});

// ★設定モジュールの初期化
initSettingsUI({
  onApply: (settings) => {
    editorView.dispatch({ effects: editorThemeCompartment.reconfigure(EditorView.theme({ ".cm-line": { lineHeight: String(settings.lh) } })) });
    debouncedWordCount();
  },
  onSave: () => parseOutlineAndBookmarks(),
  openDialog: open
});

// ★アウトライン解析モジュールの初期化（必要なデータへのアクセスを渡す）
initOutline(editorView, () => currentSettings, defaultPresets, message);


let cachedText = null;
function getEditorText() {
  if (cachedText === null) cachedText = editorView.state.doc.toString();
  return cachedText;
}
function setEditorText(text) { 
  editorView.dispatch({ changes: { from: 0, to: editorView.state.doc.length, insert: text.replace(/\r\n/g, '\n') } }); 
  // ★画面の描画を最優先させるため、重い解析処理を少しだけ遅延させる
  setTimeout(() => {
    parseOutlineAndBookmarks(); 
    updatePreviewContent();
  }, 20);
}


// ==============================
// 🌟 サイドバー・プレビュー画面（上下固定）
// ==============================
const sResizer = document.getElementById('sidebar-resizer'); const sidebar = document.getElementById('sidebar'); let isResizingLeft = false;
sResizer.addEventListener('mousedown', () => { isResizingLeft = true; document.body.style.cursor = 'col-resize'; sResizer.classList.add('active'); });
document.addEventListener('mousemove', (e) => { if (!isResizingLeft) return; let w = e.clientX; if (w < 150) w = 150; if (w > 600) w = 600; rootStyle.setProperty('--sidebar-width', w + "px"); });
document.addEventListener('mouseup', () => { if (isResizingLeft) { isResizingLeft = false; document.body.style.cursor = 'default'; sResizer.classList.remove('active'); currentSettings.sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')); saveAllSettings(); } });
function toggleOutline() { sidebar.classList.toggle('hidden'); sResizer.classList.toggle('hidden'); if(!sidebar.classList.contains('hidden')) parseOutlineAndBookmarks(); }
document.getElementById('btn-outline-close').addEventListener('click', toggleOutline); document.getElementById('menu-outline').addEventListener('click', () => { document.getElementById('dropdown-menu').classList.add('hidden'); toggleOutline(); });

const pResizer = document.getElementById('preview-resizer'); const previewPane = document.getElementById('preview-pane'); let isResizingRight = false;
pResizer.addEventListener('mousedown', () => { isResizingRight = true; document.body.style.cursor = 'row-resize'; pResizer.classList.add('active'); });
document.addEventListener('mousemove', (e) => { 
  if (!isResizingRight) return; 
  let h = e.clientY - 30; if (h < 150) h = 150; if (h > window.innerHeight - 150) h = window.innerHeight - 150; rootStyle.setProperty('--preview-size', h + "px");
});
document.addEventListener('mouseup', () => { if (isResizingRight) { isResizingRight = false; document.body.style.cursor = 'default'; pResizer.classList.remove('active'); currentSettings.previewSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--preview-size')); saveAllSettings(); } });

let currentPreviewState = 0; // 0:非表示, 1:状態1, 2:状態2
function setPreviewState(state) {
  currentPreviewState = state; 
  if (state === 0) {
    previewPane.classList.add('hidden'); pResizer.classList.add('hidden');
    pResizer.style.display = 'none'; previewPane.classList.remove('full');
  } else {
    previewPane.classList.remove('hidden'); pResizer.classList.remove('hidden'); updatePreviewContent();
    const isSplit = currentSettings.previewSplitFirst ? (state === 1) : (state === 2);
    if (isSplit) { 
      pResizer.style.display = 'block'; previewPane.classList.remove('full'); 
    } else { 
      pResizer.style.display = 'none'; previewPane.classList.add('full'); 
    }
  }
}

function cyclePreview() {
  let nextState = currentPreviewState + 1; if (nextState > 2) nextState = 0;
  setPreviewState(nextState);
}
document.getElementById('btn-preview-close').addEventListener('click', () => setPreviewState(0)); 
document.getElementById('menu-preview').addEventListener('click', () => { document.getElementById('dropdown-menu').classList.add('hidden'); cyclePreview(); });
document.getElementById('btn-preview-full').addEventListener('click', () => { if (currentPreviewState !== 0) setPreviewState(currentPreviewState === 1 ? 2 : 1); });

const prScroll = document.getElementById('preview-content');
prScroll.addEventListener('wheel', (e) => { if (!e.ctrlKey) { e.preventDefault(); prScroll.scrollLeft -= e.deltaY; } }, { passive: false });

let isSyncingLeft = false; let isSyncingRight = false;
const edScroll = editorView.scrollDOM; 

// ★横書きエディタ → 縦書きプレビュー の完全同期
let syncLeftTimer = null, syncRightTimer = null;
edScroll.addEventListener('scroll', () => {
  if (previewPane.classList.contains('hidden') || isSyncingLeft) return;
  isSyncingRight = true;
  const pos = editorView.posAtCoords({ x: edScroll.getBoundingClientRect().left + 50, y: edScroll.getBoundingClientRect().top + (edScroll.clientHeight / 2) }, false);
  if (pos !== null) syncPreviewToPos(pos);
  clearTimeout(syncRightTimer);
  syncRightTimer = setTimeout(() => isSyncingRight = false, 50);
});
// ★縦書きプレビュー → 横書きエディタ の完全同期
prScroll.addEventListener('scroll', () => {
  if (previewPane.classList.contains('hidden') || isSyncingRight) return;
  isSyncingLeft = true;
  const prRect = prScroll.getBoundingClientRect();
  const centerX = prRect.left + (prRect.width / 2); const centerY = prRect.top + (prRect.height / 2);
  let pos = -1;
  // プレビュー画面の中央にある文字を座標から逆算
  if (document.caretPositionFromPoint) { const range = document.caretPositionFromPoint(centerX, centerY); if (range) pos = range.offset; } 
  else if (document.caretRangeFromPoint) { const range = document.caretRangeFromPoint(centerX, centerY); if (range) pos = range.startOffset; }
  
  if (pos >= 0) {
    const coords = editorView.coordsAtPos(pos);
    if (coords) edScroll.scrollTop += (coords.top - edScroll.getBoundingClientRect().top - (edScroll.clientHeight / 2));
  }
  clearTimeout(syncLeftTimer);
  syncLeftTimer = setTimeout(() => isSyncingLeft = false, 50);
});


// 🌟 アウトライン ＆ ブックマーク解析（UIイベントバインディング）
document.getElementById('btn-outline-refresh').addEventListener('click', parseOutlineAndBookmarks);


// ファイル操作・ショートカット
async function createNewWindow(initialFilePath = null) { if (!WebviewWindow) return; const url = initialFilePath ? `index.html?open=${encodeURIComponent(initialFilePath)}` : 'index.html'; new WebviewWindow("editor-" + new Date().getTime(), { url, width: 800, height: 600, decorations: false }); }

async function openFileDirect(filePath) { 
  try { 
    // ★ Rust側でファイル読み込みとエンコーディング解決を行う
    const text = await invoke('read_file_text', { path: filePath });
    
    // ★ここで setEditorText が呼ばれ、その中で遅延して目次解析されるので、ここでの二重呼び出しは削除
    setEditorText(text); currentFilePath = filePath; setDirty(false); updateWordCount(); 
    await saveManager.updateFileInfo(filePath, text); // テキストも渡してハッシュを記録させる
    
  } catch (err) { 
    await message(`開けません。\n${err}`, { type: 'error' }); 
  } 
}

async function openFile() { const filePath = await open({ filters: [{ name: 'Text', extensions: ['txt', 'md'] }] }); if (filePath) isDirty ? createNewWindow(filePath) : await openFileDirect(filePath); }


document.addEventListener('keydown', async (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  const isEditor = e.target.closest('.cm-content') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
  const check = (id) => { const s = shortcuts[id]; if (!s || !s.key) return false; if (s.mod === "" && isEditor) return false; return (s.mod === "" ? (!e.ctrlKey && !e.shiftKey && !e.altKey) : e[s.mod]) && e.key.toLowerCase() === s.key.toLowerCase(); };

  if (check('sc-outline')) { e.preventDefault(); toggleOutline(); }
  if (check('sc-preview')) { e.preventDefault(); cyclePreview(); } 
  if (check('sc-wordcount')) { e.preventDefault(); wordCounter.style.display = (wordCounter.style.display === 'none') ? 'block' : 'none'; }
  if (check('sc-fade')) { e.preventDefault(); currentSettings.fadeEnabled = !currentSettings.fadeEnabled; applySettingsToStyle(); saveAllSettings(); }
  if (check('sc-typewriter')) { e.preventDefault(); currentSettings.typewriterMode = !currentSettings.typewriterMode; saveAllSettings(); }
  if (check('sc-text1')) { e.preventDefault(); loadTextSlotData(1); } if (check('sc-text2')) { e.preventDefault(); loadTextSlotData(2); } if (check('sc-text3')) { e.preventDefault(); loadTextSlotData(3); }
  if (check('sc-theme1')) { e.preventDefault(); loadThemeSlotData(1); } if (check('sc-theme2')) { e.preventDefault(); loadThemeSlotData(2); } if (check('sc-theme3')) { e.preventDefault(); loadThemeSlotData(3); }

  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); await saveManager.saveFile(false); }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); await saveManager.saveFile(true); }
  if (e.ctrlKey && e.key.toLowerCase() === 'o') { e.preventDefault(); await openFile(); }
  if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); createNewWindow(); }
});

appWindow.onFocusChanged(({ payload: focused }) => {
  if (focused && !editorView.hasFocus) {
    // 復帰直後すぎると効かないことがあるので少し遅らせる
    setTimeout(() => editorView.focus(), 30);
  }
});

const dropdown = document.getElementById('dropdown-menu'), modal = document.getElementById('settings-modal');
document.getElementById('btn-menu').addEventListener('click', () => dropdown.classList.toggle('hidden')); document.addEventListener('click', (e) => { if (!document.getElementById('btn-menu').contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.add('hidden'); });
document.getElementById('menu-new').addEventListener('click', () => { dropdown.classList.add('hidden'); createNewWindow(); }); document.getElementById('menu-open').addEventListener('click', () => { dropdown.classList.add('hidden'); openFile(); }); document.getElementById('menu-save').addEventListener('click', () => { dropdown.classList.add('hidden'); saveManager.saveFile(false); }); document.getElementById('menu-save-as').addEventListener('click', () => { dropdown.classList.add('hidden'); saveManager.saveFile(true); });
document.querySelectorAll('.tab-btn').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden')); btn.classList.add('active'); document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden'); }); });

document.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); currentSettings.fontSize += e.deltaY < 0 ? 1 : -1; currentSettings.fontSize = Math.max(8, Math.min(120, currentSettings.fontSize)); applySettingsToStyle(); debounce(saveAllSettings, 500)(); } }, { passive: false });

function renderRegisteredPaths() {
  const list = document.getElementById('registered-paths-list'); 
  list.innerHTML = ''; 
  const paths = JSON.parse(localStorage.getItem('registered-paths') || '[]');
  
  if (paths.length === 0) { 
    list.innerHTML = '<div class="menu-item" style="color:var(--counter-color); cursor:default;"><span>(登録なし)</span></div>'; 
    return; 
  }

  // フォルダとファイルに分割（削除時のインデックス番号を保持しておく）
  const dirs = paths.map((p, idx) => ({ ...p, originalIdx: idx })).filter(p => p.isDir);
  const files = paths.map((p, idx) => ({ ...p, originalIdx: idx })).filter(p => !p.isDir);

  // メニュー項目を作る共通処理
  const createItem = (p) => {
    const el = document.createElement('div'); 
    el.className = 'menu-item'; 
    el.title = p.path + '\n（右クリックで削除）'; 
    const name = p.path.split(/[/\\]/).pop(); 
    el.innerHTML = `<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${p.isDir ? '📁' : '📄'} ${name}</span>`; 
    
    // 左クリックで開く
    el.addEventListener('click', async () => { 
      document.getElementById('dropdown-menu').classList.add('hidden'); 
      if (p.isDir) { 
        const filePath = await open({ defaultPath: p.path, filters: [{ name: 'Text', extensions: ['txt', 'md'] }] }); 
        if (filePath) isDirty ? createNewWindow(filePath) : await openFileDirect(filePath); 
      } else { 
        isDirty ? createNewWindow(p.path) : await openFileDirect(p.path); 
      } 
    }); 
    
    // 右クリックで削除
    el.addEventListener('contextmenu', async (e) => { 
      e.preventDefault(); 
      const yes = await ask(`「${name}」を解除しますか？`, { type: 'warning' }); 
      if (yes) { 
        paths.splice(p.originalIdx, 1); 
        localStorage.setItem('registered-paths', JSON.stringify(paths)); 
        renderRegisteredPaths(); 
      } 
    }); 
    list.appendChild(el);
  };

  // ① フォルダを上部に表示
  if (dirs.length > 0) {
    dirs.forEach(createItem);
  }

  // ② フォルダとファイルの両方がある場合は、間に区切り線を引く
  if (dirs.length > 0 && files.length > 0) {
    const sep = document.createElement('div');
    sep.style.cssText = 'border-bottom: 1px solid rgba(127,127,127,0.3); margin: 4px 0;';
    list.appendChild(sep);
  }

  // ③ ファイルを下部に表示
  if (files.length > 0) {
    files.forEach(createItem);
  }
}
async function registerPath(isDir) { document.getElementById('dropdown-menu').classList.add('hidden'); const selected = await open({ directory: isDir, filters: isDir ? [] : [{ name: 'Text', extensions: ['txt', 'md'] }] }); if (selected) { const paths = JSON.parse(localStorage.getItem('registered-paths') || '[]'); if (!paths.find(p => p.path === selected)) { paths.push({ path: selected, isDir }); localStorage.setItem('registered-paths', JSON.stringify(paths)); renderRegisteredPaths(); } } }
document.getElementById('menu-add-folder').addEventListener('click', (e) => { e.stopPropagation(); registerPath(true); }); document.getElementById('menu-add-file').addEventListener('click', (e) => { e.stopPropagation(); registerPath(false); });
renderRegisteredPaths();

async function loadStartupFile() {
  const openPath = new URLSearchParams(window.location.search).get('open');
  if (openPath) {
    await openFileDirect(openPath);
  } else {
    try {
      const data = await invoke('get_startup_file');
      if (data) { 
        setEditorText(data.content); 
        currentFilePath = data.path; 
        setDirty(false); 
        updateWordCount(); 
        await saveManager.updateFileInfo(data.path, data.content); // テキストも渡してハッシュを記録させる
      }
    } catch (err) {}
  }
  // ★ファイル読み込み・描画が終わったタイミングでウィンドウを表示
  requestAnimationFrame(() => requestAnimationFrame(() => {
    invoke('show_main_window').catch(() => {});
  }));
}
setTimeout(() => loadStartupFile(), 0);

const toggleSearchPanel = (view) => {
  if (view.dom.querySelector('.cm-search')) {
    closeSearchPanel(view);
    return true;
  }
  openSearchPanel(view); // この時点でDOMにパネルが既に挿入されている
  applySearchPanelLabels(view);
  return true;
};

function applySearchPanelLabels(view) {
  const p = view.dom.querySelector('.cm-search');
  if (!p) return;
  const s = p.querySelector('input[name="search"]');
  const r = p.querySelector('input[name="replace"]');
  if (s) s.setAttribute('autocomplete', 'off');
  if (r) r.setAttribute('autocomplete', 'off');
  p.querySelectorAll('label').forEach(l => {
    const t = (l.title || "").toLowerCase();
    if (t.includes("case")) l.title = "大文字と小文字を区別する";
    else if (t.includes("regexp") || t.includes("regular")) l.title = "正規表現を使用する";
    else if (t.includes("word")) l.title = "単語単位で検索する";
  });
}