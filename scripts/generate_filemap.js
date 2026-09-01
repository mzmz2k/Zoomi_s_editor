import fs from 'fs';
import path from 'path';

// --- 1. 設定 ---
const IGNORE_DIRS = new Set(['node_modules', 'target', '.git', '.svelte-kit', 'build', 'dist', 'docs','icons']);
const TARGET_EXTS = new Set(['.js', '.ts', '.svelte', '.rs']);
const OUTPUT_FILE = path.join(process.cwd(), 'docs', '02_file-map.md');

// --- 2. 抽出ロジック (インターフェースの役割 / 疎結合・テスト用) ---
export const Extractor = {
    /** 1行目のコメントを抽出 */
    extractDescription(content) {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return '（説明未記載）';
        
        const firstLine = lines[0];
        // 抽出: //, <!-- -->, /* */
        const match = firstLine.match(/^(?:\/\/\s*|<!--\s*|\/\*\s*)(.*?)(?:\s*-->|\s*\*\/)?$/);
        return match ? match[1].trim() : '（説明未記載）';
    },

    /** 依存関係(import/use)を抽出 */
    extractDependencies(content, ext) {
        const deps = [];
        if (ext === '.rs') {
            const regex = /^\s*(?:use|mod)\s+([^;]+);/gm;
            let match;
            while ((match = regex.exec(content)) !== null) deps.push(`use/mod ${match[1].trim()}`);
        } else if (['.js', '.ts', '.svelte'].includes(ext)) {
            const regex = /import\s+.*?\s+from\s+['"](.*?)['"]/gm;
            let match;
            while ((match = regex.exec(content)) !== null) deps.push(`import ${match[1].trim()}`);
        }
        return deps;

    },

    /** 公開関数／構造体／インターフェース等のシグネチャを抽出 */
    extractSignatures(content, ext) {
        const signatures = [];
        if (ext === '.rs') {
            // pub fn, pub async fn, pub struct, pub enum, pub type, pub trait
            const regex = /^\s*(?:#\[.*?\]\s*)*(pub(?:\(.*?\))?\s+(?:async\s+)?(?:fn|struct|enum|type|trait)\s+[^\{;=]+)/gm;
            let match;
            while ((match = regex.exec(content)) !== null) {
                const sig = match[1].replace(/\s+/g, ' ').trim();
                signatures.push(sig);
            }
        } else if (['.js', '.ts'].includes(ext)) {
            // export function, export async function, export const/let/var, export type, export interface, export class, export enum
            const regex = /^\s*export\s+(?:default\s+)?(?:async\s+)?(function\s+[a-zA-Z0-9_$]+(?:\<.*?\>)?\s*\(.*?\)|(?:const|let|var)\s+[a-zA-Z0-9_$]+|(?:interface|type|class|enum)\s+[a-zA-Z0-9_$]+(?:\<.*?\>)?)/gm;
            let match;
            while ((match = regex.exec(content)) !== null) {
                const sig = match[0].replace(/\s+/g, ' ').trim();
                signatures.push(sig);
            }
        } else if (ext === '.svelte') {
            // Svelte 内の export let (props) や export function
            const regex = /^\s*export\s+(?:let\s+[a-zA-Z0-9_$]+|function\s+[a-zA-Z0-9_$]+(?:\<.*?\>)?\s*\(.*?\))/gm;
            let match;
            while ((match = regex.exec(content)) !== null) {
                const sig = match[0].replace(/\s+/g, ' ').trim();
                signatures.push(sig);
            }
        }
        return signatures;

    }
};

// --- 3. ファイル探索とツリー生成 ---
function analyzeProject(dirPath, rootPath = dirPath) {
    let treeStr = '';
    const fileInfos = [];

    function traverse(currentPath, prefix = '') {
        const items = fs.readdirSync(currentPath).sort();
        const filteredItems = items.filter(item => !IGNORE_DIRS.has(item));

        filteredItems.forEach((item, index) => {
            const fullPath = path.join(currentPath, item);
            const isLast = index === filteredItems.length - 1;
            const stat = fs.statSync(fullPath);
            const connector = isLast ? '└── ' : '├── ';
            
            treeStr += `${prefix}${connector}${item}\n`;

            if (stat.isDirectory()) {
                traverse(fullPath, prefix + (isLast ? '    ' : '│   '));
            } else {
                const ext = path.extname(item);
                if (TARGET_EXTS.has(ext)) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
                    const dirName = path.dirname(relativePath) + '/';
                    
                    fileInfos.push({
                        path: relativePath,
                        dir: dirName === './' ? '' : dirName,
                        fileName: item,
                        description: Extractor.extractDescription(content),
                        dependencies: Extractor.extractDependencies(content, ext),
                        signatures: Extractor.extractSignatures(content, ext)
                    });
                }
            }
        });
    }

    const projectName = path.basename(rootPath);
    treeStr = `${projectName}/\n`;
    traverse(rootPath);
    
    return { treeStr, fileInfos };
}

// --- 4. Markdown生成と保存 ---
function generateMarkdown() {
    console.log('🔍 プロジェクトを解析中...');
    const rootDir = process.cwd();
    const { treeStr, fileInfos } = analyzeProject(rootDir);

    let md = '# ディレクトリ構成と主要ファイル\n\n```\n';
    md += treeStr;
    md += '```\n\n## 依存関係\n';

    fileInfos.filter(f => f.dependencies.length > 0).forEach(f => {
        md += `📄 \`${f.path}\`\n`;
        f.dependencies.forEach(dep => {
            md += `  └── ${dep}\n`;
        });
        md += '\n';
    });

    md += '## 各ファイル詳細\n\n';
    
    // ディレクトリごとにグループ化して出力
    const grouped = fileInfos.reduce((acc, f) => {
        if (!acc[f.dir]) acc[f.dir] = [];
        acc[f.dir].push(f);
        return acc;
    }, {});

    for (const [dir, files] of Object.entries(grouped)) {
        if (dir) md += `### ${dir}\n`;
        files.forEach(f => {
            md += `- \`${f.path}\` : ${f.description}\n`;
            if (f.signatures.length > 0) {
                f.signatures.forEach(sig => {
                    md += `  - \`${sig}\`\n`;
                });
            }
        });
        md += '\n';
    }

    // docsディレクトリがなければ作成
    const docsDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    fs.writeFileSync(OUTPUT_FILE, md, 'utf8');
    console.log(`✅ ${OUTPUT_FILE} を出力しました！`);
}

// 直接実行された場合のみ処理を走らせる
if (process.argv[1] === new URL(import.meta.url).pathname || process.argv[1] === import.meta.filename) {
    generateMarkdown();
}