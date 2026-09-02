// src/layout.js
/**
 * サイドバー・プレビュー画面のリサイズ、表示切替、エディタとのスクロール同期モジュール
 */

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

let _editorView = null;
let _getEditorText = null;
let _getSettings = null;
let _saveSettings = null;
let _onOutlineRefresh = null;

let currentPreviewState = 0; // 0:非表示, 1:状態1, 2:状態2
const rootStyle = document.documentElement.style;

export function initLayout(options) {
  _editorView = options.editorView;
  _getEditorText = options.getEditorText;
  _getSettings = options.getSettings;
  _saveSettings = options.saveSettings;
  _onOutlineRefresh = options.onOutlineRefresh;

  setupSidebarResize();
  setupPreviewResize();
  setupScrollSync();
  setupLayoutButtons();
}

// ----------------------------------------------------
// サイドバー（アウトライン）の制御
// ----------------------------------------------------
export function toggleOutline() {
  const sidebar = document.getElementById('sidebar');
  const sResizer = document.getElementById('sidebar-resizer');
  if (!sidebar || !sResizer) return;

  sidebar.classList.toggle('hidden');
  sResizer.classList.toggle('hidden');
  if (!sidebar.classList.contains('hidden') && _onOutlineRefresh) {
    _onOutlineRefresh();
  }
}

function setupSidebarResize() {
  const sResizer = document.getElementById('sidebar-resizer');
  if (!sResizer) return;

  let isResizing = false;
  sResizer.addEventListener('mousedown', () => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    sResizer.classList.add('active');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    let w = e.clientX;
    if (w < 150) w = 150;
    if (w > 600) w = 600;
    rootStyle.setProperty('--sidebar-width', w + "px");
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = 'default';
      sResizer.classList.remove('active');
      const settings = _getSettings();
      settings.sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'));
      if (_saveSettings) _saveSettings();
    }
  });
}

// ----------------------------------------------------
// プレビュー画面（縦書きビュー）の制御
// ----------------------------------------------------
export function setPreviewState(state) {
  currentPreviewState = state;
  const previewPane = document.getElementById('preview-pane');
  const pResizer = document.getElementById('preview-resizer');
  if (!previewPane || !pResizer) return;

  if (state === 0) {
    previewPane.classList.add('hidden');
    pResizer.classList.add('hidden');
    pResizer.style.display = 'none';
    previewPane.classList.remove('full');
  } else {
    previewPane.classList.remove('hidden');
    pResizer.classList.remove('hidden');
    updatePreviewContent();
    const settings = _getSettings();
    const isSplit = settings.previewSplitFirst ? (state === 1) : (state === 2);
    if (isSplit) {
      pResizer.style.display = 'block';
      previewPane.classList.remove('full');
    } else {
      pResizer.style.display = 'none';
      previewPane.classList.add('full');
    }
  }
}

export function cyclePreview() {
  let nextState = currentPreviewState + 1;
  if (nextState > 2) nextState = 0;
  setPreviewState(nextState);
}

function setupPreviewResize() {
  const pResizer = document.getElementById('preview-resizer');
  if (!pResizer) return;

  let isResizing = false;
  pResizer.addEventListener('mousedown', () => {
    isResizing = true;
    document.body.style.cursor = 'row-resize';
    pResizer.classList.add('active');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    let h = e.clientY - 30;
    if (h < 150) h = 150;
    if (h > window.innerHeight - 150) h = window.innerHeight - 150;
    rootStyle.setProperty('--preview-size', h + "px");
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = 'default';
      pResizer.classList.remove('active');
      const settings = _getSettings();
      settings.previewSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--preview-size'));
      if (_saveSettings) _saveSettings();
    }
  });
}

