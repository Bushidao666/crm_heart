import { useEffect, useState } from 'react'

import styles from './contract-tracking-filters.module.css'

import type { ContractStatusFilter } from '@/features/contracts/hooks/use-contracts-tracking'

const STATUS_OPTIONS: { label: string; value: ContractStatusFilter }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Contrato enviado', value: 'contrato_enviado' },
  { label: 'Contrato assinado', value: 'contrato_assinado' },
  { label: 'Contrato rejeitado', value: 'contrato_rejeitado' },
]

type ContractTrackingFiltersProps = {
  status: ContractStatusFilter
  onStatusChange: (status: ContractStatusFilter) => void
  startDate: string | null
  endDate: string | null
  onDateChange: (key: 'start' | 'end', value: string | null) => void
  search: string
  onSearchChange: (value: string) => void
}

export const ContractTrackingFilters = ({
  status,
  onStatusChange,
  startDate,
  endDate,
  onDateChange,
  search,
  onSearchChange,
}: ContractTrackingFiltersProps) => {
  const [localSearch, setLocalSearch] = useState(search)

  useEffect(() => {
    setLocalSearch((previous) => (previous === search ? previous : search))
  }, [search])

  useEffect(() => {
    const handler = setTimeout(() => onSearchChange(localSearch), 300)
    return () => clearTimeout(handler)
  }, [localSearch, onSearchChange])

  return (
    <div className={styles.filters}>
      <div className={styles.filterGroup}>
        <label className={styles.label}>Status</label>
        <select value={status} onChange={(event) => onStatusChange(event.target.value as ContractStatusFilter)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.filterGroup}>
        <label className={styles.label}>Período inicial</label>
        <input
          type="date"
          value={startDate ?? ''}
          onChange={(event) => onDateChange('start', event.target.value || null)}
        />
      </div>

      <div className={styles.filterGroup}>
        <label className={styles.label}>Período final</label>
        <input
          type="date"
          value={endDate ?? ''}
          onChange={(event) => onDateChange('end', event.target.value || null)}
        />
      </div>

      <div className={styles.filterGroup}>
        <label className={styles.label}>Buscar</label>
        <input
          type="search"
          placeholder="Contrato ou cliente"
          value={localSearch}
          onChange={(event) => setLocalSearch(event.target.value)}
        />
      </div>
    </div>
  )
}
