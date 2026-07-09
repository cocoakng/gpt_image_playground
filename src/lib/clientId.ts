/** 生成客户端唯一标识，存储在 localStorage 中以便持久化 */
const CLIENT_ID_KEY = 'gpt-image-playground-client-id'

let cachedId: string | null = null

export function getClientId(): string {
  if (cachedId) return cachedId

  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY)
    if (stored) {
      cachedId = stored
      return cachedId
    }
  } catch {
    // localStorage may be unavailable
  }

  const newId = generateRandomId()
  cachedId = newId
  try {
    localStorage.setItem(CLIENT_ID_KEY, newId)
  } catch {
    // ignore
  }
  return newId
}

function generateRandomId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
