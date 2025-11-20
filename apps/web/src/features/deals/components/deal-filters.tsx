import { useMemo } from 'react'

import styles from './deal-filters.module.css'

import type { DatePreset } from '@/features/leads/utils/date-presets'

type DateFilterPreset = DatePreset | 'custom'

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'Hoje', value: 'today' },
  { label: 'Esta semana', value: 'week' },
  { label: 'Este mês', value: 'month' },
  { label: 'Todo período', value: 'all' },
]

type DealFiltersProps = {
  searchTerm: string
  onSearchChange: (term: string) => void
  activePreset: DateFilterPreset
  onPresetChange: (value: DateFilterPreset) => void
  customRange: { start: string | null; end: string | null }
  onCustomRangeChange: (key: 'start' | 'end', value: string) => void
}

export const DealFilters = ({
  searchTerm,
  onSearchChange,
  activePreset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
}: DealFiltersProps) => {
  const showCustomDates = useMemo(() => activePreset === 'custom', [activePreset])

  return (
    <div className={styles.filters}>
      <div className={styles.searchWrapper}>
        <label className={styles.label} htmlFor="deal-search">
          Buscar negócios
        </label>
        <input
          id="deal-search"
          type="search"
          placeholder="Nome, email, CPF ou telefone"
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
