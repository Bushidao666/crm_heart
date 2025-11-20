import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { ServiceFormModal } from '@/features/services/components/service-form-modal'
import { ServicesTable } from '@/features/services/components/services-table'
import { useServicesAdmin } from '@/features/services/hooks/use-services-admin'
import type { ServiceRecord } from '@/features/services/types'
import { SERVICE_MODAL_STATE_KEY, SERVICE_MODAL_DRAFT_PREFIX } from '@/features/services/constants'
import { ADMIN_ROLES } from '@/features/auth/constants'

import styles from './services-page.module.css'

export const ServicesPage = () => {
  const { hasRole } = useAuth()
  const { services, templates, isLoading, error, createOrUpdateService, deleteService } = useServicesAdmin()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<(Partial<ServiceRecord> & { id?: string }) | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const isAdmin = hasRole(ADMIN_ROLES)

  const handleCreate = () => {
    setEditingService(null)
    setIsModalOpen(true)
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          SERVICE_MODAL_STATE_KEY,
          JSON.stringify({ mode: 'create' }),
        )
      }
    } catch (error) {
      console.warn('Failed to persist service modal state', error)
    }
  }

  const handleEdit = (service: ServiceRecord) => {
    setEditingService(service)
    setIsModalOpen(true)
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          SERVICE_MODAL_STATE_KEY,
          JSON.stringify({ mode: 'edit', id: service.id, snapshot: service }),
        )
      }
    } catch (error) {
      console.warn('Failed to persist service modal state', error)
    }
  }

  const handleDelete = async (service: ServiceRecord) => {
    const confirmation = window.confirm(`Deseja realmente excluir o serviço "${service.nome}"?`)
    if (!confirmation) return

    try {
      await deleteService(service.id)
      setActionError(null)
    } catch (error) {
      setActionError((error as Error).message)
    }
  }

  const handleSubmit = async (payload: Partial<ServiceRecord> & { id?: string }) => {
    await createOrUpdateService(payload)
    setActionError(null)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingService(null)
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SERVICE_MODAL_STATE_KEY)
        sessionStorage.removeItem(`${SERVICE_MODAL_DRAFT_PREFIX}:new`)
        if (editingService?.id) {
          sessionStorage.removeItem(`${SERVICE_MODAL_DRAFT_PREFIX}:${editingService.id}`)
        }
      }
    } catch (error) {
      console.warn('Failed to clear service modal persisted state', error)
    }
  }

  const draftStorageKey = useMemo(() => {
    if (!isAdmin) return null
    if (typeof window === 'undefined') return null
    if (!editingService) return `${SERVICE_MODAL_DRAFT_PREFIX}:new`
    return editingService.id ? `${SERVICE_MODAL_DRAFT_PREFIX}:${editingService.id}` : `${SERVICE_MODAL_DRAFT_PREFIX}:new`
  }, [editingService, isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    if (!isModalOpen) return
    if (!draftStorageKey) return

    try {
      const stored = sessionStorage.getItem(draftStorageKey)
      if (!stored) return

      const parsed = JSON.parse(stored) as Partial<ServiceRecord>

      if (Object.keys(parsed).length > 0) {
        setEditingService((prev) => ({ ...(prev ?? {}), ...parsed }))
      }
    } catch (error) {
      console.warn('Failed to restore service modal draft', error)
      sessionStorage.removeItem(draftStorageKey)
    }
  }, [isModalOpen, draftStorageKey, isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    if (!isModalOpen || !draftStorageKey) return

    try {
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify(editingService ?? {}),
      )
    } catch (error) {
      console.warn('Failed to persist service modal draft', error)
    }
  }, [isModalOpen, editingService, draftStorageKey, isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    if (!isModalOpen || !draftStorageKey) return

    return () => {
      try {
        sessionStorage.setItem(
          draftStorageKey,
          JSON.stringify(editingService ?? {}),
        )
      } catch (error) {
        console.warn('Failed to persist service modal draft', error)
      }
    }
  }, [isModalOpen, draftStorageKey, editingService, isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    if (isModalOpen) return

    try {
      if (typeof window === 'undefined') return
      const persisted = sessionStorage.getItem(SERVICE_MODAL_STATE_KEY)
      if (!persisted) return

      const parsed = JSON.parse(persisted) as { mode?: 'create' | 'edit'; id?: string; snapshot?: ServiceRecord }

      if (parsed.mode === 'create') {
        setEditingService(null)
        setIsModalOpen(true)
        return
      }

      if (parsed.mode === 'edit' && parsed.id) {
        const existingService = services.find((service) => service.id === parsed.id)

        if (existingService) {
          setEditingService(existingService)
          setIsModalOpen(true)
          return
        }

        if (parsed.snapshot) {
          setEditingService({ ...parsed.snapshot })
          setIsModalOpen(true)
          return
        }
      }

      sessionStorage.removeItem(SERVICE_MODAL_STATE_KEY)
    } catch (error) {
      console.warn('Failed to restore service modal state', error)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SERVICE_MODAL_STATE_KEY)
      }
    }
  }, [services, isModalOpen, isAdmin])

  if (!isAdmin) {
    return (
      <section className={styles.section}>
        <p className={styles.error}>Acesso restrito. Esta área é exclusiva para administradores.</p>
      </section>
    )
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Serviços</h1>
          <p className={styles.subtitle}>Cadastre os serviços oferecidos e vincule templates de contrato para agilizar o processo.</p>
        </div>

        <button type="button" className={styles.primaryButton} onClick={handleCreate}>
          Novo serviço
        </button>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}
      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      <ServicesTable
        services={services}
        templates={templates}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
      />

      <ServiceFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        templates={templates}
        initialData={editingService}
      />
    </section>
  )
}
