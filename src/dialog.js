/* HTMLベースのカスタムダイアログの表示・非表示を管理するモジュール
 */
export function showConflictDialog() {
  return new Promise((resolve) => {
    const modal = document.getElementById('conflict-modal');
    const btnCancel = document.getElementById('btn-conflict-cancel');
    const btnOverwrite = document.getElementById('btn-conflict-overwrite');

    // ボタンが押されたらダイアログを閉じ、イベントを消去する
    const cleanup = () => {
      modal.classList.add('hidden');
      btnCancel.onclick = null;
      btnOverwrite.onclick = null;
    };

    // キャンセルが押されたら false を返す
    btnCancel.onclick = () => {
      cleanup();
      resolve(false);
    };

    // 上書きが押されたら true を返す
    btnOverwrite.onclick = () => {
      cleanup();
      resolve(true);
    };

    // 画面に表示して、安全のためにキャンセルボタンにフォーカスを当てる
    modal.classList.remove('hidden');
    btnCancel.focus(); 
  });
}