/* HTMLベースのカスタムダイアログの表示・非表示を管理するモジュール */
import { renderDiff } from './diff.js';

export function showConflictDialog({ diskText, editorText }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('conflict-modal');
    const diffView = document.getElementById('conflict-diff-view');
    const btnCancel = document.getElementById('btn-conflict-cancel');
    const btnReload = document.getElementById('btn-conflict-reload');
    const btnOverwrite = document.getElementById('btn-conflict-overwrite');

    // 差分を描画
    diffView.innerHTML = renderDiff(diskText, editorText);

    const cleanup = () => {
      modal.classList.add('hidden');
      diffView.innerHTML = '';
      btnCancel.onclick = null;
      if (btnReload) btnReload.onclick = null;
      btnOverwrite.onclick = null;
    };

    btnCancel.onclick = () => {
      cleanup();
      resolve('cancel');
    };

    if (btnReload) {
      btnReload.onclick = () => {
        cleanup();
        resolve('reload');
      };
    }

    btnOverwrite.onclick = () => {
      cleanup();
      resolve('overwrite');
    };

    modal.classList.remove('hidden');
    btnCancel.focus();
  });
}