#!/usr/bin/env node
// Scan repo for app folders (anything containing privacy.html) and write
// slug-index.json — the canonical slug list used by middleware.js to
// rewrite slug variants (e.g. scoredeck → score-deck) at the edge.
//
// Run automatically at deploy via vercel.json buildCommand. Safe to run
// manually too: `node scripts/build-slug-index.mjs`.

import { readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.vercel', 'scripts', '.github']);

async function listAppDirs() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const slugs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
    const privacyPath = join(ROOT, entry.name, 'privacy.html');
    try {
      const s = await stat(privacyPath);
      if (s.isFile()) slugs.push(entry.name);
    } catch {
      // No privacy.html → not an app dir, skip.
    }
  }
  return slugs.sort();
}

async function main() {
  const slugs = await listAppDirs();

  // Collision guard: normalized form must be unique across canonical slugs.
  // If two canonical slugs collapse to the same normalized form, the
  // middleware rewrite would be ambiguous — fail loudly so Sếp renames.
  const seen = new Map();
  const collisions = [];
  for (const s of slugs) {
    const norm = s.toLowerCase().replace(/[-_]/g, '');
    if (seen.has(norm)) collisions.push([seen.get(norm), s, norm]);
    else seen.set(norm, s);
  }
  if (collisions.length) {
    console.error('[fail] slug normalization collisions:');
    for (const [a, b, n] of collisions) console.error(`  "${a}" + "${b}" both normalize to "${n}"`);
    process.exit(1);
  }

  const out = {
    generated_at: new Date().toISOString(),
    count: slugs.length,
    slugs,
  };
  await writeFile(join(ROOT, 'slug-index.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`[ok] slug-index.json written: ${slugs.length} apps`);
}

main().catch((err) => {
  console.error('[fail]', err);
  process.exit(1);
});
