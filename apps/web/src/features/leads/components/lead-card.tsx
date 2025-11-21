import styles from './lead-card.module.css'

import type { LeadRecord } from '@/features/leads/types'

type LeadCardProps = {
  lead: LeadRecord
  onClick?: (lead: LeadRecord) => void
  highlight?: string
  ownerLabel?: string | null
}

const highlightTerm = (text: string | null, term?: string) => {
  if (!text) return text
  if (!term) return text

  const regex = new RegExp(`(${term})`, 'gi')
  return text.split(regex).map((part, index) =>
    regex.test(part) ? (
      <mark key={`${part}-${index}`} className={styles.highlight}>
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  )
}

const getDateTimeInfo = (value: string | null) => {
  if (!value) return null

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  const date = parsedDate.toLocaleDateString('pt-BR')
  const time = parsedDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return {
    parsedDate,
    label: `${date} às ${time}`,
  }
}

export const LeadCard = ({ lead, onClick, highlight, ownerLabel }: LeadCardProps) => {
  const createdAt = getDateTimeInfo(lead.created_at)
  const updatedAt = getDateTimeInfo(lead.updated_at)
  const shouldShowUpdatedAt = Boolean(
    updatedAt && (!createdAt || updatedAt.parsedDate.getTime() !== createdAt.parsedDate.getTime()),
  )

  return (
    <article className={styles.card} onClick={() => (onClick ? onClick(lead) : undefined)}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.headerDetails}>
            <h3 className={styles.title}>
              {highlightTerm(`${lead.lead_first_name ?? ''} ${lead.lead_last_name ?? ''}`.trim(), highlight)}
            </h3>
            {ownerLabel ? <span className={styles.ownerBadge}>{ownerLabel}</span> : null}
          </div>
        </div>
        <div className={styles.timestamps}>
          <span className={styles.createdAt}>{createdAt?.label ?? '—'}</span>
          {shouldShowUpdatedAt && updatedAt ? (
            <span className={styles.updatedAt}>{`Atualizado em ${updatedAt.label}`}</span>
          ) : null}
        </div>
      </header>

      <div className={styles.details}>
        <p className={styles.detailLine}>
          <span className={styles.detailLabel}>Telefone:</span>
          <span className={styles.detailValue}>{lead.lead_phone ?? '—'}</span>
        </p>
        <p className={styles.detailLine}>
          <span className={styles.detailLabel}>Email:</span>
          <span className={styles.detailValue}>{lead.lead_email ?? '—'}</span>
        </p>
      </div>

      {lead.motivo_descarte ? (
        <p className={styles.discardReason}>
          <span className={styles.detailLabel}>Motivo descarte:</span>
          <span className={styles.detailValue}>{lead.motivo_descarte}</span>
        </p>
      ) : null}
    </article>
  )
}
