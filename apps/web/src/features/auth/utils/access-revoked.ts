export const ACCESS_REVOKED_EVENT = 'crm-heart:access-revoked'
const ACCESS_REVOKED_STORAGE_KEY = 'crm-heart:access-revoked-info'

export type AccessRevokedInfo = {
  message: string
  detail?: string | null
  reason?: string | null
  banReason?: string | null
  at: string
}

export type AccessRevokedEventDetail = {
  message?: string
  detail?: string
  reason?: string
  banReason?: string | null
}

export const persistAccessRevokedInfo = (info: AccessRevokedInfo) => {
  try {
    sessionStorage.setItem(ACCESS_REVOKED_STORAGE_KEY, JSON.stringify(info))
  } catch (error) {
    console.warn('Unable to persist access revoked info', error)
  }
}

export const getAccessRevokedInfo = (): AccessRevokedInfo | null => {
  try {
    const raw = sessionStorage.getItem(ACCESS_REVOKED_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AccessRevokedInfo
  } catch (error) {
    console.warn('Unable to read access revoked info', error)
    return null
  }
}

export const clearAccessRevokedInfo = () => {
  try {
    sessionStorage.removeItem(ACCESS_REVOKED_STORAGE_KEY)
  } catch (error) {
    console.warn('Unable to clear access revoked info', error)
  }
}

export const dispatchAccessRevokedEvent = (detail?: AccessRevokedEventDetail) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ACCESS_REVOKED_EVENT, { detail }))
}
