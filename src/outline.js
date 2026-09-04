/*アウトライン（目次）とブックマークの解析・DOM構築を行うモジュール
 */
import { createElement, Bookmark } from 'lucide';

let _editorView = null;
let _getSettings = null;
let _defaultPresets = null;
let _message = null;

export function initOutline(editorView, getSettings, defaultPresets, messageFn) {
  _editorView = editorView;
  _getSettings = getSettings;
  _defaultPresets = defaultPresets;
  _message = messageFn;
}

function getRegexList(level) { 
  const settings = _getSettings();
  const ids = settings.olLevels[level] || []; 
  return ids.map(id => { 
    if (id.startsWith('pre_')) return _defaultPresets.find(p => p.id === id)?.reg; 
    if (id.startsWith('cus_')) return settings.olCustoms[id.replace('cus_','')]?.r; 
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
    
    d.addEventListener('dblclick', async () => { 
      const doc = _editorView.state.doc;
      if (node.line <= doc.lines) {
        const linePos = doc.line(node.line).from;
        _editorView.dispatch({ selection: { anchor: linePos }, scrollIntoView: true }); 
        _editorView.focus(); 
      } else { 
        await _message('行が見つかりません。アウトラインを更新(↻)してください。', {type:'warning'}); 
      }
    });
    
    wrapper.appendChild(d); wrapper.appendChild(childrenWrapper); parentEl.appendChild(wrapper);
    if (hasChildren) renderOutlineTree(node.children, childrenWrapper);
  });
}

export function parseOutlineAndBookmarks() {
  if (!_editorView) return;
  const settings = _getSettings();
  const doc = _editorView.state.doc; const lines = doc.lines;
  let outlines = []; let bookmarks = []; const mdEnabled = settings.olMd;
  const reg1 = getRegexList(1).map(r => new RegExp(r)); const reg2 = getRegexList(2).map(r => new RegExp(r)); const reg3 = getRegexList(3).map(r => new RegExp(r));

  for (let i = 1; i <= lines; i++) {
    const line = doc.line(i); const txt = line.text;
    
    const bMatch = txt.match(/(?:@@|＠＠)(.*)/);
    if (bMatch) { 
      const bText = bMatch[1].trim() || "(無名ブックマーク)";
      bookmarks.push({ line: i, text: bText.substring(0,25) + (bText.length>25?'...':'') }); 
    }
    
    let matchedLevel = 0; let cleanText = txt;
    if (mdEnabled && txt.startsWith('#')) { const match = txt.match(/^(#{1,6})\s+(.*)/); if (match) { matchedLevel = match[1].length; cleanText = match[2]; } }
    if (matchedLevel === 0) { if (reg1.some(r => r.test(txt))) matchedLevel = 1; else if (reg2.some(r => r.test(txt))) matchedLevel = 2; else if (reg3.some(r => r.test(txt))) matchedLevel = 3; }
    if (matchedLevel > 0) outlines.push({ line: i, text: cleanText.trim() || "(空)", level: matchedLevel });
  }
  
  const bList = document.getElementById('bookmark-list'); bList.innerHTML = '';
  if (bookmarks.length === 0) { bList.innerHTML = '<div class="menu-item" style="color:var(--counter-color);">(なし)</div>'; }
  else { 
    bookmarks.forEach(b => { 
      const el = document.createElement('div'); 
      el.className = 'menu-item'; 
      const icon = createElement(Bookmark, { width: 14, height: 14, class: 'lucide-icon' }).outerHTML;
      el.innerHTML = `<span style="display:inline-flex; align-items:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${icon}${b.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
      el.addEventListener('click', async () => { 
        document.getElementById('dropdown-menu').classList.add('hidden'); 
        const doc = _editorView.state.doc;
        if (b.line <= doc.lines) {
          const linePos = doc.line(b.line).from;
          _editorView.dispatch({ selection: { anchor: linePos }, scrollIntoView: true }); 
          _editorView.focus(); 
        } else { 
          await _message('ブックマークが見つかりません。一度ファイルを保存してください。', {type:'warning'}); 
        }
      }); 
      bList.appendChild(el); 
    }); 
  }

  const treeBox = document.getElementById('outline-tree'); treeBox.innerHTML = '';
  if (outlines.length === 0) { treeBox.innerHTML = '<div style="padding:10px; opacity:0.5; text-align:center;">見出しがありません</div>'; return; }
  const tree = buildOutlineTree(outlines); renderOutlineTree(tree, treeBox);
}