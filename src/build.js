/* esbuild を実行し、アプリバージョンとビルド日を自動注入するビルドスクリプト
 */
import esbuild from 'esbuild';
import fs from 'fs';

// package.json から現在のバージョンを自動取得
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// 今日の日付 (YYYY-MM-DD) を取得
const today = new Date().toISOString().slice(0, 10);

esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  outfile: 'src/bundle.js',
  // JS内の __APP_VERSION__ と __BUILD_DATE__ を自動置換する
  define: {
    '__APP_VERSION__': JSON.stringify(pkg.version || '1.0.0'),
    '__BUILD_DATE__': JSON.stringify(today)
  }
}).then(() => {
  console.log(`Build successful: Version ${pkg.version} (${today})`);
}).catch(() => process.exit(1));