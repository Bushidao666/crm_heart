import { useEffect, useMemo, useState } from 'react'

import styles from './deal-card.module.css'

import type { DealRecord } from '@/features/deals/types'
import { formatCEP, formatCPF } from '@/features/deals/utils/format'
import { heartSupabase, supabase } from '@/lib/supabase-client'

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))

type AttachmentKey =
  | 'deal_documento_frente'
  | 'deal_documento_verso'
  | 'deal_comprovante_residencia'
  | 'deal_audio'

type AttachmentBucket = 'arquivos_deals' | 'audios_deals'

type Attachment = {
  key: AttachmentKey
  label: string
  bucket: AttachmentBucket
  path: string
}

type DealCardProps = {
  deal: DealRecord
  onClick?: (deal: DealRecord) => void
  ownerLabel?: string | null
}

export const DealCard = ({ deal, onClick, ownerLabel }: DealCardProps) => {
  const firstInstallmentDate = deal.deal_primeira_parcela ?? deal.data_primeira_parcela
  const [contractStatus, setContractStatus] = useState<string | null>(null)
  const [contractStatusLoading, setContractStatusLoading] = useState(false)
  const attachments = useMemo<Attachment[]>(() => {
    const entries: Array<{ key: Attachment['key']; label: Attachment['label']; bucket: AttachmentBucket; path: string | null }> = [
      {
        key: 'deal_documento_frente',
        label: 'Documento frente',
        bucket: 'arquivos_deals',
        path: deal.deal_documento_frente,
      },
      {
        key: 'deal_documento_verso',
        label: 'Documento verso',
        bucket: 'arquivos_deals',
        path: deal.deal_documento_verso,
      },
      {
        key: 'deal_comprovante_residencia',
        label: 'Comprovante de residência',
        bucket: 'arquivos_deals',
        path: deal.deal_comprovante_residencia,
      },
      {
        key: 'deal_audio',
        label: 'Áudio',
        bucket: 'audios_deals',
        path: deal.deal_audio,
      },
    ]

    const result: Attachment[] = []

    entries.forEach((entry) => {
      if (entry.path) {
        result.push({ key: entry.key, label: entry.label, bucket: entry.bucket, path: entry.path })
      }
    })

    return result
  }, [deal.deal_audio, deal.deal_comprovante_residencia, deal.deal_documento_frente, deal.deal_documento_verso])

  const [attachmentUrls, setAttachmentUrls] = useState<Partial<Record<AttachmentKey, string>>>({})
  const [attachmentErrors, setAttachmentErrors] = useState<AttachmentKey[]>([])
  const [contractRejectionReason, setContractRejectionReason] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const fetchContractStatus = async () => {
      setContractStatusLoading(true)
      let query = heartSupabase
        .from('contratos')
        .select('contrato_status, motivo_rejeicao')
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (deal.company_id) {
        query = query.eq('company_id', deal.company_id)
      }

      const { data, error } = await query.maybeSingle()

      if (!isMounted) return

      if (error) {
        console.warn('Failed to load contract status for deal', deal.id, error.message)
        setContractStatus(null)
        setContractRejectionReason(null)
      } else {
        setContractStatus((data?.contrato_status as string | null) ?? null)
        setContractRejectionReason((data?.motivo_rejeicao as string | null) ?? null)
      }
      setContractStatusLoading(false)
    }

    void fetchContractStatus()

    return () => {
      isMounted = false
    }
  }, [deal.company_id, deal.id])

  const contractStatusDisplay = useMemo(() => {
    if (!contractStatus) return { label: 'Nenhum contrato enviado', tone: 'muted' as 'muted' | 'info' | 'success' | 'danger' }

    const normalized = contractStatus.toLowerCase()
    const map: Record<string, { label: string; tone: 'muted' | 'info' | 'success' | 'danger' }> = {
      contrato_enviado: { label: 'Contrato enviado', tone: 'info' },
      contrato_visualizado: { label: 'Contrato visualizado', tone: 'info' },
      contrato_assinado: { label: 'Contrato assinado', tone: 'success' },
      contrato_rejeitado: { label: 'Contrato rejeitado', tone: 'danger' },
      contrato_cancelado: { label: 'Contrato cancelado', tone: 'danger' },
    }

    return map[normalized] ?? {
      label: normalized.replace(/_/g, ' '),
      tone: 'info',
    }
  }, [contractStatus])

  const contractStatusBadgeClass = useMemo(() => {
    const toneClassMap = {
      muted: styles.contractStatusBadgeMuted,
      info: styles.contractStatusBadgeInfo,
      success: styles.contractStatusBadgeSuccess,
      danger: styles.contractStatusBadgeDanger,
    }
    return `${styles.contractStatusBadge} ${toneClassMap[contractStatusDisplay.tone]}`
  }, [contractStatusDisplay.tone])

  useEffect(() => {
    let isMounted = true

    if (attachments.length === 0) {
      setAttachmentUrls({})
      setAttachmentErrors([])
      return
    }

    setAttachmentUrls({})
    setAttachmentErrors([])

    const fetchSignedUrls = async () => {
      const successes: [AttachmentKey, string][] = []
      const failures: AttachmentKey[] = []

      await Promise.all(
        attachments.map(async (attachment) => {
          const { data, error } = await supabase.storage.from(attachment.bucket).createSignedUrl(attachment.path, 60)

          if (error || !data?.signedUrl) {
            console.error('Failed to create signed URL for attachment', attachment.path, error)
            failures.push(attachment.key)
            return
          }

          successes.push([attachment.key, data.signedUrl])
        }),
      )

      if (!isMounted) {
        return
      }

      setAttachmentUrls(Object.fromEntries(successes))
      setAttachmentErrors(failures)
    }

    void fetchSignedUrls()

    return () => {
      isMounted = false
    }
  }, [attachments])

  const handleCardClick = () => {
    if (onClick) {
      onClick(deal)
    }
  }

  return (
    <article className={styles.card} onClick={handleCardClick}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>{deal.deal_full_name ?? 'Nome não informado'}</h3>
          {ownerLabel ? <span className={styles.ownerBadge}>{ownerLabel}</span> : null}
        </div>
        <div className={styles.meta}>
          <span className={styles.createdAt}>Criado em {formatDateTime(deal.created_at)}</span>
          <span className={styles.updatedAt}>Atualizado em {formatDateTime(deal.updated_at)}</span>
        </div>
      </header>

      <p className={styles.detailLine}>
        <span className={styles.label}>Email:</span>
        <span className={styles.value}>{deal.deal_email ?? '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Telefone:</span>
        <span className={styles.value}>{deal.deal_phone ?? '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Serviço:</span>
        <span className={styles.value}>{deal.deal_servico ?? '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Valor:</span>
        <span className={styles.value}>
          {deal.deal_valor_contrato
            ? Number(deal.deal_valor_contrato).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '—'}
        </span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Forma de pagamento:</span>
        <span className={styles.value}>{deal.deal_forma_pagamento ?? '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Parcelas:</span>
        <span className={styles.value}>
          {deal.deal_parcelas && deal.deal_parcelas > 0 ? `${deal.deal_parcelas}x` : '—'}
        </span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>CPF:</span>
        <span className={styles.value}>{deal.deal_cpf ? formatCPF(deal.deal_cpf) : '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Data de nascimento:</span>
        <span className={styles.value}>
          {deal.data_nascimento ? new Date(deal.data_nascimento).toLocaleDateString('pt-BR') : '—'}
        </span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>RG:</span>
        <span className={styles.value}>{deal.deal_rg ?? '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Rua:</span>
        <span className={styles.value}>{deal.deal_rua ?? '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Número:</span>
        <span className={styles.value}>{deal.deal_numero ?? '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Bairro:</span>
        <span className={styles.value}>{deal.deal_bairro ?? '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Cidade:</span>
        <span className={styles.value}>{deal.deal_cidade ?? '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Estado:</span>
        <span className={styles.value}>{deal.deal_estado ?? '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>CEP:</span>
        <span className={styles.value}>{deal.deal_cep ? formatCEP(deal.deal_cep) : '—'}</span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Primeira parcela:</span>
        <span className={styles.value}>
          {firstInstallmentDate ? new Date(firstInstallmentDate).toLocaleDateString('pt-BR') : '—'}
        </span>
      </p>

      <p className={styles.detailLine}>
        <span className={styles.label}>Status do contrato:</span>
        <span className={contractStatusBadgeClass}>
          {contractStatusLoading ? 'Carregando...' : contractStatusDisplay.label}
        </span>
      </p>
      {contractStatus === 'contrato_rejeitado' && contractRejectionReason ? (
        <p className={styles.contractRejectionReason}>
          <span className={styles.label}>Motivo da rejeição:</span>
          <span className={styles.rejectionReasonText}>{contractRejectionReason}</span>
        </p>
      ) : null}

      {attachments.length > 0 ? (
        <div className={styles.attachments}>
          <span className={styles.attachmentsTitle}>Documentos anexados</span>
          <ul className={styles.attachmentsList}>
            {attachments.map((attachment) => {
              const url = attachmentUrls[attachment.key]
              const hasError = attachmentErrors.includes(attachment.key)

              return (
                <li key={attachment.key} className={styles.attachmentLine}>
                  <span className={styles.label}>{attachment.label}:</span>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.link}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Abrir
                    </a>
                  ) : hasError ? (
                    <span className={styles.value}>Indisponível</span>
                  ) : (
                    <span className={styles.value}>Gerando link...</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </article>
  )
}
