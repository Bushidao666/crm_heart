import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { addMonths, format as formatDate, isValid, parseISO } from 'date-fns'

import { useContractTemplates } from '@/features/contracts/hooks/use-contract-templates'
import type { ContractTemplateWithVariables } from '@/features/contracts/types'
import { FileUploadField } from '@/features/deals/components/file-upload-field'
import { BRAZILIAN_STATES } from '@/features/deals/types'
import type { DealRecord, ServiceRecord } from '@/features/deals/types'
import { formatCEP, formatCPF, formatCurrency, formatPhone, formatRG, parseCurrency } from '@/features/deals/utils/format'
import {
  fixFragmentedPlaceholdersInXml,
  replaceDocxPlaceholders,
} from '@/features/deals/utils/docx-placeholders'
import { useCompany } from '@/app/providers/use-company'
import { heartSupabase, supabase } from '@/lib/supabase-client'
import { DEAL_DRAFT_STORAGE_PREFIX } from '@/features/deals/constants'
import { useToast } from '@/app/providers/use-toast'

import styles from './deal-drawer.module.css'

type SelectedDeal = (Partial<DealRecord> & { id: string }) | null

type DealDrawerProps = {
  deal: SelectedDeal
  open: boolean
  onClose: () => void
  onSave: (payload: Partial<DealRecord> & { id: string }) => Promise<void>
}

const SERVICE_FALLBACK: ServiceRecord = {
  id: 'custom',
  nome: 'Outro serviço',
}

const MISSING_PLACEHOLDER = 'Não informado'
const HIGHLIGHT_CLASS = 'crm-highlighted-value'
const HIGHLIGHT_MISSING_CLASS = 'crm-highlighted-value crm-highlighted-value--missing'
const CONTRACT_PREVIEW_UNAUTHORIZED_ERROR = 'contract-preview/unauthorized'

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

type HighlightEntry = {
  value: string
  isMissing: boolean
}

type HighlightMap = Record<string, HighlightEntry>

type ReplacementMap = Record<string, string>

type SignerDeliveryMethod = 'email' | 'whatsapp' | 'sms'

type SignatureFieldType = 'SIGNATURE' | 'NAME' | 'INITIALS' | 'DATE' | 'CPF'

type SignatureField = {
  id: string
  type: SignatureFieldType
  page: number
  xPercent: number
  yPercent: number
  x: number
  y: number
  pageTop: number
  pageHeight: number
  pageWidth: number
  pageLeft: number
}

type SignerRole = 'SIGNER' | 'WITNESS'

type SignerFormEntry = {
  id: string
  name: string
  email: string
  phone: string
  cpf: string
  deliveryMethod: SignerDeliveryMethod
  role: SignerRole
  fields: SignatureField[]
}

const DELIVERY_METHOD_OPTIONS: Array<{ value: SignerDeliveryMethod; label: string }> = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
]

const DEFAULT_PAGE_WIDTH = 793
const DEFAULT_PAGE_HEIGHT = 1123

type ParticipantColor = {
  border: string
  background: string
  badgeBackground: string
  badgeColor: string
  shadow: string
}

type ContractStatusTone = 'muted' | 'info' | 'success' | 'danger'

const CONTRACT_STATUS_MAP: Record<string, { label: string; tone: ContractStatusTone }> = {
  contrato_enviado: {
    label: 'Contrato enviado',
    tone: 'info',
  },
  contrato_visualizado: {
    label: 'Contrato visualizado',
    tone: 'info',
  },
  contrato_assinado: {
    label: 'Contrato assinado',
    tone: 'success',
  },
  contrato_rejeitado: {
    label: 'Contrato rejeitado',
    tone: 'danger',
  },
  contrato_cancelado: {
    label: 'Contrato cancelado',
    tone: 'danger',
  },
}

const SIGNER_COLOR_PALETTE: ParticipantColor[] = [
  {
    border: 'rgba(37, 99, 235, 0.55)',
    background: 'rgba(59, 130, 246, 0.12)',
    badgeBackground: 'rgba(37, 99, 235, 0.18)',
    badgeColor: '#1d4ed8',
    shadow: '0 16px 32px -24px rgba(37, 99, 235, 0.65)',
  },
  {
    border: 'rgba(99, 102, 241, 0.55)',
    background: 'rgba(129, 140, 248, 0.12)',
    badgeBackground: 'rgba(99, 102, 241, 0.18)',
    badgeColor: '#4c1d95',
    shadow: '0 16px 32px -24px rgba(99, 102, 241, 0.55)',
  },
  {
    border: 'rgba(5, 150, 105, 0.55)',
    background: 'rgba(16, 185, 129, 0.12)',
    badgeBackground: 'rgba(5, 150, 105, 0.18)',
    badgeColor: '#047857',
    shadow: '0 16px 32px -24px rgba(5, 150, 105, 0.6)',
  },
  {
    border: 'rgba(56, 189, 248, 0.55)',
    background: 'rgba(125, 211, 252, 0.17)',
    badgeBackground: 'rgba(56, 189, 248, 0.22)',
    badgeColor: '#0c4a6e',
    shadow: '0 16px 32px -24px rgba(56, 189, 248, 0.5)',
  },
]

const WITNESS_COLOR_PALETTE: ParticipantColor[] = [
  {
    border: 'rgba(249, 115, 22, 0.6)',
    background: 'rgba(251, 146, 60, 0.15)',
    badgeBackground: 'rgba(251, 146, 60, 0.24)',
    badgeColor: '#c2410c',
    shadow: '0 16px 32px -24px rgba(249, 115, 22, 0.6)',
  },
  {
    border: 'rgba(234, 88, 12, 0.6)',
    background: 'rgba(249, 115, 22, 0.11)',
    badgeBackground: 'rgba(234, 88, 12, 0.22)',
    badgeColor: '#9a3412',
    shadow: '0 16px 32px -24px rgba(234, 88, 12, 0.55)',
  },
  {
    border: 'rgba(245, 158, 11, 0.6)',
    background: 'rgba(253, 186, 116, 0.16)',
    badgeBackground: 'rgba(245, 158, 11, 0.24)',
    badgeColor: '#92400e',
    shadow: '0 16px 32px -24px rgba(245, 158, 11, 0.55)',
  },
  {
    border: 'rgba(217, 70, 239, 0.6)',
    background: 'rgba(232, 121, 249, 0.15)',
    badgeBackground: 'rgba(217, 70, 239, 0.22)',
    badgeColor: '#a21caf',
    shadow: '0 16px 32px -24px rgba(217, 70, 239, 0.6)',
  },
]

const createSignerFromDeal = (deal: Partial<DealRecord> & { id?: string }): SignerFormEntry => ({
  id: crypto.randomUUID(),
  name: deal.deal_full_name ?? '',
  email: deal.deal_email ?? '',
  phone: deal.deal_phone ?? '',
  cpf: deal.deal_cpf ?? '',
  deliveryMethod: 'email',
  role: 'SIGNER',
  fields: [],
})

const createEmptySigner = (role: SignerRole = 'SIGNER'): SignerFormEntry => ({
  id: crypto.randomUUID(),
  name: '',
  email: '',
  phone: '',
  cpf: '',
  deliveryMethod: 'email',
  role,
  fields: [],
})

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const createHighlightSpan = (entry: HighlightEntry | undefined, key: string) => {
  if (!entry) return ''
  const safeContent = escapeHtml(entry.value)
  const className = entry.isMissing ? HIGHLIGHT_MISSING_CLASS : HIGHLIGHT_CLASS
  return `<span class="${className}" data-variable="${key}">${safeContent}</span>`
}

const MARKER_REGEX = /\[\[__CRM_VAR_OPEN__([^\]]+)__\]\]([\s\S]*?)\[\[__CRM_VAR_CLOSE__\1__\]\]/g

const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return ''
  return value.slice(0, 10)
}

const normalizeDateString = (value: unknown): string | null => {
  if (!value) return null

  if (value instanceof Date) {
    if (!isValid(value)) return null
    return formatDate(value, 'yyyy-MM-dd')
  }

  if (typeof value === 'number') {
    const fromNumber = new Date(value)
    if (!Number.isNaN(fromNumber.getTime())) {
      return formatDate(fromNumber, 'yyyy-MM-dd')
    }
    return null
  }

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  let parsed: Date | null = null
  try {
    parsed = parseISO(trimmed)
  } catch {
    parsed = null
  }

  if (!parsed || !isValid(parsed)) {
    const fallback = new Date(trimmed)
    if (!Number.isNaN(fallback.getTime())) {
      parsed = fallback
    }
  }

  if (!parsed || !isValid(parsed)) return null

  return formatDate(parsed, 'yyyy-MM-dd')
}

const normalizeParcelSchedule = (value: unknown): Record<string, string> | null => {
  if (!value) return null

  let entries: Record<string, unknown> | null = null

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        entries = parsed
      }
    } catch {
      entries = null
    }
  } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    entries = value as Record<string, unknown>
  }

  if (!entries) return null

  const result: Record<string, string> = {}

  Object.entries(entries).forEach(([key, rawValue]) => {
    if (!key.startsWith('deal_parcela_')) return
    const normalized = normalizeDateString(rawValue)
    if (normalized) {
      result[key] = normalized
    }
  })

  return Object.keys(result).length > 0 ? result : null
}

const generateParcelSchedule = (startDate: string | null | undefined, total: number | null | undefined) => {
  if (!startDate || !total || total <= 0) return null
  const normalizedStart = normalizeDateString(startDate)
  if (!normalizedStart) return null

  let base: Date
  try {
    base = parseISO(normalizedStart)
  } catch {
    base = new Date(normalizedStart)
  }

  if (!base || Number.isNaN(base.getTime())) return null

  const schedule: Record<string, string> = {}

  for (let index = 0; index < total; index += 1) {
    const future = addMonths(base, index)
    if (Number.isNaN(future.getTime())) continue
    schedule[`deal_parcela_${index + 1}`] = formatDate(future, 'yyyy-MM-dd')
  }

  return Object.keys(schedule).length ? schedule : null
}

