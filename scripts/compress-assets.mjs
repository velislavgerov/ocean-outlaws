import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { toktx, TextureCompression } from '@gltf-transform/functions';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dir, '..');
const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  }));
  return files.flat();
}

const allStaticFiles = await walk(path.join(ROOT, 'static')).catch(() => []);
const glbFiles = allStaticFiles.filter((f) => f.endsWith('.glb') && !f.endsWith('.compressed.glb'));
for (const file of glbFiles) {
  const out = file.replace('.glb', '.compressed.glb');
  console.log(`Compressing ${path.relative(ROOT, file)} …`);
  const doc = await io.read(file);
  await doc.transform(toktx({ mode: TextureCompression.ETC1S, quality: 255 }));
  await io.write(out, doc);
  console.log(`  → ${path.relative(ROOT, out)}`);
}

const uiFiles = allStaticFiles.filter((f) => /\.\b(png|jpg|jpeg)$/i.test(f) || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
for (const file of uiFiles) {
  const out = file.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  await sharp(file).webp({ quality: 85 }).toFile(out);
  console.log(`WebP: ${path.relative(ROOT, file)} → ${path.relative(ROOT, out)}`);
}

console.log('Done.');
