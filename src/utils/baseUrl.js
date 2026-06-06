/** Vite base path, e.g. `/` locally or `/mlb-stat-underground/` on GitHub Pages. */
export const BASE_URL = import.meta.env.BASE_URL;

/** BrowserRouter basename (no trailing slash). */
export function routerBasename() {
  if (BASE_URL === '/') return undefined;
  return BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
}

/** Public-folder asset (`public/logo.png` → `assetUrl('logo.png')`). */
export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  return `${BASE_URL}${clean}`;
}

/** Local `/badges/foo.svg` or `badges/foo.svg`; leaves http(s) URLs unchanged. */
export function resolveAssetUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  return assetUrl(path);
}