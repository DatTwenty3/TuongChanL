import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const VENDOR_COPIES = [
  ['node_modules/mathjax/es5/tex-svg.js', 'public/vendor/mathjax/tex-svg.js'],
  ['node_modules/tesseract.js/dist/worker.min.js', 'public/vendor/tesseract/worker.min.js'],
  [
    'node_modules/tesseract.js-core/tesseract-core-lstm.wasm',
    'public/vendor/tesseract-core/tesseract-core-lstm.wasm',
  ],
  [
    'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
    'public/vendor/tesseract-core/tesseract-core-lstm.wasm.js',
  ],
  [
    'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm',
    'public/vendor/tesseract-core/tesseract-core-simd-lstm.wasm',
  ],
  [
    'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
    'public/vendor/tesseract-core/tesseract-core-simd-lstm.wasm.js',
  ],
  [
    'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
    'public/vendor/tesseract-data/4.0.0_best_int/eng.traineddata.gz',
  ],
];

for (const [srcRel, dstRel] of VENDOR_COPIES) {
  const src = resolve(rootDir, srcRel);
  const dst = resolve(rootDir, dstRel);
  if (!existsSync(src)) {
    throw new Error(`Missing required vendor asset: ${srcRel}`);
  }
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  const size = statSync(dst).size;
  console.log(`[sync-vendor] ${dstRel} (${size.toLocaleString('en-US')} B)`);
}
