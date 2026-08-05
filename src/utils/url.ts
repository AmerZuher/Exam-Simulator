// Only http(s) links are ever stored as a clickable href — rejects
// javascript:/data:/vbscript: etc. so a saved shortcut or group link can
// never execute script on click. Sidebar links and group links are
// user-editable data (not developer-authored), so this can't be skipped.
export function isSafeUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
