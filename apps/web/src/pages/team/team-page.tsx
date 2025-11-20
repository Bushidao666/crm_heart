import { useState } from 'react'

import { TeamInviteForm } from '@/features/team/components/team-invite-form'
import { TeamMembersTable } from '@/features/team/components/team-members-table'
import { TeamCredentialsModal } from '@/features/team/components/team-credentials-modal'
import { useTeamManagement } from '@/features/team/hooks/use-team-management'

import styles from './team-page.module.css'

export const TeamPage = () => {
  const [credentialsModal, setCredentialsModal] = useState<{ email: string; password: string; role: string } | null>(
    null,
  )
  const {
    members,
    isLoading,
    error,
    isInviting,
    inviteMessage,
    actionMessage,
    refresh,
    blacklistMember,
    isBlacklisting,
    inviteMember,
    isDeleting,
    deleteMember,
    isRestoring,
    restoreMember,
  } =
    useTeamManagement()

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestão de equipe</h1>
          <p className={styles.subtitle}>
            Convide novos colaboradores, acompanhe o status de acesso e mantenha a segurança da sua operação.
          </p>
        </div>
      </header>

      <article className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Convidar novo membro</h2>
          <p className={styles.cardSubtitle}>Envie convites com definição de função e acompanhe o status de ativação.</p>
        </div>

        <TeamInviteForm
          isInviting={isInviting}
          infoMessage={inviteMessage}
          onInvite={inviteMember}
          onInviteSuccess={(result) => {
            if (result.credentials) {
              setCredentialsModal(result.credentials)
            }
          }}
        />
      </article>

      <article className={styles.card}>
        <TeamMembersTable
          members={members}
          isLoading={isLoading}
          error={error}
          infoMessage={actionMessage}
          onRefresh={refresh}
          onBlacklist={(memberId) => {
            void blacklistMember(memberId)
          }}
          blacklistingId={isBlacklisting}
          deletingId={isDeleting}
          restoringId={isRestoring}
          onDelete={(memberId) => {
            void deleteMember(memberId)
          }}
          onRestore={(memberId) => {
            void restoreMember(memberId)
          }}
        />
      </article>

      <TeamCredentialsModal
        open={Boolean(credentialsModal)}
        credentials={credentialsModal}
        onClose={() => setCredentialsModal(null)}
      />
    </section>
  )
}
