import { useMemo } from 'react'

import styles from './lead-filters.module.css'

import type { DatePreset } from '@/features/leads/utils/date-presets'

type DateFilterPreset = DatePreset | 'custom'

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'Hoje', value: 'today' },
  { label: 'Esta semana', value: 'week' },
  { label: 'Este mês', value: 'month' },
  { label: 'Todo período', value: 'all' },
]

type LeadFiltersProps = {
  searchTerm: string
  onSearchChange: (term: string) => void
  activePreset: DateFilterPreset
  onPresetChange: (value: DateFilterPreset) => void
  customRange: { start?: string | null; end?: string | null }
  onCustomRangeChange: (key: 'start' | 'end', value: string) => void
  ownerOptions?: { value: string; label: string }[]
  ownerValue?: string
  onOwnerChange?: (value: string) => void
}

export const LeadFilters = ({
  searchTerm,
  onSearchChange,
  activePreset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
  ownerOptions,
  ownerValue = '',
  onOwnerChange,
}: LeadFiltersProps) => {
  const showCustomDates = useMemo(() => activePreset === 'custom', [activePreset])

  return (
    <div className={styles.filters}>
      <div className={styles.searchWrapper}>
        <label className={styles.label} htmlFor="lead-search">
          Buscar leads
        </label>
        <input
          id="lead-search"
          type="search"
          placeholder="Nome, email ou telefone"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.presets}>
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={[
              styles.presetButton,
              activePreset === preset.value ? styles.presetButtonActive : '',
            ].join(' ')}
            onClick={() => onPresetChange(preset.value)}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className={[styles.presetButton, showCustomDates ? styles.presetButtonActive : ''].join(' ')}
          onClick={() => onPresetChange('custom')}
        >
          Personalizado
        </button>
      </div>

      {ownerOptions && onOwnerChange ? (
        <div className={styles.ownerFilter}>
          <label className={styles.label} htmlFor="lead-owner">
            Vendedor responsável
          </label>
          <select
            id="lead-owner"
            className={styles.select}
            value={ownerValue}
            onChange={(event) => onOwnerChange(event.target.value)}
          >
            <option value="">Todos</option>
            {ownerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showCustomDates ? (
        <div className={styles.customDates}>
          <label className={styles.label}>
            Início
            <input
              type="date"
              className={styles.dateInput}
              value={customRange.start ?? ''}
              onChange={(event) => onCustomRangeChange('start', event.target.value)}
            />
          </label>
          <label className={styles.label}>
            Fim
            <input
              type="date"
              className={styles.dateInput}
              value={customRange.end ?? ''}
              onChange={(event) => onCustomRangeChange('end', event.target.value)}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
