/** True when a relative path leaves its root, using whole path segments. */
export function isOutside(path: string): boolean {
  return path === ".." || path.startsWith("../") || path.startsWith("..\\") || /^[A-Za-z]:[\\/]/u.test(path) || path.startsWith("/");
}
