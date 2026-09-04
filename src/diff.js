/* テキスト差分（Diff）計算およびHTML整形を行うモジュール*/
import * as Diff from 'diff';

/**
 * ディスク上の内容とエディタの内容を比較し、ハイライト表示用HTMLを生成する純粋関数
 * @param {string} diskText - ディスク上の内容（旧）
 * @param {string} editorText - 現在のエディタの内容（新）
 * @returns {string} 生成されたHTML
 */
export function renderDiff(diskText, editorText) {
  // 改行コードの差異による誤検出を防ぐため統一
  const normalizedDisk = diskText.replace(/\r\n/g, '\n');
  const normalizedEditor = editorText.replace(/\r\n/g, '\n');

  // 行単位で差分を計算
  const diff = Diff.diffLines(normalizedDisk, normalizedEditor);
  let html = '';

  diff.forEach(part => {
    const className = part.added ? 'diff-added' : part.removed ? 'diff-removed' : 'diff-unchanged';
    const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
    
    // 行ごとに分割してHTMLエスケープ
    const lines = part.value.split('\n');
    if (lines[lines.length - 1] === '') lines.pop(); // 末尾の空行を除去

    lines.forEach(line => {
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      html += `<div class="diff-line ${className}"><span class="diff-prefix">${prefix}</span><span>${escaped || '&nbsp;'}</span></div>`;
    });
  });

  return html;
}