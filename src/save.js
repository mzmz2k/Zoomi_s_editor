/*ファイル保存、自動保存、バックアップ、および競合検知を担当するモジュール
 */
export class SaveManager {
  constructor({ fs, dialog, invoke, getEditorText, getSettings, onSaveSuccess, onConflict, onReload }) {
    this.fs = fs;
    this.dialog = dialog;
    this.invoke = invoke;
    this.getEditorText = getEditorText;
    this.getSettings = getSettings;
    this.onSaveSuccess = onSaveSuccess;
    this.onConflict = onConflict;
    this.onReload = onReload;
    
    this.currentFilePath = null;
    this.lastSavedHash = null; // 前回保存/読込時のハッシュ値
    this.isSaving = false;
    this.autoSaveTimer = null;
  }

  async writeTextFileDirect(path, content) {
    return await this.invoke('save_file_direct', { path, content });
  }

  /**
   * ファイルの最終更新日時を記録する（競合検知用）
   */
  
  async computeHash(text) {
    // 改行コードの揺れによるハッシュ不一致を防ぐため LF に統一
    const normalizedText = text.replace(/\r\n/g, '\n');
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalizedText);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // APIが使えない環境では、文字数と一部のテキストを結合した擬似ハッシュで代用
      return `fallback:${normalizedText.length}:${normalizedText.slice(0, 50)}:${normalizedText.slice(-50)}`;
    }
  }


 /**
   * ディスクからファイルを文字列として読み込む（Rust側の安全なコマンドを利用）
   */
  async readFileText(path) {
    return await this.invoke('read_file_text', { path });
  }

  /**
   * ファイルパスとハッシュを記録する
   */
  async updateFileInfo(path, content) {
    if (!path) {
      this.lastSavedHash = null;
      return;
    }
    this.currentFilePath = path;
    this.lastSavedHash = await this.computeHash(content);
  }

  /**
   * 外部でファイルが変更されたかチェックする（ハッシュ比較のみ）
   */
  async checkConflict(path) {
    if (!path) return false;

    try {
      // 常にディスク上の最新の内容を取得してハッシュ化
      const diskText = await this.readFileText(path);
      const diskHash = await this.computeHash(diskText);
      
      // 開いた時・前回保存した時のハッシュと異なれば競合
      if (diskHash !== this.lastSavedHash) {
        return true; 
      }
      return false; 
    } catch (e) {
      // 読み込みに失敗した場合（削除・ロック等）は安全のため警告
      return true;
    }
  }


  /**
   * 手動保存処理
   * * @returns {Promise<boolean>} 保存成功時は true、キャンセルまたは失敗時は false
   */
  async saveFile(isSaveAs = false) {
    if (this.isSaving) return false;
    this.isSaving = true;

    try {
      let targetPath = this.currentFilePath;
      
      if (!targetPath || isSaveAs) {
        const filePath = await this.dialog.save({ filters: [{ name: 'Text', extensions: ['txt', 'md'] }] });
        if (!filePath) return false;
        targetPath = filePath;

      } else {

       // 上書き保存の場合は競合チェックを行う
        const hasConflict = await this.checkConflict(targetPath);
        if (hasConflict) {
          let action = 'cancel';
          if (this.onConflict) {
            const diskText = await this.readFileText(targetPath);
            action = await this.onConflict({ diskText, editorText: this.getEditorText() });
          } else {
            const yes = await this.dialog.ask('ファイルが外部プログラムによって変更されています。\n上書きして保存しますか？', { type: 'warning' });
            action = yes ? 'overwrite' : 'cancel';
          }

          if (action === 'reload') {
            const diskText = await this.readFileText(targetPath);
            if (this.onReload) this.onReload(diskText);
            await this.updateFileInfo(targetPath, diskText);
            return false; // 外部の内容を取り込んだので保存は中止
          }

          if (action !== 'overwrite') return false; // キャンセル
        }
      }

      const textToSave = this.getEditorText();


            
      // 保存する
      await this.invoke('save_file_direct', { path: targetPath, content: textToSave });
      await this.updateFileInfo(targetPath, textToSave); // 成功したらハッシュを更新
      
      if (this.onSaveSuccess) {
        this.onSaveSuccess(targetPath, false); // isAutoSave = false
      }
      return true;
    } catch (err) {
      await this.dialog.message(`保存失敗。\n${err}`, { type: 'error' });
      return false;
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
      const textToSave = this.getEditorText();
      await this.invoke('save_file_direct', { path: this.currentFilePath, content: textToSave });
      await this.updateFileInfo(this.currentFilePath, textToSave);
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