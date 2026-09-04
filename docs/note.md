jsファイルを変更した際は、
npx esbuild src/main.js --bundle --outfile=src/bundle.js
でバンドル化する。

今後「ダークテーマの背景色を変えたい」「新しい色を追加したい」と思ったときは、settings.js の themePresets 内のカラーコードを書き換えるだけですべて（初期設定も適用ボタンも）に反映されるようになります。

ライセンス自動生成はしる
npm run build