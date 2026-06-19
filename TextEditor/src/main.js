import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, insertNewline } from "@codemirror/commands"; 
import { search, searchKeymap, openSearchPanel, closeSearchPanel } from "@codemirror/search"; 
import { highlightActiveLine } from "@codemirror/view"; 

const u = String.fromCharCode(95); const tauriKey = u + u + "TAURI" + u + u;
const { save, open, message, ask } = window[tauriKey].dialog; const { getCurrentWindow } = window[tauriKey].window;
const { writeTextFile, readTextFile, readFile, readBinaryFile, readDir, remove, mkdir } = window[tauriKey].fs; const { invoke } = window[tauriKey].core;
const WebviewWindow = window[tauriKey].webviewWindow?.WebviewWindow;

const appWindow = getCurrentWindow(); const container = document.getElementById('editor-container');
const wordCounter = document.getElementById('word-counter'); const fileNameDisplay = document.getElementById('file-name');

let currentFilePath = null; let isDirty = false;
function hexToRgba(hex, alpha) { let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `rgba(${r}, ${g}, ${b}, ${alpha})`; }
function debounce(func, wait) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }
async function writeTextFileDirect(path, content) { return await invoke('save_file_direct', { path, content }); }
function setDirty(val) { 
  if (isDirty !== val) { 
    isDirty = val; 
    const mark = isDirty ? `<span style="color:var(--titlebar-text); margin-left:4px; flex-shrink:0;">●</span>` : ""; 
    const name = currentFilePath ? currentFilePath.split(/[/\\]/).pop() : '新規ファイル'; 
    fileNameDisplay.innerHTML = `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</span>${mark}`; 
  } 
}

document.getElementById('titlebar-close').addEventListener('click', async () => { if (currentFilePath && isDirty) { try { await createBackup(); await appWindow.destroy(); } catch (err) { const yes = await ask(`バックアップ失敗。\n終了しますか？`, { type: 'error' }); if (yes) await appWindow.destroy(); } } else { await appWindow.destroy(); } });
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

const rootStyle = document.documentElement.style;
const defaultPresets = [
  { id: 'pre_chap', name: '第〇章', reg: '^第.{1,2}章([\\s　]|$)' }, { id: 'pre_sec', name: '第〇節', reg: '^第.{1,2}節([\\s　]|$)' },
  { id: 'pre_bra', name: '【特殊な括弧】', reg: '^[【≪].+?[】≫]$' }, { id: 'pre_sym', name: '◆◇記号のみ', reg: '^[◆◇●○■□▼▽※]+$' },
  { id: 'pre_ast', name: '＊＊＊ (アスタリスク)', reg: '^[*＊]{3,}$' }, { id: 'pre_hyp', name: '--- (ハイフン)', reg: '^[-=]{3,}$' }
];

let currentSettings = {
  fontSize: 16, lh: 1.8, lineLength: 0, editorFont: "", uiFont: "", previewFont: "", countNewline: false, typewriterMode: false, fadeEnabled: false, fadeRangeTop: 100, fadeRangeBottom: 100, fadeOpacity: 0.8,
  activeLineEnabled: false, activeLineColor: "#ffffff", btnStyle: "mac", backupEnabled: true, backupDir: "", autoSaveEnabled: true, sidebarWidth: 250, previewSize: 350,
  bgColor: "#2c2c2c", menuBg: "#222222", titlebarBg: "#393939", textColor: "#f4f4f4", selectionColor: "#ffffff", highlightColor: "#007acc", titlebarText: "#adadad", counterColor: "#727272",
  olMd: true, olLevels: { 1: ['pre_chap'], 2: ['pre_sec'], 3: ['pre_bra', 'pre_sym'] },
  olCustoms: { 1: {n:'カスタム1', r:''}, 2: {n:'カスタム2', r:''}, 3: {n:'カスタム3', r:''}, 4: {n:'カスタム4', r:''}, 5: {n:'カスタム5', r:''}, 6: {n:'カスタム6', r:''} },
  previewSplitFirst: false 
};

const shortcutDefs = [
  { id: 'sc-outline', label: 'アウトライン切替' }, { id: 'sc-preview', label: '縦書きビュー切替' }, { id: 'sc-wordcount', label: '文字数表示切替' }, { id: 'sc-fade', label: 'フェード表示切替' }, { id: 'sc-typewriter', label: 'タイプライター切替' },
  { id: 'sc-text1', label: 'テキストセット 1 適用' }, { id: 'sc-text2', label: 'テキストセット 2 適用' }, { id: 'sc-text3', label: 'テキストセット 3 適用' }
];
let shortcuts = {}; 

