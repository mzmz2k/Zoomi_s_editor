/**
 * 設定・テーマ・ショートカットの管理および設定画面UIモジュール
 */

export const defaultPresets = [
  { id: 'pre_chap', name: '第〇章', reg: '^第.{1,2}章([\\s　]|$)' },
  { id: 'pre_sec', name: '第〇節', reg: '^第.{1,2}節([\\s　]|$)' },
  { id: 'pre_bra', name: '【特殊な括弧】', reg: '^[【≪].+?[】≫]$' },
  { id: 'pre_sym', name: '◆◇記号のみ', reg: '^[◆◇●○■□▼▽※]+$' },
  { id: 'pre_ast', name: '＊＊＊ (アスタリスク)', reg: '^[*＊]{3,}$' },
  { id: 'pre_hyp', name: '--- (ハイフン)', reg: '^[-=]{3,}$' }
];

export const shortcutDefs = [
  { id: 'sc-outline', label: 'アウトライン切替' },
  { id: 'sc-preview', label: '縦書きビュー切替' },
  { id: 'sc-wordcount', label: '文字数表示切替' },
  { id: 'sc-fade', label: 'フェード表示切替' },
  { id: 'sc-typewriter', label: 'タイプライター切替' },
  { id: 'sc-text1', label: 'テキストセット 1 適用' },
  { id: 'sc-text2', label: 'テキストセット 2 適用' },
  { id: 'sc-text3', label: 'テキストセット 3 適用' }
];

export const currentSettings = {
  fontSize: 16, lh: 1.8, lineLength: 0, editorFont: "", uiFont: "", previewFont: "", countNewline: false, typewriterMode: false, fadeEnabled: false, fadeRangeTop: 100, fadeRangeBottom: 100, fadeOpacity: 0.8,
  activeLineEnabled: false, activeLineColor: "#ffffff", btnStyle: "mac", backupEnabled: true, backupDir: "", autoSaveEnabled: true, sidebarWidth: 250, previewSize: 350,
  bgColor: "#2c2c2c", menuBg: "#222222", titlebarBg: "#393939", textColor: "#f4f4f4", selectionColor: "#ffffff", highlightColor: "#007acc", titlebarText: "#adadad", counterColor: "#727272",
  olMd: true, olLevels: { 1: ['pre_chap'], 2: ['pre_sec'], 3: ['pre_bra', 'pre_sym'] },
  olCustoms: { 1: {n:'カスタム1', r:''}, 2: {n:'カスタム2', r:''}, 3: {n:'カスタム3', r:''}, 4: {n:'カスタム4', r:''}, 5: {n:'カスタム5', r:''}, 6: {n:'カスタム6', r:''} },
  previewSplitFirst: false 
};

export const shortcuts = {};

