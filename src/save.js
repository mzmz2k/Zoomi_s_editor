/*ファイル保存、自動保存、バックアップ、および競合検知を担当するモジュール
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
    console.warn("Failed to get stat (mtime). Conflict check will rely entirely on hash.", e);
    this.lastModifiedTime = null; // エラー時はnullにして、保存時に必ずハッシュ比較させる
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
   * ディスクからファイルを文字列として読み込む
   */
  async readFileText(path) {
    const readBin = this.fs.readFile || this.fs.readBinaryFile;
    if (readBin) {
      const bytes = await readBin(path);
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch (e) {
        return new TextDecoder('shift-jis').decode(bytes);
      }
    } else if (this.fs.readTextFile) {
      return await this.fs.readTextFile(path);
    }
    throw new Error("ファイルを読み込む手段がありません");
  }

  /**
   * Rust経由で更新日時を取得する
   */
  async getMtime(path) {
    try {
      return await this.invoke('get_file_mtime', { path });
    } catch (e) {
      return null;
    }
  }

  /**
   * ファイルの更新日時とハッシュを記録する
   * ※保存直後はRustから返ってきた確実なmtime(knownMtime)をセットする
   */
  async updateFileInfo(path, content, knownMtime = null) {
    if (!path) {
      this.lastModifiedTime = null;
      this.lastSavedHash = null;
      return;
    }
    this.currentFilePath = path;
    
    // ハッシュの計算と保存
    this.lastSavedHash = await this.computeHash(content);

    if (knownMtime !== null) {
      this.lastModifiedTime = knownMtime;
    } else {
      this.lastModifiedTime = await this.getMtime(path);
    }
  }

  /**
   * 外部でファイルが変更されたかチェックする
   */
  async checkConflict(path) {
      if (!path) return false;

    const currentMtime = await this.getMtime(path);
    const statError = currentMtime === null;

    // ① タイムスタンプが正常に取得でき、前回と同じか古い場合は「確実に安全」
    if (!statError && this.lastModifiedTime && currentMtime <= this.lastModifiedTime) {
      return false;
     }

    // ② タイムスタンプが新しい、または取得エラーの場合は、ディスクの内容を読んでハッシュ比較
    try {
      const diskText = await this.readFileText(path);
      const diskHash = await this.computeHash(diskText);
      
      if (diskHash !== this.lastSavedHash) {
        return true; // ハッシュが違う ＝ 外部で書き換えられている
      } else {
        // 中身は同じなので、次回のためにmtimeだけ更新しておく
        if (currentMtime) this.lastModifiedTime = currentMtime;
        return false;
      }
    } catch (e) {
      // ファイル読み込みに失敗した場合（削除されたなど）は、
      // 勝手に上書きしてデータを消さないよう必ず確認ダイアログを出す
      console.warn("競合チェック時のファイル読み込みに失敗。安全のためダイアログを表示します。", e);
      return true;
    }
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

      const textToSave = this.getEditorText();
            
      // 保存して、Rust側から新しいmtimeを受け取る
      const newMtime = await this.invoke('save_file_direct', { path: targetPath, content: textToSave });
      await this.updateFileInfo(targetPath, textToSave, newMtime); // 成功したらハッシュと新しいmtimeを更新
      
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
      const textToSave = this.getEditorText();
      const newMtime = await this.invoke('save_file_direct', { path: this.currentFilePath, content: textToSave });
      await this.updateFileInfo(this.currentFilePath, textToSave, newMtime);
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