function applySettingsToStyle() {
  rootStyle.setProperty('--font-size', currentSettings.fontSize + "px"); 
  rootStyle.setProperty('--line-height', currentSettings.lh); 
  // CodeMirrorに行間を即時反映
  editorView.dispatch({ effects: editorThemeCompartment.reconfigure(EditorView.theme({ ".cm-line": { lineHeight: String(currentSettings.lh) } })) });

  if (currentSettings.lineLength > 0) { rootStyle.setProperty('--max-width', `calc(${currentSettings.lineLength} * var(--font-size) + 80px)`); rootStyle.setProperty('--max-height', `calc(${currentSettings.lineLength} * var(--font-size) + 40px)`); } 
  else { rootStyle.setProperty('--max-width', '100%'); rootStyle.setProperty('--max-height', '100%'); }
  
  rootStyle.setProperty('--editor-font-family', currentSettings.editorFont || "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', sans-serif"); 
  rootStyle.setProperty('--ui-font-family', currentSettings.uiFont || "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', sans-serif"); 
  rootStyle.setProperty('--preview-font-family', currentSettings.previewFont || currentSettings.editorFont || "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', serif"); 
  
  rootStyle.setProperty('--bg-color', currentSettings.bgColor); rootStyle.setProperty('--menu-bg', currentSettings.menuBg); rootStyle.setProperty('--titlebar-bg', currentSettings.titlebarBg);
  rootStyle.setProperty('--text-color', currentSettings.textColor); rootStyle.setProperty('--selection-color', hexToRgba(currentSettings.selectionColor, 0.3));
  rootStyle.setProperty('--highlight-color', currentSettings.highlightColor); rootStyle.setProperty('--titlebar-text', currentSettings.titlebarText); rootStyle.setProperty('--counter-color', currentSettings.counterColor);
  rootStyle.setProperty('--active-line-color', currentSettings.activeLineEnabled ? hexToRgba(currentSettings.activeLineColor, 0.15) : "transparent");
  rootStyle.setProperty('--sidebar-width', currentSettings.sidebarWidth + "px"); rootStyle.setProperty('--preview-size', currentSettings.previewSize + "px");
  document.body.className = currentSettings.btnStyle === "windows" ? "btn-style-windows" : "";
  const fadeTop = document.getElementById('fade-top'), fadeBottom = document.getElementById('fade-bottom');
  if (currentSettings.fadeEnabled) { fadeTop.style.display = 'block'; fadeBottom.style.display = 'block'; fadeTop.style.height = currentSettings.fadeRangeTop + 'px'; fadeTop.style.background = `linear-gradient(to bottom, ${currentSettings.bgColor}, transparent)`; fadeTop.style.opacity = currentSettings.fadeOpacity; fadeBottom.style.height = currentSettings.fadeRangeBottom + 'px'; fadeBottom.style.background = `linear-gradient(to top, ${currentSettings.bgColor}, transparent)`; fadeBottom.style.opacity = currentSettings.fadeOpacity; } else { fadeTop.style.display = 'none'; fadeBottom.style.display = 'none'; }
  debouncedWordCount();
}

function loadSettings() { const saved = JSON.parse(localStorage.getItem('zoomi-settings') || '{}'); currentSettings = { ...currentSettings, ...saved }; shortcuts = JSON.parse(localStorage.getItem('zoomi-shortcuts') || '{}'); applySettingsToStyle(); }
function saveAllSettings() { localStorage.setItem('zoomi-settings', JSON.stringify(currentSettings)); localStorage.setItem('zoomi-shortcuts', JSON.stringify(shortcuts)); applySettingsToStyle(); parseOutlineAndBookmarks(); }
loadSettings();

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

// ==============================
// 🌟 アウトライン ＆ ブックマーク解析（動的ジャンプ）
// ==============================
function getRegexList(level) { 
  const ids = currentSettings.olLevels[level] || []; 
  return ids.map(id => { 
    if (id.startsWith('pre_')) return defaultPresets.find(p => p.id === id)?.reg; 
    // ★修正： .reg ではなく .r で取得する
    if (id.startsWith('cus_')) return currentSettings.olCustoms[id.replace('cus_','')]?.r; 
    return null; 
  }).filter(r => r && r.trim() !== ""); 
}

