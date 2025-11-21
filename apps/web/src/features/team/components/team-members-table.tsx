import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { TeamMember } from '@/features/team/types'

import styles from './team-members-table.module.css'

const formatRelativeTime = (timestamp: string | null) => {
  if (!timestamp) return '—'

  try {
    return formatDistanceToNow(new Date(timestamp), { locale: ptBR, addSuffix: true })
  } catch (error) {
    console.error('Failed to format date', error)
    return '—'
  }
}

const getGeolocationSummary = (member: TeamMember) => {
  const sessionGeo = (member.last_session?.geolocation as Record<string, string> | undefined) ?? null
  const fallbackGeo = (member.metadata?.geolocation as Record<string, string> | undefined) ?? null
  const geolocation = sessionGeo ?? fallbackGeo
  if (!geolocation) return '—'

  const { city, region, country_name: countryName } = geolocation

  if (city && region && countryName) {
    return `${city}, ${region} - ${countryName}`
  }

  if (city && countryName) {
    return `${city} - ${countryName}`
  }

  return countryName ?? '—'
}

const getStatusLabel = (status: string | null) => {
  switch (status) {
    case 'online':
      return 'Online'
    case 'offline':
      return 'Offline'
    case 'blacklisted':
      return 'Blacklisted'
    case 'removed':
      return 'Removido'
    default:
      return status ?? 'Desconhecido'
  }
}

type TeamMembersTableProps = {
  members: TeamMember[]
  isLoading: boolean
  error: string | null
  onRefresh: () => void
  onBlacklist: (memberId: string) => void
  onDelete: (memberId: string) => void
  onRestore: (memberId: string) => void
  blacklistingId: string | null
  deletingId: string | null
  restoringId: string | null
  infoMessage: string | null
}

export const TeamMembersTable = ({
  members,
  isLoading,
  error,
  onRefresh,
  onBlacklist,
  blacklistingId,
  deletingId,
  onDelete,
  onRestore,
  restoringId,
  infoMessage,
}: TeamMembersTableProps) => {

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Equipe</h2>
          <p className={styles.subtitle}>
            Convites pendentes e colaboradores ativos. Atualize a lista após ações administrativas.
          </p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={onRefresh} disabled={isLoading}>
          {isLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}
      {infoMessage ? <p className={styles.info}>{infoMessage}</p> : null}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Função</th>
              <th>Status</th>
              <th>Última atividade</th>
              <th>Geolocalização</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyMessage}>
                  Nenhum membro encontrado. Envie um convite para começar a montar sua equipe.
                </td>
              </tr>
            ) : (
              members.map((member) => {
                const isBlacklisted = member.status === 'blacklisted'
                const isRemoved = member.status === 'removed'

                return (
                  <tr key={member.id}>
                    <td>
                      <div className={styles.userCell}>
                        <span className={styles.avatarPlaceholder}>
                          {member.user_name?.[0]?.toUpperCase() ?? member.user_email[0]?.toUpperCase() ?? '?'}
                        </span>
                        <div className={styles.userInfo}>
                          <span className={styles.userName}>{member.user_name ?? 'Nome pendente'}</span>
                          <span className={styles.userEmail}>{member.user_email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.roleBadge}>{member.role === 'admin' ? 'Administrador' : 'Vendedor'}</span>
                    </td>
                    <td>
                      <span
                        className={[
                          styles.statusBadge,
                          styles[`status${getStatusLabel(member.status)}` as const] ?? styles.statusDefault,
                        ].join(' ')}
                      >
                        {getStatusLabel(member.status)}
                      </span>
                    </td>
                    <td>{formatRelativeTime(member.last_activity)}</td>
                    <td>{getGeolocationSummary(member)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button type="button" className={styles.actionButton} disabled>
                          Ver histórico
                        </button>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          disabled={blacklistingId === member.id || isBlacklisted || isRemoved}
                          onClick={() => onBlacklist(member.id)}
                        >
                          {blacklistingId === member.id ? 'Atualizando...' : 'Adicionar à blacklist'}
                        </button>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          disabled={deletingId === member.id || isRemoved}
                          onClick={() => {
                            const confirmed = window.confirm(
                              'Tem certeza que deseja excluir este usuário? Essa ação não pode ser desfeita.',
                            )
                            if (confirmed) {
                              onDelete(member.id)
                            }
                          }}
                        >
                          {deletingId === member.id ? 'Excluindo...' : 'Excluir'}
                        </button>
                        {isRemoved ? (
                          <button
                            type="button"
                            className={styles.restoreButton}
                            disabled={restoringId === member.id}
                            onClick={() => onRestore(member.id)}
                          >
                            {restoringId === member.id ? 'Restaurando...' : 'Restaurar acesso'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
