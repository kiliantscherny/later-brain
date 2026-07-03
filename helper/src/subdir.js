// Validate a user-supplied save folder (relative path inside the vault).
// The vault ROOT is trusted (set at install); the subfolder comes from the
// extension, so it must not be able to escape the vault via traversal, an
// absolute path, or a drive/home prefix.
export function isSafeSubdir(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length > 200) return false;
  if (s.startsWith('/') || s.startsWith('\\') || s.startsWith('~')) return false;
  if (/^[A-Za-z]:/.test(s)) return false; // Windows drive
  const segments = s.replace(/\\/g, '/').split('/');
  for (const seg of segments) {
    if (seg === '' || seg === '.' || seg === '..') return false;
    if (/[\x00-\x1f]/.test(seg)) return false;
    if (!/^[A-Za-z0-9 _\-.]+$/.test(seg)) return false;
  }
  return true;
}