function buildOutlineTree(outlines) {
  const tree = []; const stack = [];
  outlines.forEach(item => {
    const node = { ...item, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) { stack.pop(); }
    if (stack.length === 0) { tree.push(node); } else { stack[stack.length - 1].children.push(node); }
    stack.push(node);
  });
  return tree;
}

function renderOutlineTree(nodes, parentEl) {
  nodes.forEach(node => {
    const wrapper = document.createElement('div'); wrapper.className = 'ol-node';
    const d = document.createElement('div'); d.className = 'ol-item'; d.style.paddingLeft = ((node.level - 1) * 12 + 4) + 'px';
    const hasChildren = node.children.length > 0;
    d.innerHTML = `${hasChildren ? '<span class="ol-toggle">▼</span>' : '<span style="width:16px;display:inline-block;"></span>'}<span class="ol-text" title="${node.text}">${node.text}</span>`;
    const childrenWrapper = document.createElement('div'); childrenWrapper.className = 'ol-children';
    
    if (hasChildren) { const t = d.querySelector('.ol-toggle'); t.addEventListener('click', (e) => { e.stopPropagation(); const isClosed = t.textContent === '▶'; t.textContent = isClosed ? '▼' : '▶'; childrenWrapper.style.display = isClosed ? 'block' : 'none'; }); }
    
    // ★ 修正：最新のドキュメントから「行番号（node.line）」をもとに正確な位置を取得してジャンプする
    d.addEventListener('dblclick', async () => { 
      const doc = editorView.state.doc;
      // 万が一、文字を消すなどして行数が減っていた場合の安全装置
      if (node.line <= doc.lines) {
        const linePos = doc.line(node.line).from;
        editorView.dispatch({ selection: { anchor: linePos }, scrollIntoView: true }); 
        editorView.focus(); 
      } else { 
        await message('行が見つかりません。アウトラインを更新(↻)してください。', {type:'warning'}); 
      }
    });
    
    wrapper.appendChild(d); wrapper.appendChild(childrenWrapper); parentEl.appendChild(wrapper);
    if (hasChildren) renderOutlineTree(node.children, childrenWrapper);
  });
}

