import type { Session, User } from '@supabase/supabase-js'

export type BanMetadata = {
  disabled: boolean
  bannedAt: string | null
  banReason: string | null
}

const extractFromAppMetadata = (user?: User | null): BanMetadata => {
  const metadata = (user?.app_metadata ?? {}) as Record<string, unknown>
  const disabled = Boolean(metadata.disabled)
  const bannedAt = typeof metadata.banned_at === 'string' ? metadata.banned_at : null
  const banReason = typeof metadata.ban_reason === 'string' ? metadata.ban_reason : null

  return { disabled, bannedAt, banReason }
}

export const getSessionBanMetadata = (session: Session | null): BanMetadata => {
  if (!session?.user) {
    return { disabled: false, bannedAt: null, banReason: null }
  }

  return extractFromAppMetadata(session.user)
}

export const isSessionBanned = (session: Session | null): boolean => getSessionBanMetadata(session).disabled
