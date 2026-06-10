import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'public', 'icons');
const source = path.join(root, 'public', 'logo.png');

/** App shell background (slate-900) */
const BG = { r: 15, g: 23, b: 42, alpha: 1 };

const sizes = [180, 192, 512];

await mkdir(outDir, { recursive: true });

for (const size of sizes) {
  const pad = Math.round(size * 0.12);
  const inner = size - pad * 2;
  await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: BG })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: BG,
    })
    .png()
    .toFile(path.join(outDir, `icon-${size}.png`));
}

console.log(`Generated PWA icons in public/icons (${sizes.join(', ')}px)`);