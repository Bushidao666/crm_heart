import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'

import { DISCARD_REASONS, type DiscardReason, type LeadRecord } from '@/features/leads/types'
import { LEAD_DISCARD_DRAFT_PREFIX } from '@/features/leads/constants'

import styles from './discard-modal.module.css'

type DiscardModalProps = {
  lead: (Partial<LeadRecord> & { id: string }) | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: DiscardReason | 'custom', customReason?: string) => void
}

export const DiscardModal = ({ lead, isOpen, onClose, onConfirm }: DiscardModalProps) => {
  const [selectedReason, setSelectedReason] = useState<DiscardReason | 'custom'>('Sem resposta do lead')
  const [customReason, setCustomReason] = useState('')

  const draftStorageKey = useMemo(() => {
    if (typeof window === 'undefined') return null
    if (!lead) return null
    return `${LEAD_DISCARD_DRAFT_PREFIX}:${lead.id}`
  }, [lead])

  useEffect(() => {
    if (!isOpen || !draftStorageKey) return

    try {
      const stored = sessionStorage.getItem(draftStorageKey)
      if (!stored) return

      const parsed = JSON.parse(stored) as {
        selectedReason?: DiscardReason | 'custom'
        customReason?: string
      }

      if (parsed.selectedReason) {
        setSelectedReason(parsed.selectedReason)
      }

      if (parsed.customReason) {
        setCustomReason(parsed.customReason)
      }
    } catch (error) {
      console.warn('Failed to restore discard modal draft', error)
      sessionStorage.removeItem(draftStorageKey)
    }
  }, [isOpen, draftStorageKey])

  useEffect(() => {
    if (!isOpen || !draftStorageKey) return

    try {
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({ selectedReason, customReason }),
      )
    } catch (error) {
      console.warn('Failed to persist discard modal draft', error)
    }
  }, [selectedReason, customReason, draftStorageKey, isOpen])

  useEffect(() => {
    if (!isOpen || !draftStorageKey) return

    return () => {
      try {
        sessionStorage.setItem(
          draftStorageKey,
          JSON.stringify({ selectedReason, customReason }),
        )
      } catch (error) {
        console.warn('Failed to persist discard modal draft', error)
      }
    }
  }, [draftStorageKey, isOpen, selectedReason, customReason])

  const clearDraft = () => {
    if (!draftStorageKey) return
    try {
      sessionStorage.removeItem(draftStorageKey)
    } catch (error) {
      console.warn('Failed to clear discard modal draft', error)
    }
  }

  if (!isOpen || !lead) return null

  const tooltips: Record<DiscardReason, string> = {
    'Sem resposta do lead': 'Após 2 tentativas em 24h, o lead não respondeu a mensagens/ligação.',
    'Número inválido': 'Telefone sem WhatsApp ou não pertence ao contato informado.',
    'Sem interesse': 'Serviço e preços apresentados; o lead declarou não querer prosseguir.',
    'Sem dinheiro': 'Preços informados; todas as tentativas de condição/negociação falharam.',
    'Lead duplicado': 'Contato já atendido recentemente (mesmo nome/telefone) no sistema.',
    'já possuí contrato conosco': 'Lead já tem contrato ativo/assinado com a empresa.',
  }

  const customTooltip = 'Use apenas se nenhum item acima se aplicar e descreva no campo obrigatório.'

  const handleTooltipInteraction = (event: MouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleTooltipKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (selectedReason === 'custom' && !customReason.trim()) {
      return
    }

    onConfirm(selectedReason, selectedReason === 'custom' ? customReason : undefined)
    setCustomReason('')
    clearDraft()
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>Descartar lead</h2>
          <p className={styles.subtitle}>
            Seleciona uma das justificativas abaixo para descartar <strong>{lead.lead_first_name}</strong>.
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.reasonList}>
            {DISCARD_REASONS.map((reason) => (
              <label key={reason} className={styles.reasonOption}>
                <input
                  type="radio"
                  name="discard-reason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={() => setSelectedReason(reason)}
                />
                <span className={styles.reasonContent}>
                  <span>{reason}</span>
                  <span
                    className={styles.tooltipIcon}
                    role="button"
                    tabIndex={0}
                    aria-label={tooltips[reason]}
                    data-tooltip={tooltips[reason]}
                    onClick={handleTooltipInteraction}
                    onMouseDown={handleTooltipInteraction}
                    onKeyDown={handleTooltipKeyDown}
                  >
                    ?
                  </span>
                </span>
              </label>
            ))}

            <label className={styles.reasonOption}>
              <input
                type="radio"
                name="discard-reason"
                value="custom"
                checked={selectedReason === 'custom'}
                onChange={() => setSelectedReason('custom')}
              />
              <span className={styles.reasonContent}>
                <span>Outro motivo</span>
                <span
                  className={styles.tooltipIcon}
                  role="button"
                  tabIndex={0}
                  aria-label={customTooltip}
                  data-tooltip={customTooltip}
                  onClick={handleTooltipInteraction}
                  onMouseDown={handleTooltipInteraction}
                  onKeyDown={handleTooltipKeyDown}
                >
                  ?
                </span>
              </span>
            </label>

            {selectedReason === 'custom' ? (
              <textarea
                className={styles.customReason}
                placeholder="Descreva o motivo"
                value={customReason}
                onChange={(event) => setCustomReason(event.target.value)}
                rows={4}
                required
              />
            ) : null}
          </div>

          <footer className={styles.footer}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                clearDraft()
                onClose()
              }}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.primaryButton}>
              Confirmar descarte
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
