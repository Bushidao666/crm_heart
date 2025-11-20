import { useCallback, useState } from 'react'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { ContractTrackingFilters } from '@/features/contracts/components/contract-tracking-filters'
import { ContractTrackingTable } from '@/features/contracts/components/contract-tracking-table'
import { useContractsTracking } from '@/features/contracts/hooks/use-contracts-tracking'
import type { ContractStatusFilter, ContractRecord } from '@/features/contracts/hooks/use-contracts-tracking'
import { supabase } from '@/lib/supabase-client'
import { ADMIN_ROLES } from '@/features/auth/constants'

import styles from './contracts-tracking-page.module.css'

const sanitizeForFilename = (value: string | null | undefined): string => {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[^\p{Letter}\p{Number}\s-]+/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

const buildDownloadFileName = (contract: ContractRecord): string => {
  const base =
    contract.contrato_nome ??
    contract.deal_name ??
    contract.document_id_autentique ??
    `contrato-${contract.id.slice(0, 6)}`

  const sanitized = sanitizeForFilename(base)
  return `${sanitized || 'contrato-assinado'}.pdf`
}

const downloadDataUrl = (dataUrl: string, filename: string): boolean => {
  if (typeof window === 'undefined') return false
  if (!dataUrl.startsWith('data:')) return false

  try {
    const matches = dataUrl.match(/^data:(.+);base64,(.*)$/)
    if (!matches) return false

    const [, mimeType, base64Data] = matches
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index)
    }

    const blob = new Blob([bytes], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    return true
  } catch (error) {
    console.error('Failed to download contract from embedded copy', error)
    return false
  }
}

export const ContractsTrackingPage = () => {
  const { user, hasRole } = useAuth()
  const isAdmin = hasRole(ADMIN_ROLES)
  const { contracts, isLoading, error, fetchContracts } = useContractsTracking(user?.id ?? null, isAdmin)

  const [status, setStatus] = useState<ContractStatusFilter>('todos')
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const runFetch = useCallback(
    (nextStatus: ContractStatusFilter, nextStart: string | null, nextEnd: string | null, nextSearch: string) => {
      void fetchContracts({
        status: nextStatus,
        startDate: nextStart ? new Date(nextStart).toISOString() : null,
        endDate: nextEnd ? new Date(nextEnd).toISOString() : null,
        search: nextSearch,
      })
    },
    [fetchContracts],
  )

  const handleStatusChange = useCallback(
    (value: ContractStatusFilter) => {
      setStatus(value)
      runFetch(value, startDate, endDate, search)
    },
    [endDate, runFetch, search, startDate],
  )

  const handleDateChange = useCallback(
    (key: 'start' | 'end', value: string | null) => {
      if (key === 'start') {
        setStartDate(value)
        runFetch(status, value, endDate, search)
      } else {
        setEndDate(value)
        runFetch(status, startDate, value, search)
      }
    },
    [endDate, runFetch, search, startDate, status],
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value)
      runFetch(status, startDate, endDate, value)
    },
    [endDate, runFetch, startDate, status],
  )

  const resolveStoragePath = useCallback(async (contract: ContractRecord): Promise<string | null> => {
    if (contract.contrato_copia_path) {
      return contract.contrato_copia_path
    }

    const directories = new Set<string>()
    const dealSlug = sanitizeForFilename(contract.deal_name)
    if (dealSlug) {
      directories.add(`signed/${dealSlug}`)
    }
    if (contract.document_id_autentique) {
      directories.add(`signed/${contract.document_id_autentique}`)
    }
    directories.add(`signed/${contract.id}`)

    const storageClient = supabase.storage.from('contratos_assinados')

    for (const directory of directories) {
      const { data, error } = await storageClient.list(directory, {
        limit: 50,
        sortBy: { column: 'created_at', order: 'desc' },
      })

      if (error) {
        if (!/not\s+found/i.test(error.message ?? '')) {
          console.warn('Failed to list contracts in storage', directory, error.message)
        }
        continue
      }

      if (!data || data.length === 0) {
        continue
      }

      const fileEntry =
        data.find((item) => Boolean(item?.metadata) && item.name?.toLowerCase().endsWith('.pdf')) ??
        data.find((item) => Boolean(item?.metadata) && item.name)

      if (fileEntry?.name) {
        return `${directory}/${fileEntry.name}`
      }
    }

    return null
  }, [])

  const handleDownload = useCallback(
    async (contract: ContractRecord) => {
      const filename = buildDownloadFileName(contract)
      let storagePath: string | null = null

      try {
        storagePath = await resolveStoragePath(contract)
      } catch (error) {
        console.error('Failed to resolve storage path for contract', contract.id, error)
      }

      if (storagePath) {
        const { data, error } = await supabase.storage
          .from('contratos_assinados')
          .createSignedUrl(storagePath, 60, { download: filename })

        if (!error && data?.signedUrl) {
          window.open(data.signedUrl, '_blank', 'noopener')
          return
        }

        console.error('Failed to create signed URL for contract download', storagePath, error?.message)
      }

      if (contract.contrato_copia && downloadDataUrl(contract.contrato_copia, filename)) {
        return
      }

      alert('Não foi possível localizar o arquivo do contrato selecionado para download.')
    },
    [resolveStoragePath],
  )

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Contratos</h1>
          <p className={styles.subtitle}>Acompanhe o status dos contratos enviados para assinatura digital.</p>
        </div>
      </header>

      <ContractTrackingFilters
        status={status}
        onStatusChange={handleStatusChange}
        startDate={startDate}
        endDate={endDate}
        onDateChange={handleDateChange}
        search={search}
        onSearchChange={handleSearchChange}
      />

      {error ? <p className={styles.error}>{error}</p> : null}

      <ContractTrackingTable contracts={contracts} isLoading={isLoading} onDownload={handleDownload} />
    </section>
  )
}
