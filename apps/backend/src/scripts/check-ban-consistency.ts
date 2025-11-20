import 'dotenv/config'

import { createClient, type User } from '@supabase/supabase-js'

type TeamMember = {
  id: string
  user_id: string | null
  status: string | null
  metadata: Record<string, unknown> | null
}

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const

const missing = requiredEnv.filter((key) => !process.env[key])

if (missing.length > 0) {
  throw new Error(`Variáveis de ambiente ausentes: ${missing.join(', ')}`)
}

const supabaseUrl = process.env.SUPABASE_URL as string
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
const heartSchema = process.env.SUPABASE_HEART_SCHEMA ?? 'heart'

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const fetchTeamMembers = async (statusFilter: 'removed' | 'active') => {
  const query = supabase
    .schema(heartSchema)
    .from<TeamMember>('equipe')
    .select('id, user_id, status, metadata', { count: 'exact' })

  const { data, error } =
    statusFilter === 'removed'
      ? await query.eq('status', 'removed')
      : await query.neq('status', 'removed')

  if (error) {
    throw error
  }

  return data ?? []
}

const fetchDisabledUsers = async () => {
  const disabled: User[] = []
  let nextPage: number | null = 1
  const perPage = 200

  while (nextPage) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: nextPage, perPage })
    if (error) {
      throw error
    }

    const users = data?.users ?? []
    disabled.push(
      ...users.filter((user) => Boolean((user.app_metadata as Record<string, unknown> | undefined)?.disabled)),
    )

    nextPage = data?.nextPage ?? null
  }

  return disabled
}

const printTable = (title: string, rows: Record<string, unknown>[]) => {
  if (rows.length === 0) {
    console.log(`✅ ${title}: nenhuma inconsistência encontrada.`)
    return
  }

  console.log(`\n⚠️  ${title} (${rows.length})`)
  console.table(rows)
}

const main = async () => {
  console.log('Verificando consistência de banimento...')
  const [removedMembers, activeMembers, disabledUsers] = await Promise.all([
    fetchTeamMembers('removed'),
    fetchTeamMembers('active'),
    fetchDisabledUsers(),
  ])

  const disabledIds = new Set(disabledUsers.map((user) => user.id))
  const removedByUserId = new Map(removedMembers.filter((member) => member.user_id).map((member) => [member.user_id as string, member]))
  const activeByUserId = new Map(activeMembers.filter((member) => member.user_id).map((member) => [member.user_id as string, member]))

  const removedWithoutAuthBan = removedMembers
    .filter((member) => member.user_id && !disabledIds.has(member.user_id))
    .map((member) => ({
      equipe_id: member.id,
      user_id: member.user_id,
      status: member.status,
      metadata_flags: JSON.stringify(member.metadata ?? {}),
    }))

  const disabledWithoutRemovedStatus = Array.from(disabledIds)
    .filter((userId) => !removedByUserId.has(userId))
    .map((userId) => {
      const user = disabledUsers.find((item) => item.id === userId)
      const teamRecord = activeByUserId.get(userId)
      return {
        user_id: userId,
        email: user?.email ?? null,
        equipe_id: teamRecord?.id ?? null,
        equipe_status: teamRecord?.status ?? null,
        banned_at: (user?.app_metadata as { banned_at?: string | null } | undefined)?.banned_at ?? null,
      }
    })

  printTable('Usuários removidos sem banimento no Auth', removedWithoutAuthBan)
  printTable('Usuários banidos no Auth mas com status diferente de removed', disabledWithoutRemovedStatus)

  if (removedWithoutAuthBan.length > 0 || disabledWithoutRemovedStatus.length > 0) {
    console.error('\nInconsistências identificadas. Execute o serviço de banimento novamente ou ajuste manualmente.')
    process.exitCode = 1
    return
  }

  console.log('\nTudo certo! Nenhuma inconsistência encontrada.')
}

void main()