function parseOutlineAndBookmarks() {
  const doc = editorView.state.doc; const lines = doc.lines;
  let outlines = []; let bookmarks = []; const mdEnabled = currentSettings.olMd;
  const reg1 = getRegexList(1).map(r => new RegExp(r)); const reg2 = getRegexList(2).map(r => new RegExp(r)); const reg3 = getRegexList(3).map(r => new RegExp(r));

  for (let i = 1; i <= lines; i++) {
    const line = doc.line(i); const txt = line.text;
    
    // ★ ブックマーク抽出（行番号を保存）
    const bMatch = txt.match(/(?:@@|＠＠)(.*)/);
    if (bMatch) { 
      // @@ の後ろの文字を取得。何も書いていない場合は (無名) にする
      const bText = bMatch[1].trim() || "(無名ブックマーク)";
      bookmarks.push({ line: i, text: bText.substring(0,25) + (bText.length>25?'...':'') }); 
    }
    
    // ★ アウトライン抽出（行番号を保存）
    let matchedLevel = 0; let cleanText = txt;
    if (mdEnabled && txt.startsWith('#')) { const match = txt.match(/^(#{1,6})\s+(.*)/); if (match) { matchedLevel = match[1].length; cleanText = match[2]; } }
    if (matchedLevel === 0) { if (reg1.some(r => r.test(txt))) matchedLevel = 1; else if (reg2.some(r => r.test(txt))) matchedLevel = 2; else if (reg3.some(r => r.test(txt))) matchedLevel = 3; }
    if (matchedLevel > 0) outlines.push({ line: i, text: cleanText.trim() || "(空)", level: matchedLevel });
  }
  
  // ブックマークのメニュー構築
  const bList = document.getElementById('bookmark-list'); bList.innerHTML = '';
  if (bookmarks.length === 0) { bList.innerHTML = '<div class="menu-item" style="color:var(--counter-color);">(なし)</div>'; }
  else { 
    bookmarks.forEach(b => { 
      const el = document.createElement('div'); el.className = 'menu-item'; el.textContent = '🔖 ' + b.text; 
      // ★ ブックマークも行番号ベースで正確にジャンプ
      el.addEventListener('click', async () => { 
        document.getElementById('dropdown-menu').classList.add('hidden'); 
        const doc = editorView.state.doc;
        if (b.line <= doc.lines) {
          const linePos = doc.line(b.line).from;
          editorView.dispatch({ selection: { anchor: linePos }, scrollIntoView: true }); 
          editorView.focus(); 
        } else { 
          await message('ブックマークが見つかりません。一度ファイルを保存してください。', {type:'warning'}); 
        }
      }); 
      bList.appendChild(el); 
    }); 
  }

  // アウトラインのツリー構築
  const treeBox = document.getElementById('outline-tree'); treeBox.innerHTML = '';
  if (outlines.length === 0) { treeBox.innerHTML = '<div style="padding:10px; opacity:0.5; text-align:center;">見出しがありません</div>'; return; }
  const tree = buildOutlineTree(outlines); renderOutlineTree(tree, treeBox);
}
document.getElementById('btn-outline-refresh').addEventListener('click', parseOutlineAndBookmarks);


// ==============================
// 🌟 設定画面のUIロジック
// ==============================
const scContainer = document.getElementById('shortcut-list-container');
shortcutDefs.forEach(def => {
  const d = shortcuts[def.id] || { mod: '', key: '' };
  scContainer.innerHTML += `<div class="setting-group"><label>${def.label}</label><div class="shortcut-inputs"><select id="mod-${def.id}"><option value="" ${d.mod===''?'selected':''}>なし</option><option value="ctrlKey" ${d.mod==='ctrlKey'?'selected':''}>Ctrl</option><option value="shiftKey" ${d.mod==='shiftKey'?'selected':''}>Shift</option><option value="altKey" ${d.mod==='altKey'?'selected':''}>Alt</option></select><span>+</span><input type="text" id="key-${def.id}" value="${d.key}" maxlength="1"></div></div>`;
});

function renderOutlineSettings() {
  const box = document.getElementById('ol-levels-container'); box.innerHTML = '';
  [1, 2, 3].forEach(lv => {
    const row = document.createElement('div'); row.className = 'setting-column';
    let html = `<label>階層 ${lv}</label><div style="display:flex; flex-wrap:wrap; margin-bottom:4px;">`;
    (currentSettings.olLevels[lv] || []).forEach(id => { let name = id.startsWith('pre_') ? defaultPresets.find(p=>p.id===id)?.name : currentSettings.olCustoms[id.replace('cus_','')]?.n; html += `<span class="ol-chip">${name} <span class="ol-chip-del" data-lv="${lv}" data-id="${id}">×</span></span>`; });
    html += `</div><div style="display:flex; gap:4px; width:100%;"><select id="sel-add-lv${lv}" style="flex:1;">`;
    defaultPresets.forEach(p => html += `<option value="${p.id}">${p.name}</option>`); [1,2,3,4,5,6].forEach(c => html += `<option value="cus_${c}">${currentSettings.olCustoms[c].n}</option>`);
    html += `</select><button class="btn btn-add-lv" data-lv="${lv}" style="padding:2px 8px; font-size:12px;">追加</button></div>`; row.innerHTML = html; box.appendChild(row);
  });
  document.querySelectorAll('.btn-add-lv').forEach(b => b.addEventListener('click', (e) => { const lv = e.target.dataset.lv; const val = document.getElementById(`sel-add-lv${lv}`).value; if (!currentSettings.olLevels[lv].includes(val)) { currentSettings.olLevels[lv].push(val); renderOutlineSettings(); } }));
  document.querySelectorAll('.ol-chip-del').forEach(x => x.addEventListener('click', (e) => { const lv = e.target.dataset.lv, id = e.target.dataset.id; currentSettings.olLevels[lv] = currentSettings.olLevels[lv].filter(i => i !== id); renderOutlineSettings(); }));
  updateCustomOptions();
}

function updateCustomOptions() {
  const sel = document.getElementById('select-custom-ol'); const v = sel.value; sel.innerHTML = '';
  [1,2,3,4,5,6].forEach(c => sel.innerHTML += `<option value="${c}">${currentSettings.olCustoms[c].n}</option>`); sel.value = v; document.getElementById('input-custom-reg').value = currentSettings.olCustoms[v]?.r || ""; testCustomReg();
}
function testCustomReg() {
  const regStr = document.getElementById('input-custom-reg').value; const text = document.getElementById('test-custom-text').value; const res = document.getElementById('test-custom-result');
  if (!regStr) { res.innerHTML = text.replace(/</g,'&lt;').replace(/>/g,'&gt;'); return; }
  try { const reg = new RegExp(regStr, 'gm'); res.innerHTML = text.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(reg, match => `<span class="test-highlight">${match}</span>`); } catch(e) { res.innerHTML = `<span style="color:#ff5f56;">正規表現エラー: ${e.message}</span>`; }
}
document.getElementById('select-custom-ol').addEventListener('change', updateCustomOptions); document.getElementById('input-custom-reg').addEventListener('input', testCustomReg); document.getElementById('test-custom-text').addEventListener('input', testCustomReg);
document.getElementById('btn-save-custom-ol').addEventListener('click', () => { const num = document.getElementById('select-custom-ol').value; const reg = document.getElementById('input-custom-reg').value; const name = prompt("カスタム設定の名前", currentSettings.olCustoms[num].n); if (name) { currentSettings.olCustoms[num] = { n: name, r: reg }; updateCustomOptions(); renderOutlineSettings(); alert("保存しました"); } });


// ファイル操作・ショートカット
async function createNewWindow(initialFilePath = null) { if (!WebviewWindow) return; const url = initialFilePath ? `index.html?open=${encodeURIComponent(initialFilePath)}` : 'index.html'; new WebviewWindow("editor-" + new Date().getTime(), { url, width: 800, height: 600, decorations: false }); }

async function openFileDirect(filePath) { 
  try { 
    let text = "";
    const readBin = readFile || readBinaryFile; 
    
    if (readBin) {
      const bytes = await readBin(filePath);
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch (e) {
        text = new TextDecoder('shift-jis').decode(bytes);
      }
    } else {
      text = await readTextFile(filePath); 
    }
    
    // ★ここで setEditorText が呼ばれ、その中で遅延して目次解析されるので、ここでの二重呼び出しは削除
    setEditorText(text); currentFilePath = filePath; setDirty(false); updateWordCount(); 
    
  } catch (err) { 
    await message(`開けません。\n${err}`, { type: 'error' }); 
  } 
}

async function openFile() { const filePath = await open({ filters: [{ name: 'Text', extensions: ['txt', 'md'] }] }); if (filePath) isDirty ? createNewWindow(filePath) : await openFileDirect(filePath); }
let isSaving = false; async function saveFile(isSaveAs) { if (isSaving) return; isSaving = true; try { if (!currentFilePath || isSaveAs) { const filePath = await save({ filters: [{ name: 'Text', extensions: ['txt', 'md'] }] }); if (!filePath) return; currentFilePath = filePath; } await writeTextFileDirect(currentFilePath, getEditorText()); setDirty(false); wordCounter.textContent = '保存しました'; setTimeout(() => updateWordCount(), 2000); parseOutlineAndBookmarks(); } catch (err) { await message(`保存失敗。\n${err}`, { type: 'error' }); } finally { isSaving = false; } }

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

  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); await saveFile(false); }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); await saveFile(true); }
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
document.getElementById('menu-new').addEventListener('click', () => { dropdown.classList.add('hidden'); createNewWindow(); }); document.getElementById('menu-open').addEventListener('click', () => { dropdown.classList.add('hidden'); openFile(); }); document.getElementById('menu-save').addEventListener('click', () => { dropdown.classList.add('hidden'); saveFile(false); }); document.getElementById('menu-save-as').addEventListener('click', () => { dropdown.classList.add('hidden'); saveFile(true); });
document.querySelectorAll('.tab-btn').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden')); btn.classList.add('active'); document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden'); }); });

function updateTextSlotPreview() {
  const n = document.getElementById('select-text-slot').value; const s = localStorage.getItem(`text-slot-${n}`); const p = document.getElementById('text-slot-preview');
  if (s) { const d = JSON.parse(s); p.innerHTML = `フォント(Ed): ${d.ef||'未指定'}<br>フォント(縦): ${d.pf||'未指定'}<br>サイズ: ${d.s}px / 行間: ${d.l} / 折返: ${d.ll||0}字<br>タイプライター: ${d.t?'ON':'OFF'} / 初回分割: ${d.psf?'ON':'OFF'}`; } else { p.innerHTML = "このスロットは空です"; }
}
document.getElementById('select-text-slot').addEventListener('change', updateTextSlotPreview);
document.getElementById('btn-save-text-slot').addEventListener('click', () => { const n = document.getElementById('select-text-slot').value; const d = { ef: document.getElementById('set-editor-font').value, uf: document.getElementById('set-ui-font').value, pf: document.getElementById('set-preview-font').value, s: document.getElementById('set-fs').value, l: document.getElementById('set-lh').value, ll: document.getElementById('set-line-length').value, t: document.getElementById('set-typewriter').checked, aEn: document.getElementById('set-active-line-enabled').checked, fe: document.getElementById('set-fade-enabled').checked, ft: document.getElementById('set-fade-range-top').value, fb: document.getElementById('set-fade-range-bottom').value, fo: document.getElementById('set-fade-opacity').value, psf: document.getElementById('set-preview-split-first').checked }; localStorage.setItem(`text-slot-${n}`, JSON.stringify(d)); alert(`セット ${n} に保存しました`); updateTextSlotPreview(); });
function loadTextSlotData(n) { const s = localStorage.getItem(`text-slot-${n}`); if (s) { const d = JSON.parse(s); currentSettings.editorFont = d.ef||""; currentSettings.uiFont = d.uf||""; currentSettings.previewFont = d.pf||""; currentSettings.fontSize = d.s; currentSettings.lh = d.l; currentSettings.lineLength = d.ll||0; currentSettings.typewriterMode = d.t; currentSettings.activeLineEnabled = d.aEn||false; currentSettings.fadeEnabled = d.fe; currentSettings.fadeRangeTop = d.ft; currentSettings.fadeRangeBottom = d.fb; currentSettings.fadeOpacity = d.fo; currentSettings.previewSplitFirst = d.psf||false; saveAllSettings(); } }

