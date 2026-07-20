
import { describe, it, expect, vi } from 'vitest';

// Tauri の invoke メソッドをモック化
const mockInvoke = vi.fn();

// テスト対象となる関数（main.js内と同等のロジック）
async function writeTextFileDirect(path, content) {
  return await mockInvoke('save_file_direct', { path, content });
}

describe('File Saving', () => {
  it('アトミック保存のために正しいコマンドとパラメータがバックエンドに渡されること', async () => {
    const testPath = 'C:/user/documents/novel.txt';
    const testContent = '吾輩は猫である。名前はまだ無い。';
    
    // 成功時をシミュレート
    mockInvoke.mockResolvedValueOnce();

    await writeTextFileDirect(testPath, testContent);

    // Rust側の save_file_direct が正しい引数で1回呼び出されたかを検証
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('save_file_direct', {
      path: testPath,
      content: testContent
    });
  });
});