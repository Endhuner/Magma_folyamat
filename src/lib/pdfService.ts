/**
 * HTML → PDF a szerveren (/api/v1/generate-pdf, Chromium).
 * Az App.tsx-ből kiemelve, hogy az árajánlat-modul is használhassa.
 */
export async function generateAndSavePdf(
  html: string,
  filename: string,
  download: boolean,
): Promise<boolean> {
  try {
    const token = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('pp_session='))
      ?.split('=')[1] ?? ''
    const res = await fetch('/api/v1/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ html, filename }),
    })
    if (!res.ok) return false
    if (download) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
    return true
  } catch {
    return false
  }
}
