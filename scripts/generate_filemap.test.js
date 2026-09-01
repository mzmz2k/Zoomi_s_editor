import { describe, it, expect } from 'vitest';
import { Extractor } from './generate_filemap.js';

describe('Extractor', () => {
    describe('extractDescription', () => {
        it('Rustのコメントを抽出できる', () => {
            const content = '// バックエンドのメイン処理\nfn main() {}';
            expect(Extractor.extractDescription(content)).toBe('バックエンドのメイン処理');
        });

        it('SvelteのHTMLコメントを抽出できる', () => {
            const content = '<!-- メインレイアウト -->\n<slot />';
            expect(Extractor.extractDescription(content)).toBe('メインレイアウト');
        });

        it('コメントがない場合は未記載を返す', () => {
            const content = 'fn main() {}';
            expect(Extractor.extractDescription(content)).toBe('（説明未記載）');
        });
    });

    describe('extractDependencies', () => {
        it('JS/Svelteのimportを抽出できる', () => {
            const content = `import { Button } from '$lib/components';\nimport Icon from 'lucide-svelte';`;
            const deps = Extractor.extractDependencies(content, '.svelte');
            expect(deps).toEqual(['import $lib/components', 'import lucide-svelte']);
        });

        it('Rustのuse/modを抽出できる', () => {
            const content = `use tauri::Manager;\nmod commands;`;
            const deps = Extractor.extractDependencies(content, '.rs');
            expect(deps).toEqual(['use/mod tauri::Manager', 'use/mod commands']);
        });
    });
});