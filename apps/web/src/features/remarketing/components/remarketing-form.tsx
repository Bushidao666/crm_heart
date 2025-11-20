import { useMemo, useState } from 'react'

import styles from './remarketing-form.module.css'

type AudienceType = 'lead' | 'deal' | 'manual'

type RemarketingFormValues = {
  audienceType: AudienceType
  leadStatuses: string[]
  dealStatuses: string[]
  startDate: string | null
  endDate: string | null
  manualTargets: string
  messageType: 'text' | 'audio' | 'image'
  messageBody: string
  scheduleAt: string | null
}

type RemarketingFormProps = {
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  isSubmitting: boolean
}

const LEAD_STATUSES = [
  { label: 'Leads novos', value: 'lead_novo' },
  { label: 'Em atendimento', value: 'em_atendimento' },
  { label: 'Descartados', value: 'descartado' },
]

const DEAL_STATUSES = [
  { label: 'Negócios novos', value: 'negocio_novo' },
  { label: 'Contrato enviado', value: 'contrato_enviado' },
  { label: 'Contrato assinado', value: 'contrato_assinado' },
  { label: 'Contrato rejeitado', value: 'contrato_rejeitado' },
]

const MESSAGE_TYPES = [
  { label: 'Mensagem de texto', value: 'text' },
  { label: 'Áudio', value: 'audio' },
  { label: 'Imagem', value: 'image' },
]

export const RemarketingForm = ({ onSubmit, isSubmitting }: RemarketingFormProps) => {
  const [values, setValues] = useState<RemarketingFormValues>({
    audienceType: 'lead',
    leadStatuses: ['lead_novo'],
    dealStatuses: [],
    startDate: null,
    endDate: null,
    manualTargets: '',
    messageType: 'text',
    messageBody: '',
    scheduleAt: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const disabled = useMemo(() => {
    if (values.audienceType === 'manual') {
      return values.manualTargets.trim().length === 0 || values.messageBody.trim().length === 0
    }
    return values.messageBody.trim().length === 0
  }, [values])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (disabled) {
      setError('Preencha os campos obrigatórios antes de enviar.')
      return
    }

    try {
      await onSubmit({
        audienceType: values.audienceType,
        leadStatuses: values.leadStatuses,
        dealStatuses: values.dealStatuses,
        startDate: values.startDate,
        endDate: values.endDate,
        manualTargets: values.manualTargets
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
        messageType: values.messageType,
        messageBody: values.messageBody,
        scheduleAt: values.scheduleAt,
      })
      setSuccess('Job de remarketing enviado com sucesso.')
    } catch (error) {
      setError((error as Error).message)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Audiência</h3>
        <div className={styles.radioGroup}>
          {(['lead', 'deal', 'manual'] as AudienceType[]).map((type) => (
            <label key={type} className={styles.radioOption}>
              <input
                type="radio"
                value={type}
                checked={values.audienceType === type}
                onChange={() => setValues((prev) => ({ ...prev, audienceType: type }))}
              />
              <span>{type === 'lead' ? 'Leads' : type === 'deal' ? 'Negócios' : 'Lista manual'}</span>
            </label>
          ))}
        </div>

        {values.audienceType === 'lead' ? (
          <div className={styles.multiSelect}>
            {LEAD_STATUSES.map((status) => (
              <label key={status.value}>
                <input
                  type="checkbox"
                  checked={values.leadStatuses.includes(status.value)}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      leadStatuses: event.target.checked
                        ? [...prev.leadStatuses, status.value]
                        : prev.leadStatuses.filter((item) => item !== status.value),
                    }))
                  }
                />
                <span>{status.label}</span>
              </label>
            ))}
          </div>
        ) : null}

        {values.audienceType === 'deal' ? (
          <div className={styles.multiSelect}>
            {DEAL_STATUSES.map((status) => (
              <label key={status.value}>
                <input
                  type="checkbox"
                  checked={values.dealStatuses.includes(status.value)}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      dealStatuses: event.target.checked
                        ? [...prev.dealStatuses, status.value]
                        : prev.dealStatuses.filter((item) => item !== status.value),
                    }))
                  }
                />
                <span>{status.label}</span>
              </label>
            ))}
          </div>
        ) : null}

        {values.audienceType !== 'manual' ? (
          <div className={styles.datesRow}>
            <label>
              <span>Período inicial</span>
              <input
                type="date"
                value={values.startDate ?? ''}
                onChange={(event) => setValues((prev) => ({ ...prev, startDate: event.target.value || null }))}
              />
            </label>
            <label>
              <span>Período final</span>
              <input
                type="date"
                value={values.endDate ?? ''}
                onChange={(event) => setValues((prev) => ({ ...prev, endDate: event.target.value || null }))}
              />
            </label>
          </div>
        ) : (
          <label className={styles.field}>
            <span>Destinatários (um por linha, DDI+DDD+Telefone)</span>
            <textarea
              rows={4}
              value={values.manualTargets}
              onChange={(event) => setValues((prev) => ({ ...prev, manualTargets: event.target.value }))}
              placeholder={'+55 11999999999\n+55 21988888888'}
            />
          </label>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Mensagem</h3>
        <div className={styles.radioGroup}>
          {MESSAGE_TYPES.map((type) => (
            <label key={type.value} className={styles.radioOption}>
              <input
                type="radio"
                value={type.value}
                checked={values.messageType === type.value}
                onChange={() => setValues((prev) => ({ ...prev, messageType: type.value }))}
              />
              <span>{type.label}</span>
            </label>
          ))}
        </div>

        <label className={styles.field}>
          <span>Conteúdo</span>
          <textarea
            rows={6}
            value={values.messageBody}
            onChange={(event) => setValues((prev) => ({ ...prev, messageBody: event.target.value }))}
            placeholder="Olá {{lead_first_name}}, temos uma oferta especial!"
          />
        </label>

        <label className={styles.field}>
          <span>Agendar envio</span>
          <input
            type="datetime-local"
            value={values.scheduleAt ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, scheduleAt: event.target.value || null }))}
          />
          <span className={styles.helper}>Deixe em branco para envio imediato.</span>
        </label>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {success ? <p className={styles.success}>{success}</p> : null}

      <footer className={styles.footer}>
        <button type="submit" className={styles.primaryButton} disabled={disabled || isSubmitting}>
          {isSubmitting ? 'Enviando...' : 'Enviar remarketing'}
        </button>
      </footer>
    </form>
  )
}
