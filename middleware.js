// Vercel Routing Middleware — slug variant normalizer.
//
// Why: app slugs can be written as score-deck, scoredeck, score_deck,
// ScoreDeck, etc. Without normalization, any non-canonical variant hits 404.
// This middleware accepts ANY case + ANY combination of dashes/underscores
// and rewrites to the canonical slug (the actual folder name on disk).
//
// Match strategy: normalize both incoming slug and known canonical slugs by
// (a) lowercasing, (b) stripping `-` and `_`. If the normalized incoming
// slug matches one canonical, rewrite. Collisions are guarded at build
// time in scripts/build-slug-index.mjs.

import { rewrite, next } from '@vercel/functions';
import slugIndex from './slug-index.json' with { type: 'json' };

const CANONICAL_SET = new Set(slugIndex.slugs);
const NORMALIZED_MAP = new Map(
  slugIndex.slugs.map((s) => [normalize(s), s])
);

function normalize(s) {
  return s.toLowerCase().replace(/[-_]/g, '');
}

export const config = {
  // Match anything that looks like /<slug>/<page>. Skip Vercel internals,
  // favicon, and anything with a file extension (assets).
  matcher: ['/((?!_next|favicon\\.ico|_vercel|api|.*\\.[a-z0-9]+).*)'],
};

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (pathname === '/' || pathname === '') return next();

  // Parse /<slug>(/<rest>?)
  const m = pathname.match(/^\/([^/]+)(\/.*)?$/);
  if (!m) return next();
  const slug = m[1];
  const rest = m[2] || '';

  // Already canonical → fast path
  if (CANONICAL_SET.has(slug)) return next();

  // Try fuzzy match
  const canonical = NORMALIZED_MAP.get(normalize(slug));
  if (!canonical || canonical === slug) return next();

  // Rewrite (transparent — URL bar stays as user typed it). If you want
  // the address bar to update to the canonical form, swap to redirect().
  url.pathname = `/${canonical}${rest}`;
  return rewrite(url);
}
