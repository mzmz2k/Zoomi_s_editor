// src/save.js
/**
 * ファイル保存、自動保存、バックアップ、および競合検知を担当するモジュール
 */
export class SaveManager {
  constructor({ fs, dialog, invoke, getEditorText, getSettings, onSaveSuccess }) {
    this.fs = fs;
    this.dialog = dialog;
    this.invoke = invoke;
    this.getEditorText = getEditorText;
    this.getSettings = getSettings;
    this.onSaveSuccess = onSaveSuccess;
    
    this.currentFilePath = null;
    this.lastModifiedTime = null;
    this.isSaving = false;
    this.autoSaveTimer = null;
  }

  async writeTextFileDirect(path, content) {
    return await this.invoke('save_file_direct', { path, content });
  }

  /**
   * ファイルの最終更新日時を記録する（競合検知用）
   */
  async updateLastModifiedTime(path) {
    if (!path) {
      this.lastModifiedTime = null;
      return;
    }
    this.currentFilePath = path;
    try {
      if (!this.fs.stat) return; // statが使えない環境へのフォールバック
      const info = await this.fs.stat(path);
      // mtime が Date オブジェクトか文字列か数値かを吸収
      this.lastModifiedTime = info.mtime ? new Date(info.mtime).getTime() : null;
    } catch (e) {
      this.lastModifiedTime = null;
    }
  }

  /**
   * 外部でファイルが変更されたかチェックする
   */
  async checkConflict(path) {
    if (!this.lastModifiedTime || !path || !this.fs.stat) return false;
    try {
      const info = await this.fs.stat(path);
      const currentMtime = info.mtime ? new Date(info.mtime).getTime() : null;
      if (currentMtime && currentMtime > this.lastModifiedTime) {
        return true; // 外部で変更された
      }
    } catch (e) {
      // ファイルが存在しない場合などは競合なしとして扱う
    }
    return false;
  }

  /**
   * 手動保存処理
   */
  async saveFile(isSaveAs = false) {
    if (this.isSaving) return;
    this.isSaving = true;

    try {
      let targetPath = this.currentFilePath;
      
      if (!targetPath || isSaveAs) {
        const filePath = await this.dialog.save({ filters: [{ name: 'Text', extensions: ['txt', 'md'] }] });
        if (!filePath) return;
        targetPath = filePath;
      } else {
        // 上書き保存の場合は競合チェックを行う
        const hasConflict = await this.checkConflict(targetPath);
        if (hasConflict) {
          const yes = await this.dialog.ask('ファイルが外部プログラムによって変更されています。\n上書きして保存しますか？', { type: 'warning' });
          if (!yes) return; // キャンセル
        }
      }

      await this.writeTextFileDirect(targetPath, this.getEditorText());
      await this.updateLastModifiedTime(targetPath); // 成功したらmtimeを更新
      
      if (this.onSaveSuccess) {
        this.onSaveSuccess(targetPath, false); // isAutoSave = false
      }
    } catch (err) {
      await this.dialog.message(`保存失敗。\n${err}`, { type: 'error' });
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * 自動保存処理（タイマーから呼ばれる）
   */
  async autoSave(isDirty) {
    const settings = this.getSettings();
    if (!settings.autoSaveEnabled || !this.currentFilePath || !isDirty || this.isSaving) return;

    // 競合時は勝手に上書きしてユーザーのデータを破壊しないようスキップする
    const hasConflict = await this.checkConflict(this.currentFilePath);
    if (hasConflict) return;

    try {
      await this.writeTextFileDirect(this.currentFilePath, this.getEditorText());
      await this.updateLastModifiedTime(this.currentFilePath);
      if (this.onSaveSuccess) {
        this.onSaveSuccess(this.currentFilePath, true); // isAutoSave = true
      }
    } catch (err) {}
  }

  /**
   * 自動保存タイマーの開始
   */
  startAutoSave(getIsDirtyFunc) {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    this.autoSaveTimer = setInterval(() => {
      this.autoSave(getIsDirtyFunc());
    }, 60000);
  }

  /**
   * バックアップの作成
   */
  async createBackup() {
    const settings = this.getSettings();
    if (!settings.backupEnabled || !this.currentFilePath) return;
    
    let backupDir = settings.backupDir;
    let safePath = this.currentFilePath.split(/[/\\]/).join('/');
    const lastSlash = safePath.lastIndexOf('/');
    const fileName = safePath.substring(lastSlash + 1);
    const dotIndex = fileName.lastIndexOf('.');
    const nameWithoutExt = dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;
    const ext = dotIndex !== -1 ? fileName.substring(dotIndex) : '';
    
    if (!backupDir) {
      backupDir = safePath.substring(0, lastSlash) + "/backup";
    }
    
    try { await this.fs.mkdir(backupDir); } catch (err) {}
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
    
    await this.writeTextFileDirect(`${backupDir}/${nameWithoutExt}-backup-${timestamp}${ext}`, this.getEditorText());
    
    try {
      const files = await this.fs.readDir(backupDir);
      const backups = files
        .filter(f => f.name && f.name.indexOf(nameWithoutExt + "-backup-") === 0)
        .sort((a, b) => b.name.localeCompare(a.name));
        
      if (backups.length > 5) {
        for (let i = 5; i < backups.length; i++) {
          await this.fs.remove(backupDir + "/" + backups[i].name);
        }
      }
    } catch (err) {}
  }
}