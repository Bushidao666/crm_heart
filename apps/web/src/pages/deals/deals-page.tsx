import { useCallback, useEffect, useMemo, useState } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCompany } from '@/app/providers/use-company'
import { DealFilters } from '@/features/deals/components/deal-filters'
import { DealDrawer } from '@/features/deals/components/deal-drawer'
import { DealsColumn } from '@/features/deals/components/deals-column'
import { useDealsKanban } from '@/features/deals/hooks/use-deals-kanban'
import { DEAL_STATUS_LABELS, type DealRecord, type DealStatus } from '@/features/deals/types'
import { DEAL_DRAWER_STORAGE_KEY, DEAL_DRAFT_STORAGE_PREFIX } from '@/features/deals/constants'
import { KANBAN_PAGE_SIZE } from '@/constants/kanban'
import { getDateRangeForPreset, type DatePreset } from '@/features/leads/utils/date-presets'
import { ADMIN_ROLES } from '@/features/auth/constants'
import { heartSupabase } from '@/lib/supabase-client'

import styles from './deals-page.module.css'

const COLUMNS: DealStatus[] = ['negocio_novo', 'contrato_enviado', 'contrato_assinado', 'contrato_rejeitado']

const createInitialPages = (): Record<DealStatus, number> =>
  COLUMNS.reduce((acc, status) => {
    acc[status] = 1
    return acc
  }, {} as Record<DealStatus, number>)

type ContextMenuState = {
  deal: DealRecord
  position: { x: number; y: number }
  isSelecting: boolean
}

type DateFilterPreset = DatePreset | 'custom'

const statusFromDroppable = (id: string): DealStatus | null => {
  if (id === 'negocio_novo' || id === 'contrato_enviado' || id === 'contrato_assinado' || id === 'contrato_rejeitado') {
    return id
  }
  return null
}

const getDealDisplayName = (deal: DealRecord) => {
  const fullName = deal.deal_full_name?.trim()
  if (fullName) return fullName
  if (deal.deal_email) return deal.deal_email
  if (deal.deal_phone) return deal.deal_phone
  return `Negócio ${deal.id.slice(0, 6)}`
}

export const DealsPage = () => {
  const { user, hasRole } = useAuth()
  const { companyId } = useCompany()
  const isAdmin = hasRole(ADMIN_ROLES)
  const { dealsByStatus, fetchDeals, updateDealStatus, upsertDeal, createDeal, deleteDeal, isLoading, error } =
    useDealsKanban()
  const [searchTerm, setSearchTerm] = useState('')
  const [activePreset, setActivePreset] = useState<DateFilterPreset>('all')
  const [customRange, setCustomRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null })
  const [selectedDeal, setSelectedDeal] = useState<(Partial<DealRecord> & { id: string }) | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [columnPages, setColumnPages] = useState<Record<DealStatus, number>>(() => createInitialPages())
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [isCreatingDeal, setIsCreatingDeal] = useState(false)
  const [dealPendingDeletion, setDealPendingDeletion] = useState<DealRecord | null>(null)
  const [isDeletingDeal, setIsDeletingDeal] = useState(false)
  const [dealOwnersMap, setDealOwnersMap] = useState<Record<string, string>>({})
  const [sellerFilterOptions, setSellerFilterOptions] = useState<{ value: string; label: string }[]>([])
  const [selectedSellerFilter, setSelectedSellerFilter] = useState('')

  const allDeals = useMemo(() => {
    return COLUMNS.flatMap((status) => dealsByStatus[status] ?? [])
  }, [dealsByStatus])

  const resolvedDateRange = useMemo(() => {
    if (activePreset === 'custom') {
      const startIso = customRange.start ? new Date(`${customRange.start}T00:00:00`).toISOString() : null
      const endIso = customRange.end ? new Date(`${customRange.end}T23:59:59.999`).toISOString() : null
      return { start: startIso, end: endIso }
    }
    return getDateRangeForPreset(activePreset)
  }, [activePreset, customRange])

  const handlePresetChange = useCallback((value: DateFilterPreset) => {
    setActivePreset(value)
    if (value !== 'custom') {
      setCustomRange({ start: null, end: null })
    }
  }, [])

  const handleCustomRangeChange = useCallback((key: 'start' | 'end', value: string) => {
    setActivePreset('custom')
    setCustomRange((prev) => {
      const nextValue = value && value.trim().length > 0 ? value : null
      if (prev[key] === nextValue) return prev
      return { ...prev, [key]: nextValue }
    })
  }, [])

  const clampPosition = useCallback((coords: { x: number; y: number }) => {
    if (typeof window === 'undefined') return coords

    const margin = 16
    const estimatedWidth = 220
    const estimatedHeight = 220

    const maxX = window.innerWidth - estimatedWidth - margin
    const maxY = window.innerHeight - estimatedHeight - margin

    return {
      x: Math.max(margin, Math.min(coords.x, maxX)),
      y: Math.max(margin, Math.min(coords.y, maxY)),
    }
  }, [])

  const activeOwnerFilter = isAdmin ? selectedSellerFilter || null : undefined

  useEffect(() => {
    const handler = setTimeout(() => {
      setColumnPages(createInitialPages())
      void fetchDeals({ searchTerm, dateRange: resolvedDateRange, ownerId: activeOwnerFilter })
    }, 300)

    return () => clearTimeout(handler)
  }, [searchTerm, resolvedDateRange, fetchDeals, activeOwnerFilter])

  useEffect(() => {
    setColumnPages((previous) => {
      let hasChanges = false
      const nextState = { ...previous }

      for (const status of COLUMNS) {
        const totalDeals = dealsByStatus[status]?.length ?? 0
        const pageCount = Math.max(1, Math.ceil(totalDeals / KANBAN_PAGE_SIZE))
        const currentPage = previous[status] ?? 1
        const normalizedPage = Math.min(currentPage, pageCount)

        if (normalizedPage !== currentPage) {
          nextState[status] = normalizedPage
          hasChanges = true
        }
      }

    return hasChanges ? nextState : previous
  })
  }, [dealsByStatus])

  useEffect(() => {
    if (!isAdmin || !companyId) {
      setDealOwnersMap({})
      setSellerFilterOptions([])
      return
    }

    let isMounted = true

    heartSupabase
      .from('crm_user_profiles')
      .select('id, user_id, user_name, user_email')
      .eq('company_id', companyId)
      .eq('role', 'vendedor')
      .then(({ data, error }) => {
        if (!isMounted) return
        if (error) {
          console.error('Failed to load deal owners map', error)
          setDealOwnersMap({})
          return
        }

        const map: Record<string, string> = {}
        const options: { value: string; label: string }[] = []
        data?.forEach((member) => {
          const key = member.user_id ?? member.id
          if (key) {
            const label = member.user_name ?? member.user_email ?? key
            map[key] = label
            options.push({ value: key, label })
          }
        })

        setDealOwnersMap(map)
        setSellerFilterOptions(options)
      })

    return () => {
      isMounted = false
    }
  }, [companyId, isAdmin])

  const paginatedColumns = useMemo(() => {
    return COLUMNS.reduce<Record<DealStatus, { total: number; pageCount: number; currentPage: number; deals: DealRecord[] }>>(
      (acc, status) => {
        const allDeals = dealsByStatus[status] ?? []
        const total = allDeals.length
        const pageCount = Math.max(1, Math.ceil(total / KANBAN_PAGE_SIZE))
        const requestedPage = columnPages[status] ?? 1
        const currentPage = Math.min(requestedPage, pageCount)
        const start = (currentPage - 1) * KANBAN_PAGE_SIZE
        const end = start + KANBAN_PAGE_SIZE

        acc[status] = {
          total,
          pageCount,
          currentPage,
          deals: allDeals.slice(start, end),
        }

        return acc
      },
      {} as Record<DealStatus, { total: number; pageCount: number; currentPage: number; deals: DealRecord[] }>,
    )
  }, [columnPages, dealsByStatus])

  useEffect(() => {
    if (!contextMenu) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [contextMenu])

  useEffect(() => {
    if (!isAdmin) {
      setSelectedSellerFilter('')
      return
    }

    const hasOption = sellerFilterOptions.some((option) => option.value === selectedSellerFilter)
    if (!hasOption) {
      setSelectedSellerFilter('')
    }
  }, [isAdmin, sellerFilterOptions, selectedSellerFilter])

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination || destination.droppableId === source.droppableId) {
      return
    }

    const newStatus = statusFromDroppable(destination.droppableId)
    const currentStatus = statusFromDroppable(source.droppableId)

    if (!newStatus || !currentStatus) return

    try {
      await updateDealStatus(draggableId, newStatus)
    } catch (error) {
      console.error(error)
      alert((error as Error).message)
    }
  }

  const openDeal = useCallback(
    (deal: Partial<DealRecord> & { id: string }, options?: { isNew?: boolean }) => {
      setSelectedDeal(deal)
      setDrawerOpen(true)
      setIsCreatingDeal(Boolean(options?.isNew))

      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            DEAL_DRAWER_STORAGE_KEY,
            JSON.stringify({ id: deal.id, snapshot: deal }),
          )
        }
      } catch (error) {
        console.warn('Failed to persist selected deal state', error)
      }
    },
    [],
  )

  const handleDealContextMenu = useCallback(
    (deal: DealRecord, position: { x: number; y: number }) => {
      setContextMenu({ deal, position: clampPosition(position), isSelecting: false })
    },
    [clampPosition],
  )

  const availableStatuses = useMemo(() => {
    if (!contextMenu) return []
    return COLUMNS.filter((status) => status !== contextMenu.deal.deal_status)
  }, [contextMenu])

  const handleContextMenuMove = useCallback(
    async (status: DealStatus) => {
      if (!contextMenu) return

      const deal = contextMenu.deal
      setContextMenu(null)

      if (status === deal.deal_status) return

      try {
        await updateDealStatus(deal.id, status)
      } catch (error) {
        console.error(error)
        alert((error as Error).message)
      }
    },
    [contextMenu, updateDealStatus],
  )

  const requestDealDeletion = useCallback(
    (deal: DealRecord) => {
      if (!isAdmin) return
      setContextMenu(null)
      setDealPendingDeletion(deal)
    },
    [isAdmin],
  )

  const dealPendingDeletionName = useMemo(
    () => (dealPendingDeletion ? getDealDisplayName(dealPendingDeletion) : ''),
    [dealPendingDeletion],
  )

  const handleCancelDeleteDeal = useCallback(() => {
    if (isDeletingDeal) return
    setDealPendingDeletion(null)
  }, [isDeletingDeal])

  const handleConfirmDeleteDeal = useCallback(async () => {
    if (!dealPendingDeletion) return
    if (!isAdmin) return

    setIsDeletingDeal(true)
    try {
      await deleteDeal(dealPendingDeletion.id)
      setDealPendingDeletion(null)
    } catch (error) {
      console.error(error)
      alert((error as Error).message)
    } finally {
      setIsDeletingDeal(false)
    }
  }, [dealPendingDeletion, deleteDeal, isAdmin])

  const renderDealOwnerLabel = useCallback(
    (deal: DealRecord) => {
      if (!isAdmin) return null
      if (!deal.vendedor_responsavel) return null
      return dealOwnersMap[deal.vendedor_responsavel] ?? null
    },
    [dealOwnersMap, isAdmin],
  )

  const handleCardClick = (deal: DealRecord) => {
    openDeal(deal)
  }

  const handleSave = async (payload: Partial<DealRecord> & { id: string }) => {
    const normalizedFullName = payload.deal_full_name?.trim() ?? ''
    const [firstName, ...restName] = normalizedFullName ? normalizedFullName.split(/\s+/) : []
    const enhancedPayload: Partial<DealRecord> & { id: string } = {
      ...payload,
      deal_full_name: normalizedFullName || null,
      deal_first_name: normalizedFullName ? firstName ?? null : null,
      deal_last_name: normalizedFullName && restName.length > 0 ? restName.join(' ') : null,
    }

    const dealExists = allDeals.some((deal) => deal.id === enhancedPayload.id)
    const shouldCreate = isCreatingDeal || !dealExists

    if (shouldCreate) {
      const sellerId = user?.id ?? null

      if (!sellerId) {
        throw new Error('Não foi possível identificar o vendedor responsável para criar o negócio.')
      }

      await createDeal({
        ...enhancedPayload,
        deal_status: enhancedPayload.deal_status ?? 'negocio_novo',
        vendedor_responsavel: enhancedPayload.vendedor_responsavel ?? sellerId,
      })
      return
    }

    await upsertDeal(enhancedPayload)
  }

  const handleDrawerClose = () => {
    setDrawerOpen(false)
    setSelectedDeal(null)
    setIsCreatingDeal(false)
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(DEAL_DRAWER_STORAGE_KEY)
        if (selectedDeal) {
          sessionStorage.removeItem(`${DEAL_DRAFT_STORAGE_PREFIX}:${selectedDeal.id}`)
        }
      }
    } catch (error) {
      console.warn('Failed to clear persisted deal drawer state', error)
    }
  }

  useEffect(() => {
    if (isLoading) return
    if (drawerOpen || selectedDeal) return
    try {
      if (typeof window === 'undefined') return
      const persisted = sessionStorage.getItem(DEAL_DRAWER_STORAGE_KEY)
      if (!persisted) return

      const parsed = JSON.parse(persisted) as { id?: string | null; snapshot?: Partial<DealRecord> }
      if (!parsed?.id) {
        sessionStorage.removeItem(DEAL_DRAWER_STORAGE_KEY)
        return
      }

      const allDeals = dealsByStatus.negocio_novo
        .concat(dealsByStatus.contrato_enviado)
        .concat(dealsByStatus.contrato_assinado)
        .concat(dealsByStatus.contrato_rejeitado)

      const existingDeal = allDeals.find((deal) => deal.id === parsed.id)

      if (existingDeal) {
        setSelectedDeal(existingDeal)
        setDrawerOpen(true)
      } else {
        if (parsed.snapshot) {
          setSelectedDeal({ ...parsed.snapshot, id: parsed.id })
          setDrawerOpen(true)
        }
      }
    } catch (error) {
      console.warn('Failed to restore persisted deal drawer state', error)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(DEAL_DRAWER_STORAGE_KEY)
      }
    }
  }, [dealsByStatus, isLoading, drawerOpen, selectedDeal])

  const handleCreateDeal = () => {
    const generateId = () => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
      }
      return Math.random().toString(36).slice(2)
    }

    const newDeal: Partial<DealRecord> & { id: string } = {
      id: generateId(),
      deal_status: 'negocio_novo',
      vendedor_responsavel: user?.id ?? null,
    }

    openDeal(newDeal, { isNew: true })
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Gestão de negócios</h1>
          <p className={styles.subtitle}>Acompanhe os negócios convertidos, envie contratos e finalize vendas.</p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.createButton}
            onClick={handleCreateDeal}
            disabled={drawerOpen && isCreatingDeal}
          >
            Criar Negócio
          </button>
        </div>
      </header>

      <DealFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activePreset={activePreset}
        onPresetChange={handlePresetChange}
        customRange={customRange}
        onCustomRangeChange={handleCustomRangeChange}
        ownerOptions={isAdmin ? sellerFilterOptions : undefined}
        ownerValue={selectedSellerFilter}
        onOwnerChange={isAdmin ? setSelectedSellerFilter : undefined}
      />

      {error ? <p className={styles.error}>{error}</p> : null}
      {isLoading ? <p className={styles.loading}>Carregando negócios...</p> : null}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className={styles.kanban}>
          {COLUMNS.map((columnKey) => (
            <DealsColumn
              key={columnKey}
              droppableId={columnKey}
              title={DEAL_STATUS_LABELS[columnKey]}
              deals={paginatedColumns[columnKey]?.deals ?? []}
              totalDeals={paginatedColumns[columnKey]?.total ?? 0}
              currentPage={paginatedColumns[columnKey]?.currentPage ?? 1}
              pageCount={paginatedColumns[columnKey]?.pageCount ?? 1}
              onPageChange={(page) =>
                setColumnPages((previous) => {
                  const safePage = Math.min(
                    Math.max(page, 1),
                    paginatedColumns[columnKey]?.pageCount ?? 1,
                  )

                  if (safePage === (previous[columnKey] ?? 1)) {
                    return previous
                  }

                  return { ...previous, [columnKey]: safePage }
                })
              }
              onDealContextMenu={handleDealContextMenu}
              onCardClick={handleCardClick}
              renderOwnerLabel={renderDealOwnerLabel}
            />
          ))}
        </div>
      </DragDropContext>

      {contextMenu ? (
        <div
          className={styles.contextMenuOverlay}
          onClick={() => setContextMenu(null)}
          onContextMenu={(event) => {
            event.preventDefault()
            setContextMenu(null)
          }}
        >
          <div
            className={styles.contextMenu}
            style={{ top: contextMenu.position.y, left: contextMenu.position.x }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            {isAdmin ? (
              <button
                type="button"
                className={styles.contextMenuDelete}
                onClick={() => {
                  if (!contextMenu) return
                  requestDealDeletion(contextMenu.deal)
                }}
              >
                Excluir
              </button>
            ) : null}
            <button
              type="button"
              className={styles.contextMenuAction}
              onClick={() =>
                setContextMenu((prev) => (prev ? { ...prev, isSelecting: true } : prev))
              }
            >
              Mover para
            </button>

            {contextMenu.isSelecting ? (
              <div className={styles.contextMenuSelect}>
                <span className={styles.contextMenuHint}>Selecione o kanban</span>
                {availableStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={styles.contextMenuOption}
                    onClick={() => handleContextMenuMove(status)}
                  >
                    {DEAL_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isAdmin && dealPendingDeletion ? (
        <div
          className={styles.confirmOverlay}
          role="dialog"
          aria-modal="true"
          onClick={handleCancelDeleteDeal}
        >
          <div
            className={styles.confirmContent}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className={styles.confirmTitle}>Excluir negócio</h2>
            <p className={styles.confirmMessage}>
              Tem certeza que deseja excluir o negócio{' '}
              <span className={styles.confirmHighlight}>
                {dealPendingDeletionName || 'selecionado'}
              </span>
              ?
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancelButton}
                onClick={handleCancelDeleteDeal}
                disabled={isDeletingDeal}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                onClick={() => void handleConfirmDeleteDeal()}
                disabled={isDeletingDeal}
              >
                {isDeletingDeal ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DealDrawer
        deal={selectedDeal}
        open={drawerOpen}
        onClose={handleDrawerClose}
        onSave={handleSave}
      />
    </section>
  )
}