const schedulesAreEqual = (
  current: Record<string, string> | null | undefined,
  next: Record<string, string> | null | undefined,
) => {
  if (!current && !next) return true
  if (!current || !next) return false
  const currentKeys = Object.keys(current)
  const nextKeys = Object.keys(next)
  if (currentKeys.length !== nextKeys.length) return false
  return currentKeys.every((key) => current[key] === next[key])
}

const formatParcelDisplay = (value: unknown): string => {
  if (!value) return ''

  if (value instanceof Date) {
    if (!isValid(value)) return ''
    return formatDate(value, 'dd/MM/yyyy')
  }

  if (typeof value === 'number') {
    const fromNumber = new Date(value)
    if (Number.isNaN(fromNumber.getTime())) return ''
    return formatDate(fromNumber, 'dd/MM/yyyy')
  }

  if (typeof value !== 'string') return ''

  const trimmed = value.trim()
  if (!trimmed) return ''

  const isoMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(trimmed)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const dateValue = new Date(Number(year), Number(month) - 1, Number(day))
    if (Number.isNaN(dateValue.getTime())) return ''
    return formatDate(dateValue, 'dd/MM/yyyy')
  }

  const fallback = new Date(trimmed)
  if (Number.isNaN(fallback.getTime())) return ''
  return formatDate(fallback, 'dd/MM/yyyy')
}

const normalizePhoneForAutentique = (value: string | null | undefined): string | null => {
  if (!value) return null
  const digitsOnly = value.replace(/\D/g, '')
  if (!digitsOnly) return null

  let withoutDdi = digitsOnly
  let hasDdi = false
  if (withoutDdi.startsWith('55')) {
    withoutDdi = withoutDdi.slice(2)
    hasDdi = true
  }

  withoutDdi = withoutDdi.replace(/^0+/, '')

  if (withoutDdi.length === 10) {
    const ddd = withoutDdi.slice(0, 2)
    const subscriber = withoutDdi.slice(2)
    withoutDdi = `${ddd}9${subscriber}`
  }

  if (withoutDdi.length !== 11) {
    return null
  }

  const withDdi = `55${withoutDdi}`
  return hasDdi || digitsOnly.startsWith('55') ? `+${withDdi}` : `+${withDdi}`
}

const buildDocxReplacementDictionary = (data: Record<string, unknown>): Record<string, string> => {
  const result: Record<string, string> = {}

  const visit = (value: unknown, path: string) => {
    if (value === null || value === undefined) {
      result[path] = ''
      return
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
        const nextPath = path ? `${path}.${key}` : key
        visit(nested, nextPath)
      })
      return
    }

    result[path] = String(value)
  }

  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      visit(value, key)
      return
    }

    result[key] = value === null || value === undefined ? '' : String(value)
  })

  return result
}

export const DealDrawer = ({ deal, open, onClose, onSave }: DealDrawerProps) => {
  const [services, setServices] = useState<ServiceRecord[]>([])
  const { templates, isLoading: templatesLoading, error: templatesError } = useContractTemplates()
  const [form, setForm] = useState<Partial<DealRecord>>({})
  const [parcelValue, setParcelValue] = useState<number | null>(null)
  const [cityOptions, setCityOptions] = useState<string[]>([])
  const [isLoadingCities, setIsLoadingCities] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leadData, setLeadData] = useState<Record<string, unknown> | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [previewContent, setPreviewContent] = useState<{ raw: string; html: string } | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [isDesignerOpen, setIsDesignerOpen] = useState(false)
  const [isSendingContract, setIsSendingContract] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [contractStatus, setContractStatus] = useState<string | null>(null)
  const [contractRejectionReason, setContractRejectionReason] = useState<string | null>(null)
  const [signers, setSigners] = useState<SignerFormEntry[]>([])
  const [signersOrdered, setSignersOrdered] = useState(false)
  const [activeSignerId, setActiveSignerId] = useState<string | null>(null)
  const hasPreview = Boolean(previewContent?.html)
  const legacyShareLinksRef = useRef<Record<string, string>>({})
  // Legacy no-op setter kept so cached bundles referencing setShareLinksBySigner don't crash.
  const setShareLinksBySigner = useCallback(
    (
      next:
        | Record<string, string>
        | ((prev: Record<string, string>) => Record<string, string>),
    ) => {
      legacyShareLinksRef.current =
        typeof next === 'function'
          ? (next as (prev: Record<string, string>) => Record<string, string>)(
              legacyShareLinksRef.current,
            )
          : next ?? {}
    },
    [],
  )
  const designerPreviewRef = useRef<HTMLDivElement | null>(null)
  const designerDocumentWrapperRef = useRef<HTMLDivElement | null>(null)
  const designerDocumentRef = useRef<HTMLDivElement | null>(null)
  const [, setPageRects] = useState<Array<{ page: number; top: number; bottom: number; left: number; width: number; height: number }>>([])
  const draftStorageKey = typeof window !== 'undefined' && deal ? `${DEAL_DRAFT_STORAGE_PREFIX}:${deal.id}` : null
  const toast = useToast()
  const { companyId } = useCompany()
  const dealCompanyId = deal?.company_id ?? null

  const dealNameForStorage = useMemo(() => {
    const base = form.deal_full_name ?? deal?.deal_full_name ?? ''
    return base.trim()
  }, [form.deal_full_name, deal?.deal_full_name])

  const dealCpfForStorage = useMemo(() => {
    const base = form.deal_cpf ?? deal?.deal_cpf ?? ''
    return base.trim()
  }, [form.deal_cpf, deal?.deal_cpf])

  const contractStatusDisplay = useMemo(() => {
    const normalized = contractStatus ? contractStatus.toLowerCase() : null
    if (!normalized) {
      return {
        label: 'Nenhum contrato enviado',
        tone: 'muted' as ContractStatusTone,
      }
    }

    const mapped = CONTRACT_STATUS_MAP[normalized]
    if (mapped) return mapped

    return {
      label: normalized.replace(/_/g, ' '),
      tone: 'info' as ContractStatusTone,
    }
  }, [contractStatus])

  const contractStatusToneClass = useMemo(() => {
    const toneMap: Record<ContractStatusTone, string> = {
      muted: styles.contractStatusBadgeMuted,
      info: styles.contractStatusBadgeInfo,
      success: styles.contractStatusBadgeSuccess,
      danger: styles.contractStatusBadgeDanger,
    }
    return toneMap[contractStatusDisplay.tone]
  }, [contractStatusDisplay.tone])

  const normalizeFormState = useCallback(
    (payload: Partial<DealRecord>): Partial<DealRecord> => {
      const schedule = normalizeParcelSchedule(payload.parcelas_datas ?? null)
      const firstParcel = schedule?.deal_parcela_1 ?? null
      const firstDate = normalizeDateString(payload.data_primeira_parcela ?? firstParcel)
      const birthDate = normalizeDateString(payload.data_nascimento ?? null)

      return {
        ...payload,
        company_id: payload.company_id ?? dealCompanyId ?? companyId ?? null,
        data_primeira_parcela: firstDate,
        data_nascimento: birthDate,
        parcelas_datas: schedule,
      }
    },
    [companyId, dealCompanyId],
  )

  const normalizeVariableKey = useCallback((value: string | null | undefined) => {
    if (!value) return ''
    return value.replace(/^{{\s*/g, '').replace(/\s*}}$/g, '').trim()
  }, [])

  const convertPreviewToHtml = useCallback((content: string | null) => {
    if (!content) return ''

    const trimmed = content.trim()
    if (!trimmed) return ''

    const containsHtmlTags = /<\/?[a-z][\s\S]*>/i.test(trimmed)
    if (containsHtmlTags) {
      return trimmed
    }

    const paragraphs = trimmed
      .split(/\n{2,}/)
      .map((paragraph) => {
        const safe = escapeHtml(paragraph).replace(/\n/g, '<br />')
        return `<p>${safe}</p>`
      })

    if (paragraphs.length === 0) {
      return `<p>${escapeHtml(trimmed)}</p>`
    }

    return paragraphs.join('')
  }, [])

  useEffect(() => {
    if (!companyId) return

    const fetchServices = async () => {
      let query = heartSupabase
        .from('services')
        .select('id, nome, valor_padrao, max_parcelas, formas_pagamento, company_id')
        .order('created_at', { ascending: false })

      query = query.or(`company_id.eq.${companyId},company_id.is.null`)

      const { data, error } = await query

      if (error) {
        console.warn('services table not available or error fetching services', error.message)
        setServices([])
        return
      }

      setServices((data ?? []) as ServiceRecord[])
    }

    void fetchServices()
  }, [companyId])


  useEffect(() => {
    if (!deal) return

    const loadDraft = () => {
      if (!draftStorageKey) return false

      try {
        const storedValue = typeof window !== 'undefined' ? sessionStorage.getItem(draftStorageKey) : null
        if (!storedValue) return false

        const parsed = JSON.parse(storedValue) as {
          form?: Partial<DealRecord>
          parcelValue?: number | null
          selectedTemplateId?: string
          previewContent?: string | null
          previewTitle?: string | null
          contractStatus?: string | null
          contractRejectionReason?: string | null
          isPreviewModalOpen?: boolean
          signers?: Array<{
            id?: string
            name?: string
            email?: string
            phone?: string
          cpf?: string
          deliveryMethod?: SignerDeliveryMethod
          role?: SignerRole
          fields?: Array<{
            id?: string
            type?: SignatureFieldType
            page?: number
            x?: number
            y?: number
          }>
          }>
          signersOrdered?: boolean
          activeSignerId?: string | null
        }

        setForm(normalizeFormState({ ...deal, ...(parsed.form ?? {}) }))
        setParcelValue(parsed.parcelValue ?? null)
        setSelectedTemplateId(parsed.selectedTemplateId ?? '')
        if (parsed.previewContent) {
          const html = convertPreviewToHtml(parsed.previewContent)
          if (html) {
            setPreviewContent({
              raw: parsed.previewContent,
              html,
            })
          } else {
            setPreviewContent(null)
          }
        } else {
          setPreviewContent(null)
        }
        setPreviewTitle(parsed.previewTitle ?? null)
        setPreviewError(null)
        setContractStatus(parsed.contractStatus ?? null)
        setContractRejectionReason(parsed.contractRejectionReason ?? null)
        setIsPreviewModalOpen(false)

        if ('shareLinksBySigner' in parsed) {
          delete (parsed as { shareLinksBySigner?: unknown }).shareLinksBySigner
        }

        if (parsed.signers && Array.isArray(parsed.signers) && parsed.signers.length > 0) {
          const restoredSigners = parsed.signers.map((signer) => ({
            id: signer.id ?? crypto.randomUUID(),
            name: signer.name ?? '',
            email: signer.email ?? '',
            phone: signer.phone ?? '',
            cpf: signer.cpf ?? '',
            deliveryMethod: signer.deliveryMethod ?? 'email',
            role: signer.role === 'WITNESS' ? 'WITNESS' : 'SIGNER',
            fields: [],
          }))

          setSigners(restoredSigners)
          setActiveSignerId(parsed.activeSignerId && restoredSigners.some((item) => item.id === parsed.activeSignerId)
            ? parsed.activeSignerId
            : restoredSigners[0]?.id ?? null)
          setShareLinksBySigner({})
        } else {
          const fallbackSigner = createSignerFromDeal(deal ?? {})
          setSigners([fallbackSigner])
          setActiveSignerId(fallbackSigner.id)
          setShareLinksBySigner({})
        }

        setSignersOrdered(parsed.signersOrdered ?? false)
        return true
      } catch (error) {
        console.warn('Failed to restore deal draft from sessionStorage', error)
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(draftStorageKey)
        }
        return false
      }
    }

    const restored = loadDraft()

    if (!restored) {
      setForm(normalizeFormState(deal))
      setSelectedTemplateId('')
      setPreviewContent(null)
      setPreviewTitle(null)
      setPreviewError(null)
      setContractStatus(null)
      setContractRejectionReason(null)
      setIsPreviewModalOpen(false)
      const fallbackSigner = createSignerFromDeal(deal)
      setSigners([fallbackSigner])
      setActiveSignerId(fallbackSigner.id)
      setSignersOrdered(false)
      setShareLinksBySigner({})

      if (deal.deal_valor_contrato && deal.deal_parcelas) {
        const value = parseCurrency(deal.deal_valor_contrato ?? null)
        if (deal.deal_parcelas > 0) {
          setParcelValue(value / deal.deal_parcelas)
        }
      } else {
        setParcelValue(null)
      }
    }

    const fetchLeadAndContract = async () => {
      const companyFilter = deal?.company_id ?? companyId ?? null
      let leadQuery = heartSupabase.from('leads_captura').select('*').eq('id', deal.id)
      if (companyFilter) {
        leadQuery = leadQuery.eq('company_id', companyFilter)
      }

      let contractsQuery = heartSupabase
        .from('contratos')
        .select('contrato_status, contrato_copia, contrato_nome, motivo_rejeicao')
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (companyFilter) {
        contractsQuery = contractsQuery.eq('company_id', companyFilter)
      }

      const [{ data: lead }, { data: contracts }] = await Promise.all([leadQuery.maybeSingle(), contractsQuery])

      setLeadData(lead ?? null)
      const contract = contracts?.[0] ?? null
      if (contract) {
        setContractStatus((contract.contrato_status as string | null) ?? null)
        setContractRejectionReason((contract.motivo_rejeicao as string | null) ?? null)
        const rawContract = (contract.contrato_copia as string | null) ?? null
        if (rawContract) {
          const html = convertPreviewToHtml(rawContract)
          if (html) {
            setPreviewContent({
              raw: rawContract,
              html,
            })
          } else {
            setPreviewContent(null)
          }
        } else {
          setPreviewContent(null)
        }
        setIsPreviewModalOpen(false)
        setPreviewTitle((contract.contrato_nome as string | null) ?? null)
      } else {
        setContractRejectionReason(null)
      }
    }

    void fetchLeadAndContract()
  }, [deal, draftStorageKey, companyId, convertPreviewToHtml, normalizeFormState, setShareLinksBySigner])

  useEffect(() => {
    if (!deal || !draftStorageKey) return
    if (!open) return

  const payload = JSON.stringify({
      form,
      parcelValue,
      selectedTemplateId,
      previewContent: previewContent?.raw ?? null,
      previewTitle,
      contractStatus,
      contractRejectionReason,
      isPreviewModalOpen,
      signers: signers.map((signer) => ({
        id: signer.id,
        name: signer.name,
        email: signer.email,
        phone: signer.phone,
        cpf: signer.cpf,
        deliveryMethod: signer.deliveryMethod,
        role: signer.role,
        fields: [],
      })),
      signersOrdered,
      activeSignerId,
    })

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(draftStorageKey, payload)
    }
  }, [
    deal,
    draftStorageKey,
    form,
    parcelValue,
    selectedTemplateId,
    previewContent,
    previewTitle,
  contractStatus,
  contractRejectionReason,
  isPreviewModalOpen,
    signers,
    signersOrdered,
    activeSignerId,
    open,
  ])

  const availablePaymentMethods = useMemo(() => {
    const selected = services.find((service) => service.nome === form.deal_servico)
    return selected?.formas_pagamento ?? ['Pix', 'Cartão', 'Boleto']
  }, [form.deal_servico, services])

  const maxInstallments = useMemo(() => {
    const selected = services.find((service) => service.nome === form.deal_servico)
    return selected?.max_parcelas ?? 12
  }, [form.deal_servico, services])

  useEffect(() => {
    if (!form.deal_estado) {
      setCityOptions([])
      if (form.deal_cidade) {
        setForm((prev) => ({ ...prev, deal_cidade: null }))
      }
      return
    }

    let active = true
    setIsLoadingCities(true)

    heartSupabase
      .from('cidades')
      .select('nome')
      .eq('estado', form.deal_estado)
      .order('nome')
      .then(({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) {
          console.error('Failed to load cities', fetchError)
          setCityOptions([])
          return
        }
        const names = (data ?? []).map((city) => city.nome as string)
        setCityOptions(names)
        if (form.deal_cidade && !names.includes(form.deal_cidade)) {
          setForm((prev) => ({ ...prev, deal_cidade: null }))
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingCities(false)
        }
      })

    return () => {
      active = false
    }
  }, [form.deal_estado, form.deal_cidade])

const participantCounts = useMemo(() => {
    let signerTotal = 0
    let witnessTotal = 0
    for (const signer of signers) {
      if (signer.role === 'WITNESS') {
        witnessTotal += 1
      } else {
        signerTotal += 1
      }
    }
    return { signerTotal, witnessTotal }
  }, [signers])

  const participantMetadata = useMemo(() => {
    let signerCounter = 0
    let witnessCounter = 0
    const map = new Map<
      string,
      {
        displayLabel: string
        color: ParticipantColor
        role: SignerRole
        index: number
        deliveryMethod: SignerDeliveryMethod
      }
    >()

    for (const participant of signers) {
      const isWitness = participant.role === 'WITNESS'
      const index = isWitness ? ++witnessCounter : ++signerCounter
      const palette = isWitness ? WITNESS_COLOR_PALETTE : SIGNER_COLOR_PALETTE
      const color = palette[(index - 1) % palette.length]
      const displayLabel = isWitness ? `Testemunha ${index}` : `Signatário ${index}`
      map.set(participant.id, {
        displayLabel,
        color,
        role: participant.role,
        index,
        deliveryMethod: participant.deliveryMethod,
      })
    }

    return map
  }, [signers])

  const activeSigner = useMemo(() => {
    if (!signers.length) return null
    return signers.find((signer) => signer.id === activeSignerId) ?? signers[0]
  }, [signers, activeSignerId])

  useEffect(() => {
    if (!deal) return
    if (!form.deal_servico) return

    const service = services.find((item) => item.nome === form.deal_servico)
    if (!service) return

    const defaultValue = service.valor_padrao
    if (defaultValue === null || defaultValue === undefined) return

    if (form.deal_valor_contrato !== null && form.deal_valor_contrato !== undefined) return

    setForm((prev) => ({
      ...prev,
      deal_valor_contrato: defaultValue,
    }))

    if (form.deal_parcelas && form.deal_parcelas > 0) {
      setParcelValue(defaultValue / form.deal_parcelas)
    }
  }, [deal, form.deal_parcelas, form.deal_servico, form.deal_valor_contrato, services])

  const handleChange = (key: keyof DealRecord, value: string | number | null) => {
    setForm((prev) => {
      let nextValue: string | number | null = value

      if (key === 'data_primeira_parcela' || key === 'data_nascimento') {
        nextValue = normalizeDateString(value) ?? null
      }

      return {
        ...prev,
        [key]: nextValue,
      }
    })
  }

  const handleAddSigner = () => {
    const newSigner = createEmptySigner('SIGNER')
    setSigners((prev) => [...prev, newSigner])
    setActiveSignerId(newSigner.id)
  }

  const handleAddWitness = () => {
    const newWitness = createEmptySigner('WITNESS')
    setSigners((prev) => [...prev, newWitness])
    setActiveSignerId(newWitness.id)
  }

  const handleRemoveSigner = (id: string) => {
    setSigners((prev) => {
      const filtered = prev.filter((signer) => signer.id !== id)
      if (filtered.length === 0) {
        const fallback = createEmptySigner('SIGNER')
        setActiveSignerId(fallback.id)
        return [fallback]
      }

      if (activeSignerId === id) {
        setActiveSignerId(filtered[0]?.id ?? null)
      }

      return filtered
    })
  }

  const handleSignerChange = (id: string, patch: Partial<Omit<SignerFormEntry, 'id' | 'fields'>>) => {
    setSigners((prev) =>
      prev.map((signer) => {
        if (signer.id !== id) return signer

        const updated: SignerFormEntry = { ...signer, ...patch }

        if (patch.deliveryMethod) {
          if (patch.deliveryMethod === 'email') {
            updated.phone = ''
          } else if (patch.deliveryMethod === 'sms' || patch.deliveryMethod === 'whatsapp') {
            updated.email = ''
          }
        }

        return updated
      }),
    )
  }

  const handleSignerCpfChange = (id: string, value: string) => {
    const normalized = value.replace(/[^0-9]/g, '').slice(0, 11)
    setSigners((prev) =>
      prev.map((signer) => (signer.id === id ? { ...signer, cpf: normalized } : signer)),
    )
  }

  const handleSignerSelect = (id: string) => {
    setActiveSignerId(id)
  }

  useEffect(() => {
    if (!deal) return

    setSigners((prev) => {
      if (prev.length > 0) return prev
      const fallback = createSignerFromDeal(deal)
      setActiveSignerId(fallback.id)
      return [fallback]
    })
  }, [deal])

  useEffect(() => {
    if (!signers.length) {
      setActiveSignerId(null)
      return
    }

    if (!activeSignerId || !signers.some((signer) => signer.id === activeSignerId)) {
      setActiveSignerId(signers[0]?.id ?? null)
    }
  }, [signers, activeSignerId])

  const recomputePageRects = useCallback(() => {
    const documentNode = designerDocumentRef.current
    const wrapper = designerDocumentWrapperRef.current
    if (!documentNode || !wrapper) {
      setPageRects([])
      return
    }

    const selectors = ['[data-page-number]', '.docx-page', '.page', '.docx-section']
    let pages: HTMLElement[] = []

    for (const selector of selectors) {
      const found = Array.from(documentNode.querySelectorAll<HTMLElement>(selector))
      if (found.length) {
        pages = found
        break
      }
    }

    if (!pages.length) {
      pages = Array.from(documentNode.children) as HTMLElement[]
    }

    pages = pages
      .map((node) => {
        if (node.tagName === 'STYLE' || node.tagName === 'SCRIPT') return null
        return node
      })
      .filter((node): node is HTMLElement => Boolean(node))

    if (pages.length && !pages.some((node) => node.getAttribute('data-page-number'))) {
      const nested = pages
        .flatMap((node) => Array.from(node.querySelectorAll<HTMLElement>('[data-page-number], .docx-page, .page, .docx-section')))
        .filter((node) => node.tagName !== 'STYLE' && node.tagName !== 'SCRIPT')
      if (nested.length) {
        pages = nested
      }
    }

    const wrapperRect = wrapper.getBoundingClientRect()

    if (!pages.length) {
      const documentRect = documentNode.getBoundingClientRect()
      const baseTop = wrapper.scrollTop + (documentRect.top - wrapperRect.top)
      const baseLeft = wrapper.scrollLeft + (documentRect.left - wrapperRect.left)

      const measuredWidth = documentRect.width || documentNode.scrollWidth || documentNode.clientWidth || DEFAULT_PAGE_WIDTH
      const scale = measuredWidth > 0 ? measuredWidth / DEFAULT_PAGE_WIDTH : 1
      const estimatedPageHeight = Math.max(DEFAULT_PAGE_HEIGHT * scale, DEFAULT_PAGE_HEIGHT * 0.75)

      const fullHeight = documentNode.scrollHeight || documentRect.height || DEFAULT_PAGE_HEIGHT
      const pageCount = Math.max(1, Math.ceil(fullHeight / estimatedPageHeight))

      const syntheticRects = Array.from({ length: pageCount }, (_, index) => {
        const sliceStart = index * estimatedPageHeight
        const sliceEnd = Math.min(fullHeight, (index + 1) * estimatedPageHeight)
        const top = baseTop + sliceStart
        const bottom = baseTop + sliceEnd
        const height = Math.max(bottom - top, 1)
        return {
          page: index + 1,
          top,
          bottom,
          left: baseLeft,
          width: measuredWidth || DEFAULT_PAGE_WIDTH,
          height,
        }
      })

      setPageRects(syntheticRects)
      return
    }

    const rects = pages
      .map((pageNode, index) => {
        const rect = pageNode.getBoundingClientRect()
        const pageNumber = Number(pageNode.getAttribute('data-page-number')) || index + 1
        const top = wrapper.scrollTop + (rect.top - wrapperRect.top)
        const left = wrapper.scrollLeft + (rect.left - wrapperRect.left)
        const width = rect.width || DEFAULT_PAGE_WIDTH
        const height = rect.height || DEFAULT_PAGE_HEIGHT
        return {
          page: pageNumber,
          top,
          bottom: top + height,
          left,
          width,
          height,
        }
      })
      .filter((rect) => rect.height > 1 && Number.isFinite(rect.height) && Number.isFinite(rect.top))

    setPageRects(rects)
  }, [])

  const handleCloseDesigner = () => {
    setIsDesignerOpen(false)
  }

  const handleOpenDesigner = async () => {
    if (!selectedTemplateId) {
      setPreviewError('Selecione um template antes de configurar assinaturas.')
      return
    }

    if (!previewContent?.html) {
      const generated = await handleGeneratePreview({ openPreview: false })
      if (!generated) return
    }

    if (!signers.length) {
      const fallback = createSignerFromDeal(deal ?? {})
      setSigners([fallback])
      setActiveSignerId(fallback.id)
    }

    setIsDesignerOpen(true)
    setIsPreviewModalOpen(false)
    requestAnimationFrame(() => {
      recomputePageRects()
    })
  }

  useEffect(() => {
    if (!isDesignerOpen) return

    const handleResize = () => {
      recomputePageRects()
    }
    window.addEventListener('resize', handleResize)

    const wrapperObserver = new ResizeObserver(() => {
      recomputePageRects()
    })
    if (designerDocumentWrapperRef.current) {
      wrapperObserver.observe(designerDocumentWrapperRef.current)
    }

    recomputePageRects()

    const observer = new ResizeObserver(() => {
      recomputePageRects()
    })
    if (designerPreviewRef.current) {
      observer.observe(designerPreviewRef.current)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      wrapperObserver.disconnect()
      observer.disconnect()
    }
  }, [isDesignerOpen, previewContent, recomputePageRects])

  useEffect(() => {
    if (!isDesignerOpen) return
    recomputePageRects()
  }, [isDesignerOpen, previewContent, signers, recomputePageRects])

  useEffect(() => {
    if (!deal) return

    setForm((prev) => {
      const schedule = generateParcelSchedule(form.data_primeira_parcela, form.deal_parcelas)

      if (!schedule) {
        if (!prev.parcelas_datas) return prev
        return {
          ...prev,
          parcelas_datas: null,
        }
      }

      if (schedulesAreEqual(prev.parcelas_datas, schedule)) {
        return prev
      }

      return {
        ...prev,
        parcelas_datas: schedule,
      }
    })
  }, [deal, form.data_primeira_parcela, form.deal_parcelas])

  const handleServiceChange = (serviceName: string) => {
    const service = services.find((item) => item.nome === serviceName) ?? null
    const currentServiceName = form.deal_servico ?? ''
    const hasChanged = serviceName !== currentServiceName
    const defaultValue =
      service?.valor_padrao !== null && service?.valor_padrao !== undefined ? service.valor_padrao : null
    const defaultInstallments = service?.max_parcelas ?? null

    const shouldSetDefault =
      defaultValue !== null && (hasChanged || form.deal_valor_contrato === null || form.deal_valor_contrato === undefined)
    const shouldSetInstallments =
      defaultInstallments !== null &&
      defaultInstallments !== undefined &&
      (hasChanged || !form.deal_parcelas || form.deal_parcelas > defaultInstallments)

    setForm((prev) => {
      const next: Partial<DealRecord> = {
        ...prev,
        deal_servico: serviceName,
      }

      if (shouldSetDefault) {
        next.deal_valor_contrato = defaultValue
      } else if (!serviceName) {
        next.deal_valor_contrato = null
      }

      if (shouldSetInstallments) {
        next.deal_parcelas = defaultInstallments
      } else if (!serviceName) {
        next.deal_parcelas = null
      }

      return next
    })

    const nextInstallments = shouldSetInstallments
      ? defaultInstallments
      : service
        ? form.deal_parcelas ?? null
        : null

    if (!serviceName) {
      setParcelValue(null)
      return
    }

    if (nextInstallments && nextInstallments > 0) {
      const contractValue = shouldSetDefault ? defaultValue ?? 0 : parseCurrency(form.deal_valor_contrato ?? null)
      if (contractValue > 0) {
        setParcelValue(contractValue / nextInstallments)
      } else {
        setParcelValue(null)
      }
    }
  }

  const buildDealPersistPayload = useCallback(() => {
    if (!deal) return null

    const normalizedForm = normalizeFormState(form)
    const rawValue = normalizedForm.deal_valor_contrato ?? null
    const numericValue =
      rawValue !== null && rawValue !== undefined && rawValue !== ''
        ? parseCurrency(rawValue as string | number | null | undefined)
        : null
    const normalizedStatus: DealRecord['deal_status'] =
      contractStatus ??
      (normalizedForm.deal_status as DealRecord['deal_status'] | null | undefined) ??
      (deal.deal_status as DealRecord['deal_status'] | null | undefined) ??
      'negocio_novo'

    return {
      id: deal.id,
      ...normalizedForm,
      deal_valor_contrato: numericValue,
      deal_status: normalizedStatus,
    } as Partial<DealRecord> & { id: string }
  }, [deal, form, normalizeFormState, contractStatus])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!deal) return

    setIsSaving(true)
    setError(null)

    const payload = buildDealPersistPayload()
    if (!payload) {
      setIsSaving(false)
      setError('Não foi possível preparar os dados para salvar o negócio.')
      return
    }

    try {
      await onSave(payload)
      setForm(normalizeFormState(payload))
      if (draftStorageKey && typeof window !== 'undefined') {
        sessionStorage.removeItem(draftStorageKey)
      }
      onClose()
    } catch (error) {
      console.error(error)
      setError((error as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const resolveVariableValue = useCallback(
    (variable: ContractTemplateWithVariables['variables'][number], fallbackKey: string): string => {
      const column = variable.column_name ?? fallbackKey

      if (variable.source === 'deal') {
        const dealValue = (form as Record<string, unknown> | undefined)?.[column]
        if (dealValue === null || dealValue === undefined) return ''
        return typeof dealValue === 'string' ? dealValue : String(dealValue)
      }

      if (variable.source === 'lead') {
        const leadValue = leadData ? (leadData[column] as unknown) : undefined
        if (leadValue === null || leadValue === undefined) return ''
        return typeof leadValue === 'string' ? leadValue : String(leadValue)
      }

      if (variable.source === 'custom') {
        return variable.column_name ?? ''
      }

      return ''
    },
    [form, leadData],
  )

  const buildTemplatePlainString = useCallback(
    (template: ContractTemplateWithVariables, highlights: HighlightMap) => {
      if (!template.template_body) return ''

      return template.template_body.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
        const normalizedKey = normalizeVariableKey(`{{${key}}}`)
        const entry = highlights[normalizedKey]
        if (!entry) return ''
        return entry.value
      })
    },
    [normalizeVariableKey],
  )

  const applyHighlightsToHtml = useCallback((html: string, highlights: HighlightMap) => {
    if (!html) return html

    try {
      const highlightedByMarkers = new Set<string>()
      let markersReplaced = false
      const initialHtml = html.replace(MARKER_REGEX, (match, encodedKey, markerContent) => {
        let key = String(encodedKey)
        try {
          key = decodeURIComponent(String(encodedKey))
        } catch {
          key = String(encodedKey)
        }

        const entry = highlights[key]
        if (!entry) {
          return markerContent
        }

        highlightedByMarkers.add(key)
        markersReplaced = true
        return createHighlightSpan(entry, key)
      })

      const parser = new DOMParser()
      const parsed = parser.parseFromString(initialHtml, 'text/html')
      const entries = Object.entries(highlights).filter(([, entry]) => entry.value && entry.value.trim())

      if (!markersReplaced) {
        for (const [key, entry] of entries) {
          const alreadyHighlighted = highlightedByMarkers.has(key)
          if (alreadyHighlighted) {
            continue
          }

          const placeholderRegex = new RegExp(`{{\\s*${escapeRegex(key)}\\s*}}`, 'gi')
          if (placeholderRegex.test(parsed.body.innerHTML)) {
            parsed.body.innerHTML = parsed.body.innerHTML.replace(placeholderRegex, createHighlightSpan(entry, key))
            continue
          }

          const walker = parsed.createTreeWalker(parsed.body, NodeFilter.SHOW_TEXT)
          let node: Node | null = walker.nextNode()
          while (node) {
            const textNode = node as Text
            if (textNode.parentElement && textNode.parentElement.classList.contains(HIGHLIGHT_CLASS)) {
              node = walker.nextNode()
              continue
            }
            if (
              textNode.parentElement &&
              textNode.parentElement.classList.contains('crm-highlighted-value--missing')
            ) {
              node = walker.nextNode()
              continue
            }

            const content = textNode.nodeValue ?? ''
            const index = content.indexOf(entry.value)
            if (index !== -1) {
              const range = parsed.createRange()
              range.setStart(textNode, index)
              range.setEnd(textNode, index + entry.value.length)
              const span = parsed.createElement('span')
              span.className = entry.isMissing ? HIGHLIGHT_MISSING_CLASS : HIGHLIGHT_CLASS
              span.setAttribute('data-variable', key)
              span.textContent = entry.value
              range.deleteContents()
              range.insertNode(span)
              break
            }
            node = walker.nextNode()
          }
        }
      }

      return parsed.body.innerHTML
    } catch (error) {
      console.warn('Não foi possível destacar variáveis no HTML renderizado', error)
      return html
    }
  }, [])

  const resolveTemplateVariables = useCallback(
    (template: ContractTemplateWithVariables) => {
      const flatValues: Record<string, string> = {}
      const dealValues: Record<string, string> = {}
      const leadValues: Record<string, string> = {}
      const highlightValues: HighlightMap = {}
      const replacementValues: ReplacementMap = {}

      const normalizeKey = (value: string) => normalizeVariableKey(value.includes('{{') ? value : `{{${value}}}`)

      const setValue = (
        key: string,
        raw: unknown,
        options: { source?: 'deal' | 'lead'; column?: string | null } = {},
      ) => {
        const normalizedKey = normalizeKey(key)
        if (!normalizedKey) return

        let formatted = ''

        if (raw !== null && raw !== undefined && raw !== '') {
          if (normalizedKey === 'deal_valor_contrato' || normalizedKey === 'valor_parcela') {
            const numeric = typeof raw === 'number' ? raw : parseCurrency(typeof raw === 'string' ? raw : '')
            formatted = numeric ? formatCurrency(numeric) : ''
          } else if (/^deal_parcela_\d+$/.test(normalizedKey)) {
            formatted = formatParcelDisplay(raw)
          } else if (typeof raw === 'number') {
            formatted = Number.isFinite(raw) ? String(raw) : ''
          } else if (typeof raw === 'string') {
            formatted = raw
          } else if (raw instanceof Date) {
            formatted = raw.toISOString()
          }
        }

        const safeValue = formatted ?? ''
        const trimmed = safeValue.trim()
        const hasValue = Boolean(trimmed)
        const displayValue = hasValue ? safeValue : MISSING_PLACEHOLDER
        const isMissing = !hasValue

        flatValues[normalizedKey] = displayValue
        replacementValues[normalizedKey] = safeValue
        highlightValues[normalizedKey] = {
          value: displayValue,
          isMissing,
        }

        if (options.source === 'deal') {
          const columnKey = options.column ?? normalizedKey
          dealValues[columnKey] = displayValue
          const aliasKey = normalizeKey(`{{deal.${columnKey}}}`)
          replacementValues[aliasKey] = safeValue
        }

        if (options.source === 'lead') {
          const columnKey = options.column ?? normalizedKey
          leadValues[columnKey] = displayValue
          const aliasKey = normalizeKey(`{{lead.${columnKey}}}`)
          replacementValues[aliasKey] = safeValue
        }
      }

      const ensureDealEntries = () => {
        if (!form) return

        Object.entries(form).forEach(([key, value]) => {
          if (!key.startsWith('deal_') && key !== 'parcelas_datas') return

          if (key === 'parcelas_datas') {
            if (!value) return
            const parsed = normalizeParcelSchedule(value)
            if (!parsed) return
            Object.entries(parsed).forEach(([parcelKey, parcelValue]) => {
              if (parcelKey.startsWith('deal_parcela_')) {
                setValue(parcelKey, parcelValue, { source: 'deal', column: parcelKey })
              }
            })
            return
          }

          setValue(key, value, { source: 'deal', column: key })
        })
      }

      const ensureLeadEntries = () => {
        if (!leadData) return

        Object.entries(leadData).forEach(([key, value]) => {
          if (!key.startsWith('lead_')) return
          setValue(key, value, { source: 'lead', column: key })
        })
      }

      ensureDealEntries()
      ensureLeadEntries()

      template.variables.forEach((variable) => {
        const normalizedKey = normalizeKey(variable.variable_key)
        if (!normalizedKey) return

        if (highlightValues[normalizedKey]) return

        const rawValue = resolveVariableValue(variable, normalizedKey)
        if (variable.source === 'deal') {
          setValue(normalizedKey, rawValue, { source: 'deal', column: variable.column_name ?? normalizedKey })
          return
        }

        if (variable.source === 'lead') {
          setValue(normalizedKey, rawValue, { source: 'lead', column: variable.column_name ?? normalizedKey })
          return
        }

        setValue(normalizedKey, rawValue)
      })

      const totalInstallments = typeof form?.deal_parcelas === 'number' ? form.deal_parcelas : null
      if (totalInstallments && totalInstallments > 0) {
        for (let index = 1; index <= totalInstallments; index += 1) {
          const parcelKey = `deal_parcela_${index}`
          if (!highlightValues[parcelKey]) {
            setValue(parcelKey, null, { source: 'deal', column: parcelKey })
          }
        }
      }

      const numericContractValue = parseCurrency(form?.deal_valor_contrato ?? null)
      if (numericContractValue) {
        setValue('deal_valor_contrato', numericContractValue, { source: 'deal', column: 'deal_valor_contrato' })
      }

      const installments = totalInstallments && totalInstallments > 0 ? totalInstallments : null
      const computedParcelValue = parcelValue ?? (installments ? numericContractValue / installments : null)
      if (computedParcelValue !== null && Number.isFinite(computedParcelValue)) {
        setValue('valor_parcela', computedParcelValue)
      }

      return {
        docxData: {
          ...flatValues,
          deal: dealValues,
          lead: leadValues,
        },
        highlightValues,
        replacementValues,
      }
    },
    [form, leadData, normalizeVariableKey, parcelValue, resolveVariableValue],
  )

  const generateDocxPreviewHtml = useCallback(
    async (templateId: string, dataMap: Record<string, unknown>, highlights: HighlightMap) => {
      if (!templateId || typeof window === 'undefined') return null

      const invokeSignedUrl = () =>
        supabase.functions.invoke<{
          signedUrl?: string
        }>('contract-template-download-url', {
          body: { templateId },
        })

      const resolveSignedUrl = async () => {
        let { data, error } = await invokeSignedUrl()

        if (!error && data?.signedUrl) {
          return data.signedUrl
        }

        const initialStatus = (error as { status?: number } | null)?.status ?? null

        if (initialStatus === 401) {
          const { error: refreshError } = await supabase.auth.refreshSession()

          if (refreshError) {
            console.warn('Falha ao atualizar sessão antes de gerar URL assinada para template', {
              templateId,
              refreshError,
            })
            throw new Error(CONTRACT_PREVIEW_UNAUTHORIZED_ERROR)
          }

          ;({ data, error } = await invokeSignedUrl())

          if (!error && data?.signedUrl) {
            return data.signedUrl
          }

          const retryStatus = (error as { status?: number } | null)?.status ?? null
          if (retryStatus === 401) {
            throw new Error(CONTRACT_PREVIEW_UNAUTHORIZED_ERROR)
          }
        }

        console.warn('Falha ao gerar URL assinada para template', { templateId, signedUrlError: error })
        return null
      }

      try {
        const signedUrl = await resolveSignedUrl()

        if (!signedUrl) {
          return null
        }

        const response = await fetch(signedUrl)
        if (!response.ok) {
          console.warn('Falha ao baixar DOCX com URL assinada', { templateId, status: response.status })
          return null
        }

        const arrayBuffer = await response.arrayBuffer()

        const [{ default: PizZip }, { renderAsync }] = await Promise.all([
          import('pizzip'),
          import('docx-preview'),
        ])

        let processedBuffer = arrayBuffer

        try {
          const sourceZip = new PizZip(arrayBuffer)
          const fixedZip = new PizZip()
          const replacementDictionary = buildDocxReplacementDictionary(dataMap)

          const allFiles = sourceZip.file(/.*/)

          for (const file of allFiles) {
            const fileName = file.name

            if (/word\/(document|header\d*|footer\d*)\.xml/.test(fileName)) {
              const xmlContent = file.asText()
              const fixedXml = fixFragmentedPlaceholdersInXml(xmlContent)
              const replacedXml = replaceDocxPlaceholders(fixedXml, replacementDictionary)
              fixedZip.file(fileName, replacedXml)
            } else {
              fixedZip.file(fileName, file.asUint8Array())
            }
          }

          processedBuffer = fixedZip.generate({
            type: 'arraybuffer',
          }) as ArrayBuffer
        } catch (processingError) {
          console.warn('Falha ao preparar DOCX para substituição de variáveis.', processingError)
        }

        const container = document.createElement('div')

        await renderAsync(processedBuffer, container, undefined, {
          inWrapper: false,
          ignoreLastRenderedPageBreak: true,
        })

        const highlightedHtml = applyHighlightsToHtml(container.innerHTML, highlights)
        container.remove()
        return highlightedHtml
      } catch (error) {
        if (error instanceof Error && error.message === CONTRACT_PREVIEW_UNAUTHORIZED_ERROR) {
          throw error
        }
        console.warn('Falha ao gerar pré-visualização DOCX', error)
        return null
      }
    },
    [applyHighlightsToHtml],
  )

  const handleGeneratePreview = useCallback(
    async (options?: { openPreview?: boolean }): Promise<{ raw: string; html: string } | null> => {
      const template = templates.find((item) => item.id === selectedTemplateId)

      if (!template) {
        setPreviewError('Selecione um template para gerar o contrato.')
        return null
    }

    if (!template.template_body && !template.storage_path) {
      setPreviewError('O template selecionado não possui conteúdo de pré-visualização.')
      return null
    }

    setIsPreviewLoading(true)

    try {
      const { docxData, highlightValues } = resolveTemplateVariables(template)
      const plainTemplate = template.template_body
        ? buildTemplatePlainString(template, highlightValues)
        : ''
      let previewRaw = plainTemplate
      let html: string | null = null

      if (template.storage_path) {
        const docxHtml = await generateDocxPreviewHtml(template.id, docxData, highlightValues)
        if (docxHtml) {
          previewRaw = docxHtml
          html = docxHtml
        }
      }

      if (!html && plainTemplate) {
        const converted = convertPreviewToHtml(plainTemplate)
        if (converted) {
          html = applyHighlightsToHtml(converted, highlightValues)
          previewRaw = plainTemplate
        }
      }

      if (!html) {
        setPreviewContent(null)
        setPreviewTitle(template.nome)
        setPreviewError('Não encontramos conteúdo para gerar a pré-visualização.')
        return null
      }

      setPreviewTitle(template.nome)
      setPreviewContent({ raw: previewRaw, html })
      setPreviewError(null)
      if (options?.openPreview) {
        setIsPreviewModalOpen(true)
      }
      return { raw: previewRaw, html }
    } catch (error) {
      if (error instanceof Error && error.message === CONTRACT_PREVIEW_UNAUTHORIZED_ERROR) {
        setPreviewError('Sua sessão expirou. Faça login novamente.')
      } else {
        console.error(error)
        setPreviewError('Não foi possível gerar a pré-visualização do contrato.')
      }
      return null
    } finally {
      setIsPreviewLoading(false)
    }
  }, [
    applyHighlightsToHtml,
    buildTemplatePlainString,
    convertPreviewToHtml,
    generateDocxPreviewHtml,
    resolveTemplateVariables,
    selectedTemplateId,
    templates,
  ])

  useEffect(() => {
    if (!previewContent?.html) {
      setIsPreviewModalOpen(false)
    }
  }, [previewContent])

  const handleSendContract = async () => {
    if (!selectedTemplateId) {
      setPreviewError('Selecione um template para enviar ao Autentique.')
      return
    }

    const hasSigner = signers.some((participant) => participant.role === 'SIGNER')
    if (!hasSigner) {
      setPreviewError('Adicione pelo menos um signatário antes de enviar o contrato.')
      return
    }

    const template = templates.find((item) => item.id === selectedTemplateId)
    if (!template) {
      setPreviewError('Template selecionado não encontrado.')
      return
    }

    let currentPreview = previewContent
    if (!currentPreview?.html) {
      const generated = await handleGeneratePreview({ openPreview: false })
      if (!generated) {
        setPreviewError('Gere a pré-visualização do contrato antes de enviar ao Autentique.')
        return
      }
      currentPreview = generated
    }

    const preparedSigners = [] as Array<{
      id: string
      name: string
      email: string | null
      phone: string | null
      cpf: string | null
      deliveryMethod: SignerDeliveryMethod
      role: SignerRole
      fields: SignatureField[]
    }>

    for (const signer of signers) {
      const participantLabel = signer.role === 'WITNESS' ? 'testemunha' : 'signatário'
      const participantDisplay = signer.role === 'WITNESS' ? 'A testemunha' : 'O signatário'
      const trimmedName = signer.name.trim()
      if (!trimmedName) {
        setPreviewError(`Informe o nome de cada ${participantLabel}.`)
        return
      }

      const method = signer.deliveryMethod
      const normalizedEmailRaw = signer.email.trim() || null
      const normalizedEmail = method === 'email' ? normalizedEmailRaw : null
      const normalizedPhone = method === 'sms' || method === 'whatsapp'
        ? normalizePhoneForAutentique(signer.phone)
        : null
      const normalizedCpf = signer.cpf.replace(/\D/g, '') || null

      if (signer.deliveryMethod === 'email' && !normalizedEmail) {
        setPreviewError(`${participantDisplay} "${trimmedName}" precisa de um email para o método selecionado.`)
        return
      }

      if ((signer.deliveryMethod === 'sms' || signer.deliveryMethod === 'whatsapp') && !normalizedPhone) {
        setPreviewError(`${participantDisplay} "${trimmedName}" precisa de um telefone válido com DDI 55 (ex.: +5511999999999).`)
        return
      }

      preparedSigners.push({
        id: signer.id,
        name: trimmedName,
        email: normalizedEmail,
        phone: normalizedPhone,
        cpf: normalizedCpf && normalizedCpf.length === 11 ? normalizedCpf : null,
        deliveryMethod: signer.deliveryMethod,
        role: signer.role,
        fields: [],
      })
    }

    const persistPayload = buildDealPersistPayload()
    if (!persistPayload) {
      setPreviewError('Não foi possível preparar os dados do negócio antes do envio.')
      return
    }
    const payloadWithStatus: Partial<DealRecord> & { id: string } = {
      ...persistPayload,
      deal_status: 'contrato_enviado',
    }

    setIsSendingContract(true)
    setPreviewError(null)

    let previewRawForStorage = currentPreview?.raw ?? null
    let previewTitleForStorage = previewTitle ?? template.nome
    let previewModalForStorage = isPreviewModalOpen
    let persistedFormSnapshot: Partial<DealRecord> | null = null

    try {
      try {
        await onSave(payloadWithStatus)
        persistedFormSnapshot = normalizeFormState(payloadWithStatus)
        setForm(persistedFormSnapshot)
      } catch (persistError) {
        console.error('[DealDrawer] Falha ao sincronizar negócio antes do envio', persistError)
        throw new Error('Não foi possível salvar os dados do negócio antes de enviar o contrato.')
      }

      const dealSnapshot = { ...payloadWithStatus }
      delete (dealSnapshot as { id?: string }).id

      console.debug('[DealDrawer] Prepared signers payload', {
        dealId: deal?.id,
        templateId: selectedTemplateId,
        signers: preparedSigners,
      })
      const { data, error } = await supabase.functions.invoke('autentique-send-contract', {
        body: {
          dealId: deal?.id,
          templateId: selectedTemplateId,
          previewHtml: currentPreview?.html ?? null,
          signers: preparedSigners.map((signer) => ({
            name: signer.name,
            email: signer.email,
            phone: signer.phone,
            cpf: signer.cpf,
            deliveryMethod: signer.deliveryMethod,
            role: signer.role,
            fields: [],
          })),
          sortable: signersOrdered,
          dealSnapshot,
        },
      })

      if (error) {
        console.error('[DealDrawer] Supabase Edge error', error)
        const context = (error as unknown as { context?: unknown }).context
        const contextMessage =
          typeof context === 'string'
            ? context
            : typeof context === 'object' && context !== null && 'error' in context && typeof (context as { error?: unknown }).error === 'string'
              ? ((context as { error?: string }).error as string)
              : null

        const nextMessage =
          contextMessage && contextMessage.trim()
            ? contextMessage.trim()
            : error.message && error.message !== 'Edge Function returned a non-2xx status code'
              ? error.message
              : 'Erro ao enviar contrato.'

        throw new Error(nextMessage)
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      if (data?.preview) {
        const previewRaw = data.preview as string
        const html = convertPreviewToHtml(previewRaw)
        previewTitleForStorage = template?.nome ?? previewTitle ?? null
        setPreviewTitle(previewTitleForStorage)

        if (html) {
          setPreviewContent({ raw: previewRaw, html })
          previewRawForStorage = previewRaw
        } else {
          setPreviewContent(null)
          previewRawForStorage = null
          setIsPreviewModalOpen(false)
          previewModalForStorage = false
        }
      }

      setContractStatus('contrato_enviado')
      if (draftStorageKey && typeof window !== 'undefined') {
        const normalizedPersistedForm = persistedFormSnapshot ?? normalizeFormState(payloadWithStatus)
        sessionStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            form: normalizedPersistedForm,
            parcelValue,
            selectedTemplateId,
            previewContent: previewRawForStorage,
            previewTitle: previewTitleForStorage,
            contractStatus: 'contrato_enviado',
            isPreviewModalOpen: previewModalForStorage,
            signers: signers.map((signerItem) => ({
              id: signerItem.id,
              name: signerItem.name,
              email: signerItem.email,
              phone: signerItem.phone,
              cpf: signerItem.cpf,
              deliveryMethod: signerItem.deliveryMethod,
              fields: [],
            })),
            signersOrdered,
            activeSignerId,
          }),
        )
      }

      setIsDesignerOpen(false)
      const firstName = (deal?.deal_first_name ?? deal?.deal_full_name?.split(/\s+/)[0] ?? '').trim()
      const displayName = firstName ? firstName : 'o cliente'

      toast({
        title: `Documento enviado com sucesso para ${displayName}!`,
        variant: 'success',
      })
    } catch (error) {
      console.error(error)
      setPreviewError((error as Error).message)
    } finally {
      setIsSendingContract(false)
    }
  }

  if (!open || !deal) return null

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.drawer}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>Detalhes do negócio</h2>
            <p className={styles.subtitle}>{deal.deal_full_name ?? 'Sem nome definido'}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            Fechar
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Dados pessoais</h3>
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>Nome</span>
                <input
                  value={form.deal_full_name ?? ''}
                  onChange={(event) => handleChange('deal_full_name', event.target.value)}
                  placeholder="Nome completo"
                />
              </label>
              <label className={styles.field}>
                <span>CPF</span>
                <input
                  value={form.deal_cpf ?? ''}
                  onChange={(event) => handleChange('deal_cpf', formatCPF(event.target.value))}
                  placeholder="000.000.000-00"
                />
              </label>
              <label className={styles.field}>
                <span>Data de nascimento</span>
                <input
                  type="date"
                  value={toDateInputValue(form.data_nascimento ?? null)}
                  onChange={(event) => handleChange('data_nascimento', event.target.value || null)}
                />
              </label>
              <label className={styles.field}>
                <span>RG</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.deal_rg ?? ''}
                  onChange={(event) => handleChange('deal_rg', formatRG(event.target.value))}
                />
              </label>
              <label className={styles.field}>
                <span>Telefone</span>
                <input
                  value={form.deal_phone ?? ''}
                  onChange={(event) => handleChange('deal_phone', formatPhone(event.target.value))}
                  placeholder="(00) 00000-0000"
                />
              </label>
              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={form.deal_email ?? ''}
                  onChange={(event) => handleChange('deal_email', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Endereço</h3>
            <div className={styles.gridThree}>
              <label className={styles.field}>
                <span>CEP</span>
                <input
                  value={form.deal_cep ?? ''}
                  onChange={(event) => handleChange('deal_cep', formatCEP(event.target.value))}
                  placeholder="00000-000"
                />
              </label>
              <label className={styles.field}>
                <span>Rua</span>
                <input
                  value={form.deal_rua ?? ''}
                  onChange={(event) => handleChange('deal_rua', event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Número</span>
                <input
                  value={form.deal_numero ?? ''}
                  onChange={(event) => handleChange('deal_numero', event.target.value)}
                />
              </label>
            </div>
            <div className={styles.gridThree}>
              <label className={styles.field}>
                <span>Bairro</span>
                <input
                  value={form.deal_bairro ?? ''}
                  onChange={(event) => handleChange('deal_bairro', event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Cidade</span>
                <select
                  value={form.deal_cidade ?? ''}
                  onChange={(event) => handleChange('deal_cidade', event.target.value || null)}
                  disabled={!form.deal_estado || isLoadingCities}
                >
                  <option value="">
                    {!form.deal_estado
                      ? 'Selecione um estado primeiro'
                      : isLoadingCities
                        ? 'Carregando cidades...'
                        : 'Selecione uma cidade'}
                  </option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Estado</span>
                <select
                  value={form.deal_estado ?? ''}
                  onChange={(event) => handleChange('deal_estado', event.target.value || null)}
                >
                  <option value="">Selecione um estado</option>
                  {BRAZILIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Informações comerciais</h3>
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>Serviço</span>
                <select
                  value={form.deal_servico ?? ''}
                  onChange={(event) => handleServiceChange(event.target.value)}
                >
                  <option value="">Selecione um serviço</option>
                  {[...services, SERVICE_FALLBACK].map((service) => (
                    <option key={service.id} value={service.nome}>
                      {service.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Valor do contrato</span>
                <input
                  value={
                    form.deal_valor_contrato !== null && form.deal_valor_contrato !== undefined
                      ? formatCurrency(parseCurrency(form.deal_valor_contrato ?? null))
                      : ''
                  }
                  onChange={(event) => handleChange('deal_valor_contrato', event.target.value)}
                  onBlur={() => {
                    const numeric = parseCurrency(form.deal_valor_contrato ?? null)
                    handleChange('deal_valor_contrato', numeric)
                    if (form.deal_parcelas && form.deal_parcelas > 0) {
                      setParcelValue(numeric / form.deal_parcelas)
                    }
                  }}
                  placeholder="R$ 0,00"
                />
              </label>
            </div>
            <div className={styles.gridThree}>
              <label className={styles.field}>
                <span>Forma de pagamento</span>
                <select
                  value={form.deal_forma_pagamento ?? ''}
                  onChange={(event) => handleChange('deal_forma_pagamento', event.target.value)}
                >
                  <option value="">Selecione</option>
                  {availablePaymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Parcelas</span>
                <input
                  type="number"
                  min={1}
                  max={maxInstallments}
                  value={form.deal_parcelas ?? ''}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    handleChange('deal_parcelas', Number.isNaN(value) ? null : value)
                    const contractValue = parseCurrency(form.deal_valor_contrato ?? null)
                    if (value > 0) {
                      setParcelValue(contractValue / value)
                    } else {
                      setParcelValue(null)
                    }
                  }}
                />
              </label>
              <label className={styles.field}>
                <span>Valor parcela</span>
                <input value={parcelValue ? formatCurrency(parcelValue) : ''} readOnly />
              </label>
            </div>
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>Data primeira parcela</span>
                <input
                  type="date"
                  value={toDateInputValue(form.data_primeira_parcela)}
                  onChange={(event) => handleChange('data_primeira_parcela', event.target.value || null)}
                />
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Documentos</h3>
            <div className={styles.gridTwo}>
              <FileUploadField
                bucket="arquivos_deals"
                dealId={deal.id}
                dealName={dealNameForStorage}
                dealCpf={dealCpfForStorage}
                label="Documento frente"
                fieldValue={form.deal_documento_frente ?? null}
                onUploaded={(path) => handleChange('deal_documento_frente', path)}
                accept="image/*,application/pdf"
              />
              <FileUploadField
                bucket="arquivos_deals"
                dealId={deal.id}
                dealName={dealNameForStorage}
                dealCpf={dealCpfForStorage}
                label="Documento verso"
                fieldValue={form.deal_documento_verso ?? null}
                onUploaded={(path) => handleChange('deal_documento_verso', path)}
                accept="image/*,application/pdf"
              />
              <FileUploadField
                bucket="arquivos_deals"
                dealId={deal.id}
                dealName={dealNameForStorage}
                dealCpf={dealCpfForStorage}
                label="Comprovante de residência"
                fieldValue={form.deal_comprovante_residencia ?? null}
                onUploaded={(path) => handleChange('deal_comprovante_residencia', path)}
                accept="image/*,application/pdf"
              />
              <FileUploadField
                bucket="arquivos_deals"
                dealId={deal.id}
                dealName={dealNameForStorage}
                dealCpf={dealCpfForStorage}
                label="Cópia do contrato assinado"
                fieldValue={form.deal_copia_contrato_assinado ?? null}
                onUploaded={(path) => handleChange('deal_copia_contrato_assinado', path)}
                accept="application/pdf,image/*"
              />
              <FileUploadField
                bucket="audios_deals"
                dealId={deal.id}
                dealName={dealNameForStorage}
                dealCpf={dealCpfForStorage}
                label="Áudio"
                fieldValue={form.deal_audio ?? null}
                onUploaded={(path) => handleChange('deal_audio', path)}
                accept="audio/*"
              />
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Contratos</h3>
            {templatesError ? <p className={styles.error}>{templatesError}</p> : null}
            <div className={styles.contractGrid}>
              <div className={styles.contractStatus}>
                <span className={styles.previewLabel}>Status do contrato</span>
                <span className={`${styles.contractStatusBadge} ${contractStatusToneClass}`}>
                  {contractStatusDisplay.label}
                </span>
                {contractStatus === 'contrato_rejeitado' && contractRejectionReason ? (
                  <div className={styles.contractStatusReason}>
                    <span className={styles.previewLabel}>Motivo da rejeição</span>
                    <p className={styles.contractStatusReasonText}>{contractRejectionReason}</p>
                  </div>
                ) : null}
              </div>
              <label className={styles.field}>
                <span>Template</span>
                <select
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  disabled={templatesLoading || templates.length === 0}
                >
                  <option value="">Selecione um template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.nome}
                    </option>
                  ))}
                </select>
              </label>

              <div className={`${styles.previewBox} ${styles.contractPreview}`}>
                <header className={styles.previewHeader}>
                  <div>
                    <span className={styles.previewLabel}>Pré-visualização</span>
                    <h4 className={styles.previewTitle}>
                      {hasPreview ? previewTitle ?? 'Contrato' : 'Nenhuma pré-visualização disponível'}
                    </h4>
                  </div>
                  <div className={styles.previewActions}>
                    <button
                      type="button"
                      className={styles.previewGenerateButton}
                      onClick={() => {
                        void handleGeneratePreview()
                      }}
                      disabled={isPreviewLoading}
                    >
                      {isPreviewLoading ? 'Gerando...' : 'Gerar pré-visualização'}
                    </button>
                    <button
                      type="button"
                      className={styles.previewOpenButton}
                      onClick={() => setIsPreviewModalOpen(true)}
                      disabled={!hasPreview}
                    >
                      Abrir pré-visualização
                    </button>
                  </div>
                </header>
                <p className={styles.previewHint}>
                  {hasPreview
                    ? 'Visualize o contrato preenchido em uma janela dedicada.'
                    : 'Gere uma pré-visualização para revisar o documento antes de enviar.'}
                </p>
              </div>

              {previewError ? <p className={`${styles.error} ${styles.contractPreviewError}`}>{previewError}</p> : null}

              <div className={`${styles.signatureDesignerCallout} ${styles.contractCallout}`}>
                <div>
                  <span className={styles.previewLabel}>Configuração de assinaturas</span>
                  <p className={styles.previewHint}>
                    Defina signatários, testemunhas, métodos de envio e campos diretamente na pré-visualização do documento.
                  </p>
                  <p className={styles.previewHint}>
                    Signatários: {participantCounts.signerTotal} · Testemunhas: {participantCounts.witnessTotal}
                  </p>
                </div>
                <div className={styles.signatureActions}>
                  <button type="button" className={styles.secondaryButton} onClick={handleOpenDesigner}>
                    Configurar assinaturas
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleSendContract}
                    disabled={isSendingContract || !selectedTemplateId}
                  >
                    {isSendingContract ? 'Enviando...' : 'Enviar Contrato'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {error ? <p className={styles.error}>{error}</p> : null}

          <footer className={styles.footer}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.primaryButton} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </footer>
        </form>
      </div>
      {isDesignerOpen && previewContent?.html ? (
        <div className={styles.designerBackdrop} role="dialog" aria-modal="true">
          <div className={styles.designerContainer}>
            <aside className={styles.designerSidebar}>
              <header className={styles.designerSidebarHeader}>
                <div>
                  <span className={styles.previewLabel}>Informe os participantes</span>
                  <h4 className={styles.designerSidebarTitle}>Sem ordem ou com ordem definida</h4>
                </div>
                <button type="button" className={styles.designerCloseButton} onClick={handleCloseDesigner}>
                  Fechar
                </button>
              </header>

              <div className={styles.designerOrderToggle}>
                <button
                  type="button"
                  className={`${styles.designerToggleButton} ${!signersOrdered ? styles.designerToggleButtonActive : ''}`}
                  onClick={() => setSignersOrdered(false)}
                >
                  Sem ordem
                </button>
                <button
                  type="button"
                  className={`${styles.designerToggleButton} ${signersOrdered ? styles.designerToggleButtonActive : ''}`}
                  onClick={() => setSignersOrdered(true)}
                >
                  Com ordem
                </button>
              </div>

              <button type="button" className={styles.addSignerButton} onClick={handleAddSigner}>
                + Adicionar signatário
              </button>
              <button type="button" className={styles.addSignerButton} onClick={handleAddWitness}>
                + Adicionar testemunha
              </button>

              <div className={styles.signersList}>
                {signers.map((signer) => {
                  const meta = participantMetadata.get(signer.id)
                  const displayLabel = meta?.displayLabel ?? 'Participante'
                  const colorVars: CSSProperties | undefined = meta?.color
                    ? {
                        '--participant-border': meta.color.border,
                        '--participant-background': meta.color.background,
                        '--participant-badge-bg': meta.color.badgeBackground,
                        '--participant-badge-color': meta.color.badgeColor,
                        '--participant-shadow': meta.color.shadow,
                      }
                    : undefined
                  const isWitness = signer.role === 'WITNESS'

                  return (
                    <div
                      key={signer.id}
                      className={`${styles.signerCard} ${activeSigner?.id === signer.id ? styles.signerCardActive : ''}`}
                      onClick={() => handleSignerSelect(signer.id)}
                      style={colorVars as CSSProperties}
                    >
                      <div className={styles.signerCardHeader}>
                        <div className={styles.signerCardTitle}>
                          <span className={styles.signerIndex}>{displayLabel}</span>
                          <span
                            className={`${styles.signerRoleBadge} ${isWitness ? styles.signerRoleBadgeWitness : styles.signerRoleBadgeSigner}`}
                          >
                            {isWitness ? 'Testemunha' : 'Signatário'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={styles.removeSignerButton}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleRemoveSigner(signer.id)
                          }}
                        >
                          Remover
                        </button>
                      </div>
                      <label className={styles.field}>
                        <span>Nome completo</span>
                        <input
                          value={signer.name}
                          onChange={(event) => handleSignerChange(signer.id, { name: event.target.value })}
                        />
                      </label>
                      <label
                        className={`${styles.field} ${meta?.deliveryMethod === 'email' ? '' : styles.fieldHidden}`}
                      >
                        <span>Email</span>
                        <input
                          type="email"
                          value={signer.email}
                          onChange={(event) => handleSignerChange(signer.id, { email: event.target.value })}
                          placeholder="participante@dominio.com"
                        />
                      </label>
                      <label
                        className={`${styles.field} ${meta?.deliveryMethod === 'sms' || meta?.deliveryMethod === 'whatsapp' ? '' : styles.fieldHidden}`}
                      >
                        <span>Telefone</span>
                        <input
                          value={formatPhone(signer.phone)}
                          onChange={(event) => handleSignerChange(signer.id, { phone: formatPhone(event.target.value) })}
                          placeholder="(00) 00000-0000"
                        />
                      </label>
                      <label className={styles.field}>
                        <span>CPF</span>
                        <input
                          value={formatCPF(signer.cpf)}
                          onChange={(event) => handleSignerCpfChange(signer.id, event.target.value)}
                          placeholder="000.000.000-00"
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Método de envio</span>
                        <select
                          value={signer.deliveryMethod}
                          onChange={(event) => handleSignerChange(signer.id, {
                            deliveryMethod: event.target.value as SignerDeliveryMethod,
                          })}
                        >
                          {DELIVERY_METHOD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )
                })}
              </div>

            </aside>

            <div className={styles.designerPreviewColumn}>
              <header className={styles.designerPreviewHeader}>
                <div>
                  <span className={styles.previewLabel}>Pré-visualização</span>
                  <h4 className={styles.previewTitle}>{previewTitle ?? 'Contrato'}</h4>
                </div>
                <button type="button" className={styles.designerCloseButton} onClick={handleCloseDesigner}>
                  Fechar
                </button>
              </header>
              <div className={styles.designerPreviewSurface} ref={designerPreviewRef}>
                <div className={styles.designerPreviewDocumentWrapper} ref={designerDocumentWrapperRef}>
                  <div
                    className={styles.designerPreviewDocument}
                    ref={designerDocumentRef}
                    dangerouslySetInnerHTML={{ __html: previewContent.html }}
                  />
                </div>
              </div>

              <div className={styles.designerFooter}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleSendContract}
                  disabled={isSendingContract || !selectedTemplateId}
                >
                  {isSendingContract ? 'Enviando...' : 'Enviar Contrato'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {previewContent?.html && isPreviewModalOpen ? (
        <div
          className={styles.previewModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label={previewTitle ?? 'Pré-visualização do contrato'}
          onClick={() => setIsPreviewModalOpen(false)}
        >
          <div
            className={styles.previewModal}
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <header className={styles.previewModalHeader}>
              <div>
                <span className={styles.previewLabel}>Pré-visualização</span>
                <h4 className={styles.previewTitle}>{previewTitle ?? 'Contrato'}</h4>
              </div>
              <button
                type="button"
                className={styles.previewCloseButton}
                onClick={() => setIsPreviewModalOpen(false)}
              >
                Fechar
              </button>
            </header>
            <div className={styles.previewDocument} dangerouslySetInnerHTML={{ __html: previewContent.html }} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
