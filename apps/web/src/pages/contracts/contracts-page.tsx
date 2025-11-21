import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { ContractTemplateFormModal } from '@/features/contracts/components/contract-template-form-modal'
import { ContractTemplatesTable } from '@/features/contracts/components/contract-templates-table'
import { useContractTemplatesAdmin } from '@/features/contracts/hooks/use-contract-templates-admin'
import type { ContractTemplate, ContractTemplateVariable } from '@/features/contracts/types'
import { TEMPLATE_MODAL_DRAFT_PREFIX, TEMPLATE_MODAL_STATE_KEY } from '@/features/contracts/constants'
import { ADMIN_ROLES } from '@/features/auth/constants'

import styles from './contracts-page.module.css'

type TemplateWithVars = ContractTemplate & { variables: ContractTemplateVariable[] }

export const ContractsPage = () => {
  const { hasRole } = useAuth()
  const { templates, isLoading, error, saveTemplate, deleteTemplate, toggleTemplateStatus } = useContractTemplatesAdmin()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithVars | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const isAdmin = hasRole(ADMIN_ROLES)

  const handleCreate = () => {
    setEditingTemplate(null)
    setIsModalOpen(true)

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          TEMPLATE_MODAL_STATE_KEY,
          JSON.stringify({ mode: 'create' }),
        )
      }
    } catch (error) {
      console.warn('Failed to persist contract template modal state', error)
    }
  }

  const handleEdit = (template: TemplateWithVars) => {
    setEditingTemplate(template)
    setIsModalOpen(true)

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          TEMPLATE_MODAL_STATE_KEY,
          JSON.stringify({ mode: 'edit', id: template.id, snapshot: template }),
        )
      }
    } catch (error) {
      console.warn('Failed to persist contract template modal state', error)
    }
  }

  const handleDelete = async (template: TemplateWithVars) => {
    const confirmation = window.confirm(`Deseja excluir o template "${template.nome}"?`)
    if (!confirmation) return

    try {
      await deleteTemplate(template.id)
      setActionError(null)
    } catch (error) {
      setActionError((error as Error).message)
    }
  }

  const handleToggleStatus = async (template: TemplateWithVars) => {
    const nextStatus = !template.ativo
    const confirmation = nextStatus
      ? window.confirm(`Deseja ativar o template "${template.nome}"?`)
      : window.confirm(`Deseja desativar o template "${template.nome}"?`)

    if (!confirmation) return

    try {
      await toggleTemplateStatus(template.id, nextStatus)
      setActionError(null)
    } catch (error) {
      setActionError((error as Error).message)
    }
  }

  const handleSubmit = async (payload: Parameters<typeof saveTemplate>[0]) => {
    try {
      await saveTemplate(payload)
      setActionError(null)
    } catch (error) {
      setActionError((error as Error).message)
      throw error
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    const currentTemplate = editingTemplate
    setEditingTemplate(null)

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(TEMPLATE_MODAL_STATE_KEY)
        sessionStorage.removeItem(`${TEMPLATE_MODAL_DRAFT_PREFIX}:new`)

        if (currentTemplate?.id) {
          sessionStorage.removeItem(`${TEMPLATE_MODAL_DRAFT_PREFIX}:${currentTemplate.id}`)
        }
      }
    } catch (error) {
      console.warn('Failed to clear contract template modal state', error)
    }
  }

  const draftStorageKey = useMemo(() => {
    if (!isAdmin) return null
    if (!isModalOpen) return null
    if (typeof window === 'undefined') return null
    if (!editingTemplate || !editingTemplate.id) {
      return `${TEMPLATE_MODAL_DRAFT_PREFIX}:new`
    }

    return `${TEMPLATE_MODAL_DRAFT_PREFIX}:${editingTemplate.id}`
  }, [isAdmin, isModalOpen, editingTemplate])

  useEffect(() => {
    if (!isAdmin) return
    if (isModalOpen) return

    try {
      if (typeof window === 'undefined') return
      const persisted = sessionStorage.getItem(TEMPLATE_MODAL_STATE_KEY)
      if (!persisted) return

      const parsed = JSON.parse(persisted) as {
        mode?: 'create' | 'edit'
        id?: string
        snapshot?: TemplateWithVars
      }

      if (parsed.mode === 'create') {
        setEditingTemplate(null)
        setIsModalOpen(true)
        return
      }

      if (parsed.mode === 'edit' && parsed.id) {
        const existing = templates.find((template) => template.id === parsed.id)

        if (existing) {
          setEditingTemplate(existing)
          setIsModalOpen(true)
          return
        }

        if (parsed.snapshot) {
          setEditingTemplate(parsed.snapshot)
          setIsModalOpen(true)
          return
        }
      }

      sessionStorage.removeItem(TEMPLATE_MODAL_STATE_KEY)
    } catch (error) {
      console.warn('Failed to restore contract template modal state', error)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(TEMPLATE_MODAL_STATE_KEY)
      }
    }
  }, [isAdmin, templates, isModalOpen])

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
          <h1 className={styles.title}>Templates de contrato</h1>
          <p className={styles.subtitle}>
            Cadastre modelos, defina variáveis dinâmicas e prepare o envio automático para o Autentique.
          </p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={handleCreate}>
          Novo template
        </button>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}
      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      <ContractTemplatesTable
        templates={templates}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
      />

      <ContractTemplateFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={editingTemplate}
        draftStorageKey={draftStorageKey}
      />
    </section>
  )
}
