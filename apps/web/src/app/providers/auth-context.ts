import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import type { UserProfile } from '@/features/auth/types'

export type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  isSessionLoading: boolean
  isProfileLoading: boolean
  profileError: string | null
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
