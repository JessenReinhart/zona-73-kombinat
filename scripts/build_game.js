// scripts/build_game.js
// Compiles modular TypeScript sources (src/**/*.ts) using @babel/core + @babel/preset-typescript
// and bundles them with the utilitarian Slavapunk CSS + HTML into dist/index.html and index.html

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const ROOT = path.resolve(__dirname, '..');

const MODULE_ORDER = [
  'src/types/game.ts',
  'src/data/itemsAndWeapons.ts',
  'src/engine/textures.ts',
  'src/engine/webgl.ts',
  'src/engine/worldBuilder.ts',
  'src/engine/audioEngine.ts',
  'src/engine/physicsAndPlayer.ts',
  'src/engine/aiSystem.ts',
  'src/engine/inventoryAndPersistence.ts',
  'src/ui/gameApp.ts',
];

let combinedTS = '';
for (const relPath of MODULE_ORDER) {
  const fullPath = path.join(ROOT, relPath);
  let src = fs.readFileSync(fullPath, 'utf8');
  src = src.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  src = src.replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, '');
  src = src.replace(/^\s*export\s+(interface|type|const|let|var|function|class)\s+/gm, '$1 ');
  combinedTS += `\n// ==========================================\n// MODULE: ${relPath}\n// ==========================================\n` + src + '\n';
}

combinedTS += `
const __initZona73 = () => {
  if (!(window as any).__zona73) {
    const canvas = document.getElementById('z73-canvas') as HTMLCanvasElement;
    if (canvas) {
      (window as any).__zona73 = new Zona73GameApp(canvas);
    }
  }
};
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', __initZona73);
} else {
  __initZona73();
}
`;

const result = babel.transformSync(combinedTS, {
  filename: 'zona73_bundle.ts',
  presets: [['@babel/preset-typescript', { allExtensions: true }]],
  compact: false,
});

if (!result || !result.code) {
  throw new Error('Failed to transpile TypeScript bundle');
}
console.log('Transpiled successfully, code length:', result.code.length);