export function hexToRgba(hex, alpha) {
  let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const rootStyle = document.documentElement.style;
let _onApply = null;
let _onSave = null;
let _openDialog = null;

export function applySettingsToStyle() {
  rootStyle.setProperty('--font-size', currentSettings.fontSize + "px"); 
  rootStyle.setProperty('--line-height', currentSettings.lh); 
  
  if (_onApply) _onApply(currentSettings);

  if (currentSettings.lineLength > 0) {
    rootStyle.setProperty('--max-width', `calc(${currentSettings.lineLength} * var(--font-size) + 80px)`);
    rootStyle.setProperty('--max-height', `calc(${currentSettings.lineLength} * var(--font-size) + 40px)`);
  } else {
    rootStyle.setProperty('--max-width', '100%');
    rootStyle.setProperty('--max-height', '100%');
  }
  
  rootStyle.setProperty('--editor-font-family', currentSettings.editorFont || "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', sans-serif"); 
  rootStyle.setProperty('--ui-font-family', currentSettings.uiFont || "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', sans-serif"); 
  rootStyle.setProperty('--preview-font-family', currentSettings.previewFont || currentSettings.editorFont || "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', serif"); 
  
  rootStyle.setProperty('--bg-color', currentSettings.bgColor);
  rootStyle.setProperty('--menu-bg', currentSettings.menuBg);
  rootStyle.setProperty('--titlebar-bg', currentSettings.titlebarBg);
  rootStyle.setProperty('--text-color', currentSettings.textColor);
  rootStyle.setProperty('--selection-color', hexToRgba(currentSettings.selectionColor, 0.3));
  rootStyle.setProperty('--highlight-color', currentSettings.highlightColor);
  rootStyle.setProperty('--titlebar-text', currentSettings.titlebarText);
  rootStyle.setProperty('--counter-color', currentSettings.counterColor);
  rootStyle.setProperty('--active-line-color', currentSettings.activeLineEnabled ? hexToRgba(currentSettings.activeLineColor, 0.15) : "transparent");
  rootStyle.setProperty('--sidebar-width', currentSettings.sidebarWidth + "px");
  rootStyle.setProperty('--preview-size', currentSettings.previewSize + "px");
  document.body.className = currentSettings.btnStyle === "windows" ? "btn-style-windows" : "";

  const fadeTop = document.getElementById('fade-top');
  const fadeBottom = document.getElementById('fade-bottom');
  if (fadeTop && fadeBottom) {
    if (currentSettings.fadeEnabled) {
      fadeTop.style.display = 'block';
      fadeBottom.style.display = 'block';
      fadeTop.style.height = currentSettings.fadeRangeTop + 'px';
      fadeTop.style.background = `linear-gradient(to bottom, ${currentSettings.bgColor}, transparent)`;
      fadeTop.style.opacity = currentSettings.fadeOpacity;
      fadeBottom.style.height = currentSettings.fadeRangeBottom + 'px';
      fadeBottom.style.background = `linear-gradient(to top, ${currentSettings.bgColor}, transparent)`;
      fadeBottom.style.opacity = currentSettings.fadeOpacity;
    } else {
      fadeTop.style.display = 'none';
      fadeBottom.style.display = 'none';
    }
  }
}

export function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('zoomi-settings') || '{}');
  Object.assign(currentSettings, saved);
  const savedShortcuts = JSON.parse(localStorage.getItem('zoomi-shortcuts') || '{}');
  Object.assign(shortcuts, savedShortcuts);
  applySettingsToStyle();
}

export function saveAllSettings() {
  localStorage.setItem('zoomi-settings', JSON.stringify(currentSettings));
  localStorage.setItem('zoomi-shortcuts', JSON.stringify(shortcuts));
  applySettingsToStyle();
  if (_onSave) _onSave();
}

export function initSettingsUI(options) {
  _onApply = options.onApply;
  _onSave = options.onSave;
  _openDialog = options.openDialog;

  loadSettings();
  buildShortcutList();
  setupSettingsModalEvents();
}

export function renderOutlineSettings() {
  const box = document.getElementById('ol-levels-container');
  if (!box) return;
  box.innerHTML = '';
  [1, 2, 3].forEach(lv => {
    const row = document.createElement('div');
    row.className = 'setting-column';
    let html = `<label>階層 ${lv}</label><div style="display:flex; flex-wrap:wrap; margin-bottom:4px;">`;
    (currentSettings.olLevels[lv] || []).forEach(id => {
      let name = id.startsWith('pre_') ? defaultPresets.find(p=>p.id===id)?.name : currentSettings.olCustoms[id.replace('cus_','')]?.n;
      html += `<span class="ol-chip">${name} <span class="ol-chip-del" data-lv="${lv}" data-id="${id}">×</span></span>`;
    });
    html += `</div><div style="display:flex; gap:4px; width:100%;"><select id="sel-add-lv${lv}" style="flex:1;">`;
    defaultPresets.forEach(p => html += `<option value="${p.id}">${p.name}</option>`);
    [1,2,3,4,5,6].forEach(c => html += `<option value="cus_${c}">${currentSettings.olCustoms[c].n}</option>`);
    html += `</select><button class="btn btn-add-lv" data-lv="${lv}" style="padding:2px 8px; font-size:12px;">追加</button></div>`;
    row.innerHTML = html;
    box.appendChild(row);
  });

  document.querySelectorAll('.btn-add-lv').forEach(b => b.addEventListener('click', (e) => {
    const lv = e.target.dataset.lv;
    const val = document.getElementById(`sel-add-lv${lv}`).value;
    if (!currentSettings.olLevels[lv].includes(val)) {
      currentSettings.olLevels[lv].push(val);
      renderOutlineSettings();
    }
  }));

  document.querySelectorAll('.ol-chip-del').forEach(x => x.addEventListener('click', (e) => {
    const lv = e.target.dataset.lv, id = e.target.dataset.id;
    currentSettings.olLevels[lv] = currentSettings.olLevels[lv].filter(i => i !== id);
    renderOutlineSettings();
  }));

  updateCustomOptions();
}

function updateCustomOptions() {
  const sel = document.getElementById('select-custom-ol');
  if (!sel) return;
  const v = sel.value || "1";
  sel.innerHTML = '';
  [1,2,3,4,5,6].forEach(c => sel.innerHTML += `<option value="${c}">${currentSettings.olCustoms[c].n}</option>`);
  sel.value = v;
  document.getElementById('input-custom-reg').value = currentSettings.olCustoms[v]?.r || "";
  testCustomReg();
}

function testCustomReg() {
  const regStr = document.getElementById('input-custom-reg').value;
  const text = document.getElementById('test-custom-text').value;
  const res = document.getElementById('test-custom-result');
  if (!regStr) { res.innerHTML = text.replace(/</g,'&lt;').replace(/>/g,'&gt;'); return; }
  try {
    const reg = new RegExp(regStr, 'gm');
    res.innerHTML = text.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(reg, match => `<span class="test-highlight">${match}</span>`);
  } catch(e) {
    res.innerHTML = `<span style="color:#ff5f56;">正規表現エラー: ${e.message}</span>`;
  }
}

export function updateTextSlotPreview() {
  const n = document.getElementById('select-text-slot').value;
  const s = localStorage.getItem(`text-slot-${n}`);
  const p = document.getElementById('text-slot-preview');
  if (!p) return;
  if (s) {
    const d = JSON.parse(s);
    p.innerHTML = `フォント(Ed): ${d.ef||'未指定'}<br>フォント(縦): ${d.pf||'未指定'}<br>サイズ: ${d.s}px / 行間: ${d.l} / 折返: ${d.ll||0}字<br>タイプライター: ${d.t?'ON':'OFF'} / 初回分割: ${d.psf?'ON':'OFF'}`;
  } else {
    p.innerHTML = "このスロットは空です";
  }
}

export function loadTextSlotData(n) {
  const s = localStorage.getItem(`text-slot-${n}`);
  if (s) {
    const d = JSON.parse(s);
    currentSettings.editorFont = d.ef||"";
    currentSettings.uiFont = d.uf||"";
    currentSettings.previewFont = d.pf||"";
    currentSettings.fontSize = d.s;
    currentSettings.lh = d.l;
    currentSettings.lineLength = d.ll||0;
    currentSettings.typewriterMode = d.t;
    currentSettings.activeLineEnabled = d.aEn||false;
    currentSettings.fadeEnabled = d.fe;
    currentSettings.fadeRangeTop = d.ft;
    currentSettings.fadeRangeBottom = d.fb;
    currentSettings.fadeOpacity = d.fo;
    currentSettings.previewSplitFirst = d.psf||false;
    saveAllSettings();
  }
}

function applyThemePreset(p) {
  document.getElementById('set-bg-color').value = p.bg;
  document.getElementById('set-menu-bg').value = p.mBg;
  document.getElementById('set-titlebar-bg').value = p.title;
  document.getElementById('set-text-color').value = p.text;
  document.getElementById('set-selection-color').value = p.sel;
  document.getElementById('set-highlight-color').value = p.hl;
  document.getElementById('set-titlebar-text').value = p.tText;
  document.getElementById('set-counter-color').value = p.cText;
  document.getElementById('set-active-line-color').value = p.actCol;
}

export function buildShortcutList() {
  const scContainer = document.getElementById('shortcut-list-container');
  if (!scContainer) return;
  scContainer.innerHTML = '';
  const frag = document.createDocumentFragment();
  shortcutDefs.forEach(def => {
    const d = shortcuts[def.id] || { mod: '', key: '' };
    const div = document.createElement('div');
    div.className = 'setting-group';
    div.innerHTML = `
      <label>${def.label}</label>
      <div class="shortcut-inputs">
        <select id="mod-${def.id}">
          <option value="" ${d.mod===''?'selected':''}>なし</option>
          <option value="ctrlKey" ${d.mod==='ctrlKey'?'selected':''}>Ctrl</option>
          <option value="shiftKey" ${d.mod==='shiftKey'?'selected':''}>Shift</option>
          <option value="altKey" ${d.mod==='altKey'?'selected':''}>Alt</option>
        </select>
        <span>+</span>
        <input type="text" id="key-${def.id}" value="${d.key}" maxlength="1">
      </div>`;
    frag.appendChild(div);
  });
  scContainer.appendChild(frag);
}

function setupSettingsModalEvents() {
  const dropdown = document.getElementById('dropdown-menu');
  const modal = document.getElementById('settings-modal');

  document.getElementById('select-custom-ol')?.addEventListener('change', updateCustomOptions);
  document.getElementById('input-custom-reg')?.addEventListener('input', testCustomReg);
  document.getElementById('test-custom-text')?.addEventListener('input', testCustomReg);
  document.getElementById('btn-save-custom-ol')?.addEventListener('click', () => {
    const num = document.getElementById('select-custom-ol').value;
    const reg = document.getElementById('input-custom-reg').value;
    const name = prompt("カスタム設定の名前", currentSettings.olCustoms[num].n);
    if (name) {
      currentSettings.olCustoms[num] = { n: name, r: reg };
      updateCustomOptions();
      renderOutlineSettings();
      alert("保存しました");
    }
  });

  document.getElementById('select-text-slot')?.addEventListener('change', updateTextSlotPreview);
  document.getElementById('btn-save-text-slot')?.addEventListener('click', () => {
    const n = document.getElementById('select-text-slot').value;
    const d = {
      ef: document.getElementById('set-editor-font').value,
      uf: document.getElementById('set-ui-font').value,
      pf: document.getElementById('set-preview-font').value,
      s: document.getElementById('set-fs').value,
      l: document.getElementById('set-lh').value,
      ll: document.getElementById('set-line-length').value,
      t: document.getElementById('set-typewriter').checked,
      aEn: document.getElementById('set-active-line-enabled').checked,
      fe: document.getElementById('set-fade-enabled').checked,
      ft: document.getElementById('set-fade-range-top').value,
      fb: document.getElementById('set-fade-range-bottom').value,
      fo: document.getElementById('set-fade-opacity').value,
      psf: document.getElementById('set-preview-split-first').checked
    };
    localStorage.setItem(`text-slot-${n}`, JSON.stringify(d));
    alert(`セット ${n} に保存しました`);
    updateTextSlotPreview();
  });

  document.getElementById('btn-load-text-slot')?.addEventListener('click', () => {
    loadTextSlotData(document.getElementById('select-text-slot').value);
    alert("読み込みました");
    modal?.classList.add('hidden');
  });

  document.getElementById('btn-apply-theme')?.addEventListener('click', () => {
    const val = document.getElementById('select-theme-load').value;
    if (val === 'p_dark') applyThemePreset({ bg: "#2c2c2c", mBg: "#222222", title: "#393939", text: "#f4f4f4", sel: "#ffffff", hl: "#007acc", tText: "#adadad", cText: "#727272", actCol: "#ffffff" });
    else if (val === 'p_light') applyThemePreset({ bg: "#ffffff", mBg: "#f9f9f9", title: "#f0f0f0", text: "#333333", sel: "#000000", hl: "#007acc", tText: "#666666", cText: "#888888", actCol: "#000000" });
    else if (val === 'p_parchment') applyThemePreset({ bg: "#f4ecd8", mBg: "#e8ddc0", title: "#e6daba", text: "#4a3623", sel: "#5c4033", hl: "#8b5a2b", tText: "#5c4033", cText: "#8b7355", actCol: "#5c4033" });
    else {
      const s = localStorage.getItem(`theme-slot-${val.replace('c_','')}`);
      if (s) { const t = JSON.parse(s); applyThemePreset({ bg: t.bg, mBg: t.mBg||t.bg, title: t.title, text: t.text, sel: t.sel, hl: t.hl||"#007acc", tText: t.tText||"#adadad", cText: t.cText||"#727272", actCol: t.aCol||"#ffffff" }); } else alert("そのスロットは空です");
    }
  });

  document.getElementById('btn-save-theme-slot')?.addEventListener('click', () => {
    const n = document.getElementById('select-theme-save').value;
    const t = {
      bg: document.getElementById('set-bg-color').value,
      mBg: document.getElementById('set-menu-bg').value,
      title: document.getElementById('set-titlebar-bg').value,
      text: document.getElementById('set-text-color').value,
      sel: document.getElementById('set-selection-color').value,
      hl: document.getElementById('set-highlight-color').value,
      tText: document.getElementById('set-titlebar-text').value,
      cText: document.getElementById('set-counter-color').value,
      aCol: document.getElementById('set-active-line-color').value
    };
    localStorage.setItem(`theme-slot-${n}`, JSON.stringify(t));
    alert(`スロット ${n} に保存しました`);
  });

  document.getElementById('menu-settings')?.addEventListener('click', () => {
    dropdown?.classList.add('hidden');
    document.getElementById('set-editor-font').value = currentSettings.editorFont;
    document.getElementById('set-ui-font').value = currentSettings.uiFont;
    document.getElementById('set-preview-font').value = currentSettings.previewFont || "";
    document.getElementById('set-fs').value = currentSettings.fontSize;
    document.getElementById('set-lh').value = currentSettings.lh;
    document.getElementById('set-line-length').value = currentSettings.lineLength || 0;
    document.getElementById('set-typewriter').checked = currentSettings.typewriterMode;
    document.getElementById('set-active-line-enabled').checked = currentSettings.activeLineEnabled;
    document.getElementById('set-fade-enabled').checked = currentSettings.fadeEnabled;
    document.getElementById('set-fade-range-top').value = currentSettings.fadeRangeTop;
    document.getElementById('set-fade-range-bottom').value = currentSettings.fadeRangeBottom;
    document.getElementById('set-fade-opacity').value = currentSettings.fadeOpacity;
    document.getElementById('set-count-newline').checked = currentSettings.countNewline;
    document.getElementById('set-preview-split-first').checked = currentSettings.previewSplitFirst || false;
    document.getElementById('set-bg-color').value = currentSettings.bgColor;
    document.getElementById('set-menu-bg').value = currentSettings.menuBg;
    document.getElementById('set-titlebar-bg').value = currentSettings.titlebarBg;
    document.getElementById('set-text-color').value = currentSettings.textColor;
    document.getElementById('set-selection-color').value = currentSettings.selectionColor;
    document.getElementById('set-highlight-color').value = currentSettings.highlightColor;
    document.getElementById('set-titlebar-text').value = currentSettings.titlebarText;
    document.getElementById('set-counter-color').value = currentSettings.counterColor;
    document.getElementById('set-active-line-color').value = currentSettings.activeLineColor;
    document.getElementById('set-btn-style').value = currentSettings.btnStyle;
    document.getElementById('set-autosave-enabled').checked = currentSettings.autoSaveEnabled;
    document.getElementById('set-backup-enabled').checked = currentSettings.backupEnabled;
    document.getElementById('set-ol-md').checked = currentSettings.olMd;
    document.getElementById('display-backup-dir').textContent = currentSettings.backupDir || "未設定 (ファイルと同じ場所に/backupを作成)";
    document.getElementById('display-backup-dir').dataset.path = currentSettings.backupDir;

    shortcutDefs.forEach(def => {
      document.getElementById(`mod-${def.id}`).value = shortcuts[def.id]?.mod || "";
      document.getElementById(`key-${def.id}`).value = shortcuts[def.id]?.key || "";
    });

    updateTextSlotPreview();
    renderOutlineSettings();
    modal?.classList.remove('hidden');
  });

  document.getElementById('btn-save-settings')?.addEventListener('click', () => {
    currentSettings.editorFont = document.getElementById('set-editor-font').value;
    currentSettings.uiFont = document.getElementById('set-ui-font').value;
    currentSettings.previewFont = document.getElementById('set-preview-font').value;
    currentSettings.fontSize = parseFloat(document.getElementById('set-fs').value) || 16;
    currentSettings.lh = parseFloat(document.getElementById('set-lh').value) || 1.8;
    currentSettings.lineLength = parseInt(document.getElementById('set-line-length').value) || 0;
    currentSettings.typewriterMode = document.getElementById('set-typewriter').checked;
    currentSettings.activeLineEnabled = document.getElementById('set-active-line-enabled').checked;
    currentSettings.fadeEnabled = document.getElementById('set-fade-enabled').checked;
    currentSettings.fadeRangeTop = parseFloat(document.getElementById('set-fade-range-top').value) || 100;
    currentSettings.fadeRangeBottom = parseFloat(document.getElementById('set-fade-range-bottom').value) || 100;
    currentSettings.fadeOpacity = parseFloat(document.getElementById('set-fade-opacity').value) || 0.8;
    currentSettings.countNewline = document.getElementById('set-count-newline').checked;
    currentSettings.previewSplitFirst = document.getElementById('set-preview-split-first').checked;
    currentSettings.bgColor = document.getElementById('set-bg-color').value;
    currentSettings.menuBg = document.getElementById('set-menu-bg').value;
    currentSettings.titlebarBg = document.getElementById('set-titlebar-bg').value;
    currentSettings.textColor = document.getElementById('set-text-color').value;
    currentSettings.selectionColor = document.getElementById('set-selection-color').value;
    currentSettings.highlightColor = document.getElementById('set-highlight-color').value;
    currentSettings.titlebarText = document.getElementById('set-titlebar-text').value;
    currentSettings.counterColor = document.getElementById('set-counter-color').value;
    currentSettings.activeLineColor = document.getElementById('set-active-line-color').value;
    currentSettings.btnStyle = document.getElementById('set-btn-style').value;
    currentSettings.autoSaveEnabled = document.getElementById('set-autosave-enabled').checked;
    currentSettings.backupEnabled = document.getElementById('set-backup-enabled').checked;
    currentSettings.backupDir = document.getElementById('display-backup-dir').dataset.path || "";
    currentSettings.olMd = document.getElementById('set-ol-md').checked;

    shortcutDefs.forEach(def => {
      shortcuts[def.id] = {
        mod: document.getElementById(`mod-${def.id}`).value,
        key: document.getElementById(`key-${def.id}`).value
      };
    });

    saveAllSettings();
    modal?.classList.add('hidden');
  });

  document.getElementById('btn-close-settings')?.addEventListener('click', () => modal?.classList.add('hidden'));

  document.getElementById('btn-select-backup-dir')?.addEventListener('click', async () => {
    if (_openDialog) {
      const s = await _openDialog({ directory: true });
      if (s) {
        document.getElementById('display-backup-dir').textContent = s;
        document.getElementById('display-backup-dir').dataset.path = s;
      }
    }
  });

  document.getElementById('btn-clear-backup-dir')?.addEventListener('click', () => {
    document.getElementById('display-backup-dir').textContent = "未設定 (ファイルと同じ場所に/backupを作成)";
    document.getElementById('display-backup-dir').dataset.path = "";
  });
}