export function faviconUrl(url: string, size = 32): string | null {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=${size}&domain=${encodeURIComponent(host)}`;
  } catch {
    return null;
  }
}

// Generic chain-link glyph, inlined as a data URI so a link whose favicon
// 404s (or whose host blocks the favicon service) still shows something
// instead of a broken image icon.
export const LINK_FALLBACK_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9aa3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>'
)}`;
