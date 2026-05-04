/**
 * UUID v4 generátor — HTTP és HTTPS kontextusban egyaránt működik.
 *
 * `crypto.randomUUID()` csak secure context-ben (HTTPS / localhost) érhető el.
 * Az app Unraid-en HTTP-n fut (192.168.x.x), ezért szükséges a fallback.
 */
export function generateId(): string {
  if (
    typeof crypto \!== 'undefined' &&
    typeof (crypto as Crypto).randomUUID === 'function'
  ) {
    return (crypto as Crypto).randomUUID()
  }
  // Fallback: Math.random()-alapú UUID v4 (RFC 4122 kompatibilis)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
