import { Draggable, Droppable } from '@hello-pangea/dnd'

import { DealCard } from '@/features/deals/components/deal-card'
import type { DealRecord, DealStatus } from '@/features/deals/types'

import styles from './deals-column.module.css'

type DealsColumnProps = {
  droppableId: DealStatus
  title: string
  deals: DealRecord[]
  totalDeals: number
  currentPage: number
  pageCount: number
  onPageChange: (page: number) => void
  onCardClick?: (deal: DealRecord) => void
  onDealContextMenu?: (deal: DealRecord, position: { x: number; y: number }) => void
  renderOwnerLabel?: (deal: DealRecord) => string | null
}

export const DealsColumn = ({
  droppableId,
  title,
  deals,
  totalDeals,
  currentPage,
  pageCount,
  onPageChange,
  onCardClick,
  onDealContextMenu,
  renderOwnerLabel,
}: DealsColumnProps) => {
  const handlePageChange = (page: number) => {
    if (page === currentPage) return
    onPageChange(page)
  }

  return (
    <div className={styles.column}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.count}>{totalDeals}</span>
      </header>

      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={[styles.list, snapshot.isDraggingOver ? styles.listDragging : ''].join(' ')}
          >
            {deals.length === 0 ? <p className={styles.empty}>Nenhum negócio aqui ainda.</p> : null}

            {deals.map((deal, index) => (
              <Draggable draggableId={deal.id} index={index} key={deal.id}>
                {(draggableProvided, draggableSnapshot) => (
                  <div
                    ref={draggableProvided.innerRef}
                    {...draggableProvided.draggableProps}
                    {...draggableProvided.dragHandleProps}
                    className={[styles.cardWrapper, draggableSnapshot.isDragging ? styles.cardDragging : ''].join(' ')}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      onDealContextMenu?.(deal, { x: event.clientX, y: event.clientY })
                    }}
                  >
                    <DealCard
                      deal={deal}
                      onClick={onCardClick}
                      ownerLabel={renderOwnerLabel?.(deal) ?? null}
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
