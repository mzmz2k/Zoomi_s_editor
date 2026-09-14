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

/**
 * アプリ終了時の未保存確認ダイアログを表示
 * @returns {Promise<'save' | 'dontsave' | 'cancel'>}
 */
export function showUnsavedDialog() {
  return new Promise((resolve) => {
    const modal = document.getElementById('unsaved-modal');
    const btnSave = document.getElementById('btn-unsaved-save');
    const btnDiscard = document.getElementById('btn-unsaved-discard');
    const btnCancel = document.getElementById('btn-unsaved-cancel');

    if (!modal || !btnSave || !btnDiscard || !btnCancel) {
      // DOMが存在しない場合は安全側に倒してキャンセル
      resolve('cancel');
      return;
    }

    const cleanup = (result) => {
      btnSave.removeEventListener('click', onSave);
      btnDiscard.removeEventListener('click', onDiscard);
      btnCancel.removeEventListener('click', onCancel);
      modal.classList.add('hidden');
      resolve(result);
    };

    const onSave = () => cleanup('save');
    const onDiscard = () => cleanup('dontsave');
    const onCancel = () => cleanup('cancel');

    btnSave.addEventListener('click', onSave);
    btnDiscard.addEventListener('click', onDiscard);
    btnCancel.addEventListener('click', onCancel);
    modal.classList.remove('hidden');
  });
}