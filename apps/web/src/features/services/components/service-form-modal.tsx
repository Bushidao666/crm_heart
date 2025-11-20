import { useEffect, useMemo, useState } from 'react'

import type { ContractTemplateRecord, ServiceRecord } from '@/features/services/types'
import { formatCurrency, parseCurrency } from '@/features/deals/utils/format'

import styles from './service-form-modal.module.css'

type ServiceFormModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: Partial<ServiceRecord> & { id?: string }) => Promise<void>
  templates: ContractTemplateRecord[]
  initialData?: (Partial<ServiceRecord> & { id?: string }) | null
}

const DEFAULT_PAYMENT_METHODS = ['Pix', 'Cartão', 'Boleto']

export const ServiceFormModal = ({ open, onClose, onSubmit, templates, initialData }: ServiceFormModalProps) => {
  const [form, setForm] = useState<Partial<ServiceRecord>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setForm({})
      setError(null)
      return
    }

    if (initialData) {
      setForm((prev) => ({ max_parcelas: 1, formas_pagamento: DEFAULT_PAYMENT_METHODS, ...initialData, ...prev }))
    } else {
      setForm({ max_parcelas: 1, formas_pagamento: DEFAULT_PAYMENT_METHODS })
    }
  }, [open, initialData])

  const paymentMethodsText = useMemo(() => {
    return (form.formas_pagamento ?? DEFAULT_PAYMENT_METHODS).join(', ')
  }, [form.formas_pagamento])

  if (!open) return null

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.nome || form.nome.trim() === '') {
      setError('Informe o nome do serviço.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSubmit({
        id: initialData?.id,
        nome: form.nome.trim(),
        descricao: form.descricao ?? null,
        valor_padrao: parseCurrency(form.valor_padrao ?? 0),
        max_parcelas: form.max_parcelas ?? 1,
        formas_pagamento: form.formas_pagamento ?? DEFAULT_PAYMENT_METHODS,
        contrato_template_id: form.contrato_template_id ?? null,
      })
      onClose()
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>{initialData ? 'Editar serviço' : 'Novo serviço'}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            Fechar
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Nome</span>
            <input
              value={form.nome ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Descrição</span>
            <textarea
              rows={3}
              value={form.descricao ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
            />
          </label>

          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Valor padrão</span>
              <input
                value={formatCurrency(parseCurrency(form.valor_padrao ?? 0))}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, valor_padrao: parseCurrency(event.target.value) }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>Parcelas máximas</span>
              <input
                type="number"
                min={1}
                value={form.max_parcelas ?? 1}
                onChange={(event) => setForm((prev) => ({ ...prev, max_parcelas: Number(event.target.value) }))}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Formas de pagamento</span>
            <input
              value={paymentMethodsText}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, formas_pagamento: event.target.value.split(',').map((i) => i.trim()) }))
              }
              placeholder="Pix, Cartão, Boleto"
            />
            <span className={styles.helper}>Separe as opções por vírgula.</span>
          </label>

          <label className={styles.field}>
            <span>Template de contrato</span>
            <select
              value={form.contrato_template_id ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, contrato_template_id: event.target.value || null }))}
            >
              <option value="">Nenhum</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.nome}
                </option>
              ))}
            </select>
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}

          <footer className={styles.footer}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.primaryButton} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