document.getElementById('btn-load-text-slot').addEventListener('click', () => { loadTextSlotData(document.getElementById('select-text-slot').value); alert("読み込みました"); modal.classList.add('hidden'); });

function applyThemePreset(p) { document.getElementById('set-bg-color').value = p.bg; document.getElementById('set-menu-bg').value = p.mBg; document.getElementById('set-titlebar-bg').value = p.title; document.getElementById('set-text-color').value = p.text; document.getElementById('set-selection-color').value = p.sel; document.getElementById('set-highlight-color').value = p.hl; document.getElementById('set-titlebar-text').value = p.tText; document.getElementById('set-counter-color').value = p.cText; document.getElementById('set-active-line-color').value = p.actCol; }
document.getElementById('btn-apply-theme').addEventListener('click', () => {
  const val = document.getElementById('select-theme-load').value;
  if (val === 'p_dark') applyThemePreset({ bg: "#2c2c2c", mBg: "#222222", title: "#393939", text: "#f4f4f4", sel: "#ffffff", hl: "#007acc", tText: "#adadad", cText: "#727272", actCol: "#ffffff" });
  else if (val === 'p_light') applyThemePreset({ bg: "#ffffff", mBg: "#f9f9f9", title: "#f0f0f0", text: "#333333", sel: "#000000", hl: "#007acc", tText: "#666666", cText: "#888888", actCol: "#000000" });
  else if (val === 'p_parchment') applyThemePreset({ bg: "#f4ecd8", mBg: "#e8ddc0", title: "#e6daba", text: "#4a3623", sel: "#5c4033", hl: "#8b5a2b", tText: "#5c4033", cText: "#8b7355", actCol: "#5c4033" });
  else {
    const s = localStorage.getItem(`theme-slot-${val.replace('c_','')}`);
    if (s) { const t = JSON.parse(s); applyThemePreset({ bg: t.bg, mBg: t.mBg||t.bg, title: t.title, text: t.text, sel: t.sel, hl: t.hl||"#007acc", tText: t.tText||"#adadad", cText: t.cText||"#727272", actCol: t.aCol||"#ffffff" }); } else alert("そのスロットは空です");
  }
});
document.getElementById('btn-save-theme-slot').addEventListener('click', () => { const n = document.getElementById('select-theme-save').value; const t = { bg: document.getElementById('set-bg-color').value, mBg: document.getElementById('set-menu-bg').value, title: document.getElementById('set-titlebar-bg').value, text: document.getElementById('set-text-color').value, sel: document.getElementById('set-selection-color').value, hl: document.getElementById('set-highlight-color').value, tText: document.getElementById('set-titlebar-text').value, cText: document.getElementById('set-counter-color').value, aCol: document.getElementById('set-active-line-color').value }; localStorage.setItem(`theme-slot-${n}`, JSON.stringify(t)); alert(`スロット ${n} に保存しました`); });

// 設定モーダルに関わる初期化はアイドル時 or 初回オープン時に遅延
let settingsUiBuilt = false;
function buildSettingsUiOnce() {
  if (settingsUiBuilt) return;
  settingsUiBuilt = true;

  const frag = document.createDocumentFragment();
  shortcutDefs.forEach(def => {
    const d = shortcuts[def.id] || { mod: '', key: '' };
    const div = document.createElement('div');
    div.className = 'setting-group';
    div.innerHTML = `<label>${def.label}</label><div class="shortcut-inputs">...</div>`;
    frag.appendChild(div);
  });
  scContainer.appendChild(frag); // innerHTML += の代わりに1回だけDOM挿入
}

document.getElementById('menu-settings').addEventListener('click', () => {
  buildSettingsUiOnce();
  dropdown.classList.add('hidden');
  document.getElementById('set-editor-font').value = currentSettings.editorFont; document.getElementById('set-ui-font').value = currentSettings.uiFont; document.getElementById('set-preview-font').value = currentSettings.previewFont || ""; document.getElementById('set-fs').value = currentSettings.fontSize; document.getElementById('set-lh').value = currentSettings.lh; document.getElementById('set-line-length').value = currentSettings.lineLength || 0;
  document.getElementById('set-typewriter').checked = currentSettings.typewriterMode; document.getElementById('set-active-line-enabled').checked = currentSettings.activeLineEnabled; document.getElementById('set-fade-enabled').checked = currentSettings.fadeEnabled; document.getElementById('set-fade-range-top').value = currentSettings.fadeRangeTop; document.getElementById('set-fade-range-bottom').value = currentSettings.fadeRangeBottom; document.getElementById('set-fade-opacity').value = currentSettings.fadeOpacity; document.getElementById('set-count-newline').checked = currentSettings.countNewline;
  document.getElementById('set-preview-split-first').checked = currentSettings.previewSplitFirst || false;
  document.getElementById('set-bg-color').value = currentSettings.bgColor; document.getElementById('set-menu-bg').value = currentSettings.menuBg; document.getElementById('set-titlebar-bg').value = currentSettings.titlebarBg; document.getElementById('set-text-color').value = currentSettings.textColor; document.getElementById('set-selection-color').value = currentSettings.selectionColor; document.getElementById('set-highlight-color').value = currentSettings.highlightColor; document.getElementById('set-titlebar-text').value = currentSettings.titlebarText; document.getElementById('set-counter-color').value = currentSettings.counterColor; document.getElementById('set-active-line-color').value = currentSettings.activeLineColor;
  document.getElementById('set-btn-style').value = currentSettings.btnStyle; document.getElementById('set-autosave-enabled').checked = currentSettings.autoSaveEnabled; document.getElementById('set-backup-enabled').checked = currentSettings.backupEnabled; document.getElementById('set-ol-md').checked = currentSettings.olMd;
  document.getElementById('display-backup-dir').textContent = currentSettings.backupDir || "未設定 (ファイルと同じ場所に/backupを作成)"; document.getElementById('display-backup-dir').dataset.path = currentSettings.backupDir;
  shortcutDefs.forEach(def => { document.getElementById(`mod-${def.id}`).value = shortcuts[def.id]?.mod || ""; document.getElementById(`key-${def.id}`).value = shortcuts[def.id]?.key || ""; });
  updateTextSlotPreview(); renderOutlineSettings(); modal.classList.remove('hidden');
});

document.getElementById('btn-save-settings').addEventListener('click', () => {
  currentSettings.editorFont = document.getElementById('set-editor-font').value; currentSettings.uiFont = document.getElementById('set-ui-font').value; currentSettings.previewFont = document.getElementById('set-preview-font').value; currentSettings.fontSize = parseFloat(document.getElementById('set-fs').value) || 16; currentSettings.lh = parseFloat(document.getElementById('set-lh').value) || 1.8; currentSettings.lineLength = parseInt(document.getElementById('set-line-length').value) || 0;
  currentSettings.typewriterMode = document.getElementById('set-typewriter').checked; currentSettings.activeLineEnabled = document.getElementById('set-active-line-enabled').checked; currentSettings.fadeEnabled = document.getElementById('set-fade-enabled').checked; currentSettings.fadeRangeTop = parseFloat(document.getElementById('set-fade-range-top').value) || 100; currentSettings.fadeRangeBottom = parseFloat(document.getElementById('set-fade-range-bottom').value) || 100; currentSettings.fadeOpacity = parseFloat(document.getElementById('set-fade-opacity').value) || 0.8; currentSettings.countNewline = document.getElementById('set-count-newline').checked;
  currentSettings.previewSplitFirst = document.getElementById('set-preview-split-first').checked;
  currentSettings.bgColor = document.getElementById('set-bg-color').value; currentSettings.menuBg = document.getElementById('set-menu-bg').value; currentSettings.titlebarBg = document.getElementById('set-titlebar-bg').value; currentSettings.textColor = document.getElementById('set-text-color').value; currentSettings.selectionColor = document.getElementById('set-selection-color').value; currentSettings.highlightColor = document.getElementById('set-highlight-color').value; currentSettings.titlebarText = document.getElementById('set-titlebar-text').value; currentSettings.counterColor = document.getElementById('set-counter-color').value; currentSettings.activeLineColor = document.getElementById('set-active-line-color').value;
  currentSettings.btnStyle = document.getElementById('set-btn-style').value; currentSettings.autoSaveEnabled = document.getElementById('set-autosave-enabled').checked; currentSettings.backupEnabled = document.getElementById('set-backup-enabled').checked; currentSettings.backupDir = document.getElementById('display-backup-dir').dataset.path || ""; currentSettings.olMd = document.getElementById('set-ol-md').checked;
  shortcutDefs.forEach(def => { shortcuts[def.id] = { mod: document.getElementById(`mod-${def.id}`).value, key: document.getElementById(`key-${def.id}`).value }; });
  saveAllSettings(); modal.classList.add('hidden');
});
document.getElementById('btn-close-settings').addEventListener('click', () => modal.classList.add('hidden'));

// バックアップ＆その他
document.getElementById('btn-select-backup-dir').addEventListener('click', async () => { const s = await open({ directory: true }); if (s) { document.getElementById('display-backup-dir').textContent = s; document.getElementById('display-backup-dir').dataset.path = s; }});
document.getElementById('btn-clear-backup-dir').addEventListener('click', () => { document.getElementById('display-backup-dir').textContent = "未設定 (ファイルと同じ場所に/backupを作成)"; document.getElementById('display-backup-dir').dataset.path = ""; });
setInterval(async () => { if (currentSettings.autoSaveEnabled && currentFilePath && isDirty) { try { await writeTextFileDirect(currentFilePath, getEditorText()); setDirty(false); parseOutlineAndBookmarks(); } catch (err) {} } }, 60000);
async function createBackup() { if (!currentSettings.backupEnabled) return; let backupDir = currentSettings.backupDir; let safePath = currentFilePath.split(/[/\\]/).join('/'); const lastSlash = safePath.lastIndexOf('/'); const fileName = safePath.substring(lastSlash + 1); const dotIndex = fileName.lastIndexOf('.'); const nameWithoutExt = dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName; const ext = dotIndex !== -1 ? fileName.substring(dotIndex) : ''; if (!backupDir) { backupDir = safePath.substring(0, lastSlash) + "/backup"; } try { await mkdir(backupDir); } catch (err) {} const now = new Date(); const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`; await writeTextFileDirect(`${backupDir}/${nameWithoutExt}-backup-${timestamp}${ext}`, getEditorText()); try { const files = await readDir(backupDir); const backups = files.filter(f => f.name && f.name.indexOf(nameWithoutExt + "-backup-") === 0).sort((a, b) => b.name.localeCompare(a.name)); if (backups.length > 5) { for (let i = 5; i < backups.length; i++) { await remove(backupDir + "/" + backups[i].name); } } } catch (err) {} }
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
  const openPath = new URLSearchParams(window.location.search).get('open'); if (openPath) { await openFileDirect(openPath); return; }
  try { const data = await invoke('get_startup_file'); if (data) { setEditorText(data.content); currentFilePath = data.path; setDirty(false); updateWordCount(); } } catch (err) {}
}
// PCのアイドルを待たず、即座にファイルの読み込みを開始する
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