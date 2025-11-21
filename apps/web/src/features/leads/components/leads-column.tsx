import { Draggable, Droppable } from '@hello-pangea/dnd'

import { LeadCard } from '@/features/leads/components/lead-card'
import type { LeadRecord, LeadStatus } from '@/features/leads/types'

import styles from './leads-column.module.css'

type LeadsColumnProps = {
  droppableId: LeadStatus
  title: string
  leads: LeadRecord[]
  totalLeads: number
  currentPage: number
  pageCount: number
  onPageChange: (page: number) => void
  highlight?: string
  onLeadClick?: (lead: LeadRecord) => void
  onLeadContextMenu?: (lead: LeadRecord, position: { x: number; y: number }) => void
  renderOwnerLabel?: (lead: LeadRecord) => string | null
}

export const LeadsColumn = ({
  droppableId,
  title,
  leads,
  totalLeads,
  currentPage,
  pageCount,
  onPageChange,
  highlight,
  onLeadClick,
  onLeadContextMenu,
  renderOwnerLabel,
}: LeadsColumnProps) => {
  const handlePageChange = (page: number) => {
    if (page === currentPage) return
    onPageChange(page)
  }

  return (
    <div className={styles.column}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.count}>{totalLeads}</span>
      </header>

      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={[styles.list, snapshot.isDraggingOver ? styles.listDragging : ''].join(' ')}
          >
            {leads.length === 0 ? <p className={styles.empty}>Nenhum lead aqui por enquanto.</p> : null}

            {leads.map((lead, index) => (
              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                {(draggableProvided, draggableSnapshot) => (
                  <div
                    ref={draggableProvided.innerRef}
                    {...draggableProvided.draggableProps}
                    {...draggableProvided.dragHandleProps}
                    className={[styles.cardWrapper, draggableSnapshot.isDragging ? styles.cardDragging : ''].join(' ')}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      onLeadContextMenu?.(lead, { x: event.clientX, y: event.clientY })
                    }}
                  >
                    <LeadCard
                      lead={lead}
                      highlight={highlight}
                      onClick={onLeadClick}
                      ownerLabel={renderOwnerLabel?.(lead) ?? null}
                    />
                  </div>
                )}
              </Draggable>
            ))}

            {provided.placeholder}

            {pageCount > 1 ? (
              <div className={styles.pagination}>
                {Array.from({ length: pageCount }, (_, index) => {
                  const page = index + 1
                  const isActive = page === currentPage

                  return (
                    <button
                      key={page}
                      type="button"
                      className={[styles.pageButton, isActive ? styles.pageButtonActive : ''].join(' ')}
                      onClick={() => handlePageChange(page)}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        )}
      </Droppable>
    </div>
  )
}