// ----------------------------------------------------
// スクロール同期・位置追従
// ----------------------------------------------------
export function syncPreviewToPos(pos) {
  const previewPane = document.getElementById('preview-pane');
  const prScroll = document.getElementById('preview-content');
  if (!previewPane || !prScroll || previewPane.classList.contains('hidden') || !prScroll.firstChild) return;

  try {
    const node = prScroll.firstChild;
    const safePos = Math.max(0, Math.min(pos, node.length - 1));
    const range = document.createRange();
    range.setStart(node, safePos);
    range.setEnd(node, safePos + 1);
    const rect = range.getBoundingClientRect();
    const prRect = prScroll.getBoundingClientRect();
    const targetX = rect.left + (rect.width / 2);
    const containerCenterX = prRect.left + (prRect.width / 2);
    prScroll.scrollLeft += (targetX - containerCenterX);
  } catch (e) {}
}

export const updatePreviewContent = debounce(() => {
  const pane = document.getElementById('preview-pane');
  if (pane && !pane.classList.contains('hidden')) {
    const prScroll = document.getElementById('preview-content');
    if (prScroll && _getEditorText) {
      prScroll.textContent = _getEditorText();
      if (_editorView) {
        syncPreviewToPos(_editorView.state.selection.main.head);
      }
    }
  }
}, 300);

function setupScrollSync() {
  const previewPane = document.getElementById('preview-pane');
  const prScroll = document.getElementById('preview-content');
  if (!prScroll || !_editorView) return;

  const edScroll = _editorView.scrollDOM;
  let isSyncingLeft = false;
  let isSyncingRight = false;
  let syncLeftTimer = null;
  let syncRightTimer = null;

  prScroll.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) {
      e.preventDefault();
      prScroll.scrollLeft -= e.deltaY;
    }
  }, { passive: false });

  // 横書きエディタ → 縦書きプレビュー
  edScroll.addEventListener('scroll', () => {
    if (previewPane.classList.contains('hidden') || isSyncingLeft) return;
    isSyncingRight = true;
    const pos = _editorView.posAtCoords({
      x: edScroll.getBoundingClientRect().left + 50,
      y: edScroll.getBoundingClientRect().top + (edScroll.clientHeight / 2)
    }, false);
    if (pos !== null) syncPreviewToPos(pos);
    clearTimeout(syncRightTimer);
    syncRightTimer = setTimeout(() => isSyncingRight = false, 50);
  });

  // 縦書きプレビュー → 横書きエディタ
  prScroll.addEventListener('scroll', () => {
    if (previewPane.classList.contains('hidden') || isSyncingRight) return;
    isSyncingLeft = true;
    const prRect = prScroll.getBoundingClientRect();
    const centerX = prRect.left + (prRect.width / 2);
    const centerY = prRect.top + (prRect.height / 2);
    let pos = -1;

    if (document.caretPositionFromPoint) {
      const range = document.caretPositionFromPoint(centerX, centerY);
      if (range) pos = range.offset;
    } else if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(centerX, centerY);
      if (range) pos = range.startOffset;
    }

    if (pos >= 0) {
      const coords = _editorView.coordsAtPos(pos);
      if (coords) {
        edScroll.scrollTop += (coords.top - edScroll.getBoundingClientRect().top - (edScroll.clientHeight / 2));
      }
    }
    clearTimeout(syncLeftTimer);
    syncLeftTimer = setTimeout(() => isSyncingLeft = false, 50);
  });
}

function setupLayoutButtons() {
  document.getElementById('btn-outline-close')?.addEventListener('click', toggleOutline);
  document.getElementById('menu-outline')?.addEventListener('click', () => {
    document.getElementById('dropdown-menu')?.classList.add('hidden');
    toggleOutline();
  });

  document.getElementById('btn-preview-close')?.addEventListener('click', () => setPreviewState(0));
  document.getElementById('menu-preview')?.addEventListener('click', () => {
    document.getElementById('dropdown-menu')?.classList.add('hidden');
    cyclePreview();
  });
  document.getElementById('btn-preview-full')?.addEventListener('click', () => {
    if (currentPreviewState !== 0) {
      setPreviewState(currentPreviewState === 1 ? 2 : 1);
    }
  });
}