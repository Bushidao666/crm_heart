import { useCallback, useEffect, useMemo, useState } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCompany } from '@/app/providers/use-company'
import { useLeadsKanban } from '@/features/leads/hooks/use-leads-kanban'
import { LeadFilters } from '@/features/leads/components/lead-filters'
import { LeadsColumn } from '@/features/leads/components/leads-column'
import { DiscardModal } from '@/features/leads/components/discard-modal'
import { CreateLeadModal } from '@/features/leads/components/create-lead-modal'
import { getDateRangeForPreset, type DatePreset } from '@/features/leads/utils/date-presets'
import { LEAD_STATUS_LABELS, type DiscardReason, type LeadRecord, type LeadStatus } from '@/features/leads/types'
import { KANBAN_PAGE_SIZE } from '@/constants/kanban'
import { LEAD_DISCARD_STORAGE_KEY, LEAD_DISCARD_DRAFT_PREFIX } from '@/features/leads/constants'
import { ADMIN_ROLES } from '@/features/auth/constants'
import { heartSupabase } from '@/lib/supabase-client'
import type { TeamMember } from '@/features/team/types'

import styles from './leads-page.module.css'

const COLUMNS: LeadStatus[] = ['lead_novo', 'em_atendimento', 'descartado', 'convertido']

const createInitialPages = (): Record<LeadStatus, number> =>
  COLUMNS.reduce((acc, status) => {
    acc[status] = 1
    return acc
  }, {} as Record<LeadStatus, number>)

type DateFilterPreset = DatePreset | 'custom'

type ContextMenuState = {
  lead: LeadRecord
  position: { x: number; y: number }
  isSelecting: boolean
}

const statusFromDroppable = (droppableId: string): LeadStatus | null => {
  if (droppableId === 'lead_novo') return 'lead_novo'
  if (droppableId === 'em_atendimento') return 'em_atendimento'
  if (droppableId === 'descartado') return 'descartado'
  if (droppableId === 'convertido') return 'convertido'
  return null
}

const getLeadDisplayName = (lead: LeadRecord) => {
  const fullName = `${lead.lead_first_name ?? ''} ${lead.lead_last_name ?? ''}`.trim()
  if (fullName) return fullName
  if (lead.lead_email) return lead.lead_email
  if (lead.lead_phone) return lead.lead_phone
  return `Lead ${lead.id.slice(0, 6)}`
}

export const LeadsPage = () => {
  const { hasRole } = useAuth()
  const isAdmin = hasRole(ADMIN_ROLES)
  const {
    leadsByStatus,
    fetchLeads,
    updateLeadStatus,
    deleteLead,
    createLead,
    transferLeadOwner,
    isLoading,
    error,
  } = useLeadsKanban()
  const { companyId } = useCompany()
  const [searchTerm, setSearchTerm] = useState('')
  const [activePreset, setActivePreset] = useState<DateFilterPreset>('all')
  const [customRange, setCustomRange] = useState<{ start?: string | null; end?: string | null }>({})
  const [discardModalLead, setDiscardModalLead] = useState<(Partial<LeadRecord> & { id: string }) | null>(null)
  const [columnPages, setColumnPages] = useState<Record<LeadStatus, number>>(() => createInitialPages())
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [leadPendingDeletion, setLeadPendingDeletion] = useState<LeadRecord | null>(null)
  const [isDeletingLead, setIsDeletingLead] = useState(false)
  const [isCreateLeadModalOpen, setIsCreateLeadModalOpen] = useState(false)
  const [transferModalLead, setTransferModalLead] = useState<LeadRecord | null>(null)
  const [assignableSellers, setAssignableSellers] = useState<TeamMember[]>([])
  const [selectedTransferSeller, setSelectedTransferSeller] = useState('')
  const [isTransferLoading, setIsTransferLoading] = useState(false)
  const [isLoadingSellers, setIsLoadingSellers] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [leadOwnersMap, setLeadOwnersMap] = useState<Record<string, string>>({})
  const [sellerFilterOptions, setSellerFilterOptions] = useState<{ value: string; label: string }[]>([])
  const [selectedSellerFilter, setSelectedSellerFilter] = useState('')

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

  const openDiscardModal = useCallback((lead: LeadRecord) => {
    setDiscardModalLead(lead)
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          LEAD_DISCARD_STORAGE_KEY,
          JSON.stringify({ id: lead.id, snapshot: lead }),
        )
      }
    } catch (error) {
      console.warn('Failed to persist discard modal state', error)
    }
  }, [])

  const activeOwnerFilter = isAdmin ? selectedSellerFilter || null : undefined

  useEffect(() => {
    void fetchLeads({ ownerId: activeOwnerFilter })
  }, [activeOwnerFilter, fetchLeads])

  const handlePresetChange = (value: DateFilterPreset) => {
    setActivePreset(value)

    if (value === 'custom') {
      return
    }

    setColumnPages(createInitialPages())
    setCustomRange({})
    const range = getDateRangeForPreset(value)
    void fetchLeads({ searchTerm, startDate: range.start ?? undefined, endDate: range.end ?? undefined, ownerId: activeOwnerFilter })
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      const range =
        activePreset === 'custom'
          ? {
              start: customRange.start ? new Date(customRange.start).toISOString() : undefined,
              end: customRange.end ? new Date(customRange.end).toISOString() : undefined,
            }
          : getDateRangeForPreset(activePreset)

      setColumnPages(createInitialPages())
      void fetchLeads({ searchTerm, startDate: range.start ?? undefined, endDate: range.end ?? undefined, ownerId: activeOwnerFilter })
    }, 300)

    return () => clearTimeout(handler)
  }, [searchTerm, activePreset, customRange.start, customRange.end, fetchLeads, activeOwnerFilter])

  useEffect(() => {
    setColumnPages((previous) => {
      let hasChanges = false
      const nextState = { ...previous }

      for (const status of COLUMNS) {
        const totalLeads = leadsByStatus[status]?.length ?? 0
        const pageCount = Math.max(1, Math.ceil(totalLeads / KANBAN_PAGE_SIZE))
        const currentPage = previous[status] ?? 1
        const normalizedPage = Math.min(currentPage, pageCount)

        if (normalizedPage !== currentPage) {
          nextState[status] = normalizedPage
          hasChanges = true
        }
      }

      return hasChanges ? nextState : previous
    })
  }, [leadsByStatus])

  const paginatedColumns = useMemo(() => {
    return COLUMNS.reduce<Record<LeadStatus, { total: number; pageCount: number; currentPage: number; leads: LeadRecord[] }>>(
      (acc, status) => {
        const allLeads = leadsByStatus[status] ?? []
        const total = allLeads.length
        const pageCount = Math.max(1, Math.ceil(total / KANBAN_PAGE_SIZE))
        const requestedPage = columnPages[status] ?? 1
        const currentPage = Math.min(requestedPage, pageCount)
        const start = (currentPage - 1) * KANBAN_PAGE_SIZE
        const end = start + KANBAN_PAGE_SIZE

        acc[status] = {
          total,
          pageCount,
          currentPage,
          leads: allLeads.slice(start, end),
        }

        return acc
      },
      {} as Record<LeadStatus, { total: number; pageCount: number; currentPage: number; leads: LeadRecord[] }>,
    )
  }, [columnPages, leadsByStatus])

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

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return

    if (destination.droppableId === source.droppableId) return

    const targetStatus = statusFromDroppable(destination.droppableId)
    const currentStatus = statusFromDroppable(source.droppableId)

    if (!targetStatus || !currentStatus) return

    const lead = COLUMNS.flatMap((status) => leadsByStatus[status]).find((item) => item.id === draggableId)

    if (!lead) return

    if (targetStatus === 'convertido') {
      try {
        await updateLeadStatus(draggableId, targetStatus)
      } catch (error) {
        console.error(error)
      }
      return
    }

    if (targetStatus === 'descartado') {
      openDiscardModal(lead)
      return
    }

    try {
      await updateLeadStatus(draggableId, targetStatus)
    } catch (error) {
      console.error(error)
      alert((error as Error).message)
    }
  }

  const handleLeadContextMenu = useCallback(
    (lead: LeadRecord, position: { x: number; y: number }) => {
      setContextMenu({ lead, position: clampPosition(position), isSelecting: false })
    },
    [clampPosition],
  )

  const handleOpenTransferModal = useCallback(
    (lead: LeadRecord) => {
      if (!isAdmin) return
      setContextMenu(null)
      setTransferError(null)
      setTransferModalLead(lead)
      setSelectedTransferSeller(lead.vendedor_responsavel ?? '')
    },
    [isAdmin],
  )

  const availableStatuses = useMemo(() => {
    if (!contextMenu) return []
    return COLUMNS.filter((status) => status !== contextMenu.lead.lead_status)
  }, [contextMenu])

  useEffect(() => {
    if (!transferModalLead?.company_id) {
      setAssignableSellers([])
      return
    }

    let isMounted = true
    setIsLoadingSellers(true)
    setTransferError(null)

    heartSupabase
      .from('crm_user_profiles')
      .select('id, user_id, user_name, user_email, role, status')
      .eq('company_id', transferModalLead.company_id)
      .eq('role', 'vendedor')
      .not('status', 'eq', 'removed')
      .order('user_name', { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (!isMounted) return
        if (error) {
          console.error('Failed to load assignable sellers', error)
          setAssignableSellers([])
          setTransferError('Não foi possível carregar os vendedores disponíveis.')
          return
        }
        setAssignableSellers(data ?? [])
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSellers(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [transferModalLead])

  useEffect(() => {
    if (!isAdmin || !companyId) {
      setLeadOwnersMap({})
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
          console.error('Failed to load lead owners map', error)
          setLeadOwnersMap({})
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

        setLeadOwnersMap(map)
        setSellerFilterOptions(options)
      })

    return () => {
      isMounted = false
    }
  }, [companyId, isAdmin])

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

  const handleContextMenuMove = useCallback(
    async (status: LeadStatus) => {
      if (!contextMenu) return

      const lead = contextMenu.lead
      setContextMenu(null)

      if (status === lead.lead_status) return

      if (status === 'descartado') {
        openDiscardModal(lead)
        return
      }

      try {
        await updateLeadStatus(lead.id, status)
      } catch (error) {
        console.error(error)
        alert((error as Error).message)
      }
    },
    [contextMenu, openDiscardModal, updateLeadStatus],
  )

  const closeTransferModal = useCallback(() => {
    if (isTransferLoading) return
    setTransferModalLead(null)
    setAssignableSellers([])
    setSelectedTransferSeller('')
    setTransferError(null)
  }, [isTransferLoading])

  useEffect(() => {
    if (!transferModalLead) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTransferModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeTransferModal, transferModalLead])

  const handleTransferLeadOwner = useCallback(async () => {
    if (!transferModalLead) return

    if (!selectedTransferSeller) {
      setTransferError('Selecione um vendedor para receber o lead.')
      return
    }

    if (selectedTransferSeller === transferModalLead.vendedor_responsavel) {
      setTransferError('Selecione um vendedor diferente do atual.')
      return
    }

    setIsTransferLoading(true)
    setTransferError(null)

    try {
      await transferLeadOwner(
        transferModalLead.id,
        transferModalLead.company_id ?? null,
        selectedTransferSeller,
      )
      closeTransferModal()
    } catch (error) {
      console.error(error)
      setTransferError(
        error instanceof Error ? error.message : 'Não foi possível transferir o responsável do lead.',
      )
    } finally {
      setIsTransferLoading(false)
    }
  }, [closeTransferModal, selectedTransferSeller, transferLeadOwner, transferModalLead])

  const requestLeadDeletion = useCallback(
    (lead: LeadRecord) => {
      if (!isAdmin) return
      setContextMenu(null)
      setLeadPendingDeletion(lead)
    },
    [isAdmin],
  )

  const leadPendingDeletionName = useMemo(
    () => (leadPendingDeletion ? getLeadDisplayName(leadPendingDeletion) : ''),
    [leadPendingDeletion],
  )

  const transferLeadName = useMemo(
    () => (transferModalLead ? getLeadDisplayName(transferModalLead) : ''),
    [transferModalLead],
  )

  const renderLeadOwnerLabel = useCallback(
    (lead: LeadRecord) => {
      if (!isAdmin) return null
      if (!lead.vendedor_responsavel) return null
      return leadOwnersMap[lead.vendedor_responsavel] ?? null
    },
    [isAdmin, leadOwnersMap],
  )

  const handleCancelDeleteLead = useCallback(() => {
    if (isDeletingLead) return
    setLeadPendingDeletion(null)
  }, [isDeletingLead])

  const handleConfirmDeleteLead = useCallback(async () => {
    if (!leadPendingDeletion) return
    if (!isAdmin) return

    setIsDeletingLead(true)
    try {
      await deleteLead(leadPendingDeletion.id)
      setLeadPendingDeletion(null)
    } catch (error) {
      console.error(error)
      alert((error as Error).message)
    } finally {
      setIsDeletingLead(false)
    }
  }, [deleteLead, isAdmin, leadPendingDeletion])

  const confirmDiscard = async (reason: DiscardReason | 'custom', custom?: string) => {
    if (!discardModalLead) return

    try {
      await updateLeadStatus(discardModalLead.id, 'descartado', reason === 'custom' ? custom : reason)
    } catch (error) {
      console.error(error)
      alert((error as Error).message)
    } finally {
      setDiscardModalLead(null)
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(LEAD_DISCARD_STORAGE_KEY)
          sessionStorage.removeItem(`${LEAD_DISCARD_DRAFT_PREFIX}:${discardModalLead.id}`)
        }
      } catch (error) {
        console.warn('Failed to clear discard modal persisted state', error)
      }
    }
  }

  useEffect(() => {
    try {
      if (!discardModalLead || typeof window === 'undefined') return
      sessionStorage.setItem(
        LEAD_DISCARD_STORAGE_KEY,
        JSON.stringify({ id: discardModalLead.id, snapshot: discardModalLead }),
      )
    } catch (error) {
      console.warn('Failed to persist discard modal snapshot', error)
    }
  }, [discardModalLead])

  useEffect(() => {
    if (isLoading) return
    if (discardModalLead) return

    try {
      if (typeof window === 'undefined') return
      const persisted = sessionStorage.getItem(LEAD_DISCARD_STORAGE_KEY)
      if (!persisted) return

      const parsed = JSON.parse(persisted) as { id?: string | null; snapshot?: Partial<LeadRecord> }
      if (!parsed?.id) {
        sessionStorage.removeItem(LEAD_DISCARD_STORAGE_KEY)
        return
      }

      const allLeads = COLUMNS.flatMap((status) => leadsByStatus[status])
      const existingLead = allLeads.find((lead) => lead.id === parsed.id)

      if (existingLead) {
        setDiscardModalLead(existingLead)
      } else if (parsed.snapshot) {
        setDiscardModalLead({ ...parsed.snapshot, id: parsed.id })
      }
    } catch (error) {
      console.warn('Failed to restore discard modal state', error)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(LEAD_DISCARD_STORAGE_KEY)
      }
    }
  }, [leadsByStatus, isLoading, discardModalLead])

  const highlightedTerm = useMemo(() => searchTerm.trim(), [searchTerm])

  const handleCreateLeadSubmit = useCallback(
    async (payload: { firstName: string; lastName?: string; email?: string; phone?: string }) => {
      await createLead(payload)
      setIsCreateLeadModalOpen(false)
    },
    [createLead],
  )

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Gestão de Leads</h1>
            <p className={styles.subtitle}>
              Organize seus leads por etapa do funil e acompanhe o progresso em tempo real.
            </p>
          </div>
          <button className={styles.createButton} type="button" onClick={() => setIsCreateLeadModalOpen(true)}>
            Novo lead
          </button>
        </div>
      </header>

      <LeadFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activePreset={activePreset}
        onPresetChange={handlePresetChange}
        customRange={customRange}
        onCustomRangeChange={(key, value) => {
          setActivePreset('custom')
          setCustomRange((prev) => ({ ...prev, [key]: value || null }))
        }}
        ownerOptions={isAdmin ? sellerFilterOptions : undefined}
        ownerValue={selectedSellerFilter}
        onOwnerChange={isAdmin ? setSelectedSellerFilter : undefined}
      />

      {error ? <p className={styles.error}>{error}</p> : null}
      {isLoading ? <p className={styles.loading}>Carregando leads...</p> : null}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className={styles.kanban}>
          {COLUMNS.map((columnKey) => (
            <LeadsColumn
              key={columnKey}
              droppableId={columnKey}
              title={LEAD_STATUS_LABELS[columnKey]}
              leads={paginatedColumns[columnKey]?.leads ?? []}
              totalLeads={paginatedColumns[columnKey]?.total ?? 0}
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
              onLeadContextMenu={handleLeadContextMenu}
              highlight={highlightedTerm}
              renderOwnerLabel={renderLeadOwnerLabel}
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
                  requestLeadDeletion(contextMenu.lead)
                }}
              >
                Excluir
              </button>
            ) : null}
            {isAdmin ? (
              <button
                type="button"
                className={styles.contextMenuAction}
                onClick={() => {
                  if (!contextMenu) return
                  handleOpenTransferModal(contextMenu.lead)
                }}
              >
                Transferir responsável
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
                    {LEAD_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isAdmin && leadPendingDeletion ? (
        <div
          className={styles.confirmOverlay}
          role="dialog"
          aria-modal="true"
          onClick={handleCancelDeleteLead}
        >
          <div
            className={styles.confirmContent}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className={styles.confirmTitle}>Excluir lead</h2>
            <p className={styles.confirmMessage}>
              Tem certeza que deseja excluir o lead{' '}
              <span className={styles.confirmHighlight}>
                {leadPendingDeletionName || 'selecionado'}
              </span>
              ?
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancelButton}
                onClick={handleCancelDeleteLead}
                disabled={isDeletingLead}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                onClick={() => void handleConfirmDeleteLead()}
                disabled={isDeletingLead}
              >
                {isDeletingLead ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAdmin && transferModalLead ? (
        <div
          className={styles.confirmOverlay}
          role="dialog"
          aria-modal="true"
          onClick={closeTransferModal}
        >
          <div
            className={styles.confirmContent}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className={styles.confirmTitle}>Transferir responsável</h2>
            <p className={styles.transferDescription}>
              Escolha o novo responsável pelo lead{' '}
              <span className={styles.transferLeadHighlight}>{transferLeadName || 'selecionado'}</span>.
            </p>

            {isLoadingSellers ? (
              <p className={styles.transferHint}>Carregando vendedores disponíveis...</p>
            ) : null}

            {!isLoadingSellers && assignableSellers.length === 0 ? (
              <p className={styles.transferHint}>Nenhum vendedor disponível para a transferência.</p>
            ) : null}

            {assignableSellers.length > 0 ? (
              <label className={styles.transferField}>
                <span>Novo vendedor responsável</span>
                <select
                  className={styles.transferSelect}
                  value={selectedTransferSeller}
                  onChange={(event) => setSelectedTransferSeller(event.target.value)}
                  disabled={isTransferLoading}
                >
                  <option value="">Selecione um vendedor</option>
                  {assignableSellers.map((member) => (
                    <option
                      key={member.id}
                      value={member.user_id ?? member.id}
                      disabled={!member.user_id}
                    >
                      {member.user_name ?? member.user_email} — {member.user_email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {transferError ? <p className={styles.transferError}>{transferError}</p> : null}

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancelButton}
                onClick={closeTransferModal}
                disabled={isTransferLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.transferConfirmButton}
                onClick={() => void handleTransferLeadOwner()}
                disabled={
                  isTransferLoading || isLoadingSellers || assignableSellers.length === 0
                }
              >
                {isTransferLoading ? 'Transferindo…' : 'Transferir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DiscardModal
        lead={discardModalLead}
        isOpen={Boolean(discardModalLead)}
        onClose={() => {
          setDiscardModalLead(null)
          try {
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem(LEAD_DISCARD_STORAGE_KEY)
              if (discardModalLead) {
                sessionStorage.removeItem(`${LEAD_DISCARD_DRAFT_PREFIX}:${discardModalLead.id}`)
              }
            }
          } catch (error) {
            console.warn('Failed to clear discard modal state on close', error)
          }
        }}
        onConfirm={confirmDiscard}
      />

      <CreateLeadModal
        open={isCreateLeadModalOpen}
        onClose={() => setIsCreateLeadModalOpen(false)}
        onSubmit={handleCreateLeadSubmit}
      />
    </section>
  )
}
