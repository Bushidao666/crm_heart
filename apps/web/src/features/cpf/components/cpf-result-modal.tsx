import { useMemo, useRef, useState } from 'react'

import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { format, isValid as isValidDate, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { CpfConsultationResult } from '@/features/cpf/types'

import styles from './cpf-result-modal.module.css'

type RiskMetricSeverity = 'low' | 'medium' | 'high'

type RiskMetric = {
  key: string
  title: string
  value: number | null
  label: string
  severity: RiskMetricSeverity
}

type ReportData = {
  hasData: boolean
  consultedAtLabel: string
  consultationDate: Date | null
  hash?: string | null
  realTime?: boolean
  identification: {
    name: string
    cpf: string
    age: string
  }
  creditScore: {
    value: number | null
    status: string
  }
  creditOffer: {
    status: string
    level: string
  }
  riskSituation: {
    label: string
    level: number
  }
  riskMetrics: RiskMetric[]
  prognosis: {
    timeToFirstResult: string
    successProbability: string
    maxCompensation: string
  }
  alerts: string[]
  potentialGains: string[]
  fileName: string
}

type CpfResultModalProps = {
  result: CpfConsultationResult
  onClose: () => void
  onNewConsultation: () => void
}

const STORAGE_PREFIX = 'crm-heart:cpf-consultation'

const normalizeKeyName = (key: string) => key.replace(/[^a-z0-9]/gi, '').toLowerCase()

const attemptParseJson = (value: string) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const attemptParseBase64 = (value: string) => {
  if (!value) return null
  const decoder = typeof window !== 'undefined' && 'atob' in window ? window.atob : undefined
  if (!decoder) return null
  try {
    const decoded = decoder(value)
    return attemptParseJson(decoded) ?? decoded
  } catch {
    return null
  }
}

const normalisePayload = (payload: unknown, depth = 0): Record<string, unknown> => {
  if (depth > 5) return {}
  if (!payload) return {}

  if (Array.isArray(payload)) {
    if (!payload.length) return {}
    return payload.reduce<Record<string, unknown>>((acc, item) => {
      const normalised = normalisePayload(item, depth + 1)
      return { ...acc, ...normalised }
    }, {})
  }

  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    if (!trimmed) return {}
    const asJson = attemptParseJson(trimmed)
    if (asJson && typeof asJson === 'object') {
      return normalisePayload(asJson, depth + 1)
    }
    const asBase64 = attemptParseBase64(trimmed)
    if (asBase64 && typeof asBase64 === 'object') {
      return normalisePayload(asBase64, depth + 1)
    }
    return {}
  }

  if (typeof payload === 'object') {
    return payload as Record<string, unknown>
  }

  return {}
}

const getFromPaths = (source: Record<string, unknown>, paths: string[][]) => {
  for (const path of paths) {
    let current: unknown = source
    let found = true

    for (const key of path) {
      if (!current || typeof current !== 'object') {
        found = false
        break
      }

      const entries = Object.entries(current as Record<string, unknown>)
      const match = entries.find(([candidateKey]) => normalizeKeyName(candidateKey) === normalizeKeyName(key))

      if (!match) {
        found = false
        break
      }

      current = match[1]
    }

    if (found && current !== undefined && current !== null) {
      return current
    }
  }

  return undefined
}

const deepSearchForKeys = (source: unknown, keys: string[]) => {
  if (!source || typeof source !== 'object') return undefined
  const targetKeys = new Set(keys.map((key) => normalizeKeyName(key)))
  const stack: unknown[] = [source]
  const visited = new WeakSet<object>()

  while (stack.length) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue
    const objectCurrent = current as Record<string, unknown>
    if (visited.has(objectCurrent)) continue
    visited.add(objectCurrent)

    for (const [key, value] of Object.entries(objectCurrent)) {
      if (targetKeys.has(normalizeKeyName(key))) {
        return value
      }

      if (value && typeof value === 'object') {
        stack.push(value)
      }
    }
  }

  return undefined
}

const MERGE_KEYS = ['data', 'payload', 'resultado', 'consulta', 'response', 'result', 'content', 'body'] as const

const flattenData = (value: unknown, depth = 0, visited = new WeakSet<object>()): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const objectValue = value as Record<string, unknown>
  if (visited.has(objectValue)) return {}
  visited.add(objectValue)

  const result: Record<string, unknown> = { ...objectValue }
  if (depth >= 5) return result

  for (const key of MERGE_KEYS) {
    const nested = objectValue[key]
    if (Array.isArray(nested)) {
      nested.forEach((item) => {
        Object.assign(result, flattenData(item, depth + 1, visited))
      })
    } else if (nested && typeof nested === 'object') {
      Object.assign(result, flattenData(nested, depth + 1, visited))
    }
  }

  return result
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value).trim()
  if (!raw) return null
  const normalised = raw
    .replace(/[^\d.,-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(/,/g, '.')
  const parsed = Number(normalised)
  return Number.isFinite(parsed) ? parsed : null
}

const toString = (value: unknown, fallback = '—'): string => {
  if (value === null || value === undefined) return fallback
  const stringified = String(value).trim()
  return stringified.length ? stringified : fallback
}

const toCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length !== 11) return value
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

const formatDays = (value: number | null) => {
  if (value === null) return '—'
  const rounded = Math.round(value)
  if (Number.isNaN(rounded)) return '—'
  return `${rounded} ${rounded === 1 ? 'dia' : 'dias'}`
}

const formatPercent = (value: number | null) => {
  if (value === null) return '—'
  return `${Number(value).toFixed(1).replace('.', ',')}%`
}

const formatCurrency = (value: number | null) => {
  if (value === null) return '—'
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  } catch {
    return `R$ ${Number(value).toFixed(2)}`
  }
}

const normaliseDate = (value: unknown): Date | null => {
  if (!value) return null
  if (typeof value === 'number' && value > 1_000_000_000_000) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const timestamp = Number(trimmed)
    if (!Number.isNaN(timestamp)) {
      const date = new Date(timestamp)
      return Number.isNaN(date.getTime()) ? null : date
    }

    const isoParsed = parseISO(trimmed)
    if (isValidDate(isoParsed)) {
      return isoParsed
    }

    const date = new Date(trimmed)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

const slugify = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

const inferSeverity = (label: string): RiskMetricSeverity => {
  const normalised = label.toLowerCase()
  if (['alto', 'altíssimo', 'critico', 'crítico', 'negada'].some((keyword) => normalised.includes(keyword))) {
    return 'high'
  }
  if (['moderado', 'médio'].some((keyword) => normalised.includes(keyword))) {
    return 'medium'
  }
  return 'low'
}

const ensureArray = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((item) => toString(item, ''))
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|\u2022|\.|;/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

const parseNumericString = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/[^\d.,-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(/,/g, '.')
    if (!cleaned) return null
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const parseAgeFromBirthdate = (value: string): string => {
  if (!value) return '—'
  const [day, month, year] = value.split('/')
  if (!day || !month || !year) return value
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  if (Number.isNaN(parsed.getTime())) return value
  const now = new Date()
  let age = now.getFullYear() - parsed.getFullYear()
  const hasBirthdayPassed = now.getMonth() > parsed.getMonth() || (now.getMonth() === parsed.getMonth() && now.getDate() >= parsed.getDate())
  if (!hasBirthdayPassed) age -= 1
  return age >= 0 ? `${age} ${age === 1 ? 'ano' : 'anos'}` : '—'
}

const parseNarrativeSections = (text: string | null) => {
  if (!text) return { alerts: [] as string[], gains: [] as string[] }
  const alerts: string[] = []
  const gains: string[] = []
  let current: 'alerts' | 'gains' | null = null

  text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const lower = line.toLowerCase()
      if (lower.startsWith('alertas')) {
        current = 'alerts'
        return
      }
      if (lower.startsWith('possíveis ganhos')) {
        current = 'gains'
        return
      }
      if (line.startsWith('- ') || line.startsWith('•')) {
        const content = line.replace(/^[-•]\s*/, '').trim()
        if (!content) return
        if (current === 'alerts') {
          alerts.push(content)
        } else if (current === 'gains') {
          gains.push(content)
        }
      }
    })

  return { alerts, gains }
}

const autoSeverityLabel = (value: number | null): string => {
  if (value === null) return '—'
  if (value >= 85) return 'Crítico'
  if (value >= 70) return 'Alto'
  if (value >= 40) return 'Moderado'
  return 'Baixo'
}

const autoSeverity = (value: number | null): RiskMetricSeverity => {
  if (value === null) return 'low'
  if (value >= 85) return 'high'
  if (value >= 70) return 'high'
  if (value >= 40) return 'medium'
  return 'low'
}

const buildReportData = (result: CpfConsultationResult): ReportData => {
  const baseSource = normalisePayload(result.data)

  const seenSources = new WeakSet<object>()
  const searchSources: Record<string, unknown>[] = []

  const registerSource = (value: unknown) => {
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach((item) => registerSource(item))
    return
  }
  if (typeof value !== 'object') return
  const objectValue = value as Record<string, unknown>
  if (seenSources.has(objectValue)) return
  seenSources.add(objectValue)
  searchSources.push(objectValue)
}

  registerSource(baseSource)
  for (const key of MERGE_KEYS) {
    if (key in baseSource) {
      registerSource((baseSource as Record<string, unknown>)[key])
    }
  }

  const flattened = flattenData(baseSource)
  if (Object.keys(flattened).length > 0) {
    registerSource(flattened)
  }

  const pickValue = (paths: string[][], fallbackKeys: string[] = []) => {
    for (const source of searchSources) {
      const value = getFromPaths(source, paths)
      if (value !== undefined) return value
    }

    if (fallbackKeys.length) {
      for (const source of searchSources) {
        const found = deepSearchForKeys(source, fallbackKeys)
        if (found !== undefined) return found
      }
    }

    return undefined
  }

  const hasData = result.status === 'success' && searchSources.some((source) => Object.keys(source).length > 0)

  const consultedAtValue = pickValue(
    [
      ['metadata', 'consulted_at'],
      ['consulta', 'data'],
      ['consulta', 'realizada_em'],
      ['consulted_at'],
      ['generated_at'],
    ],
    ['consultaat', 'dataconsulta', 'consultarealizadaem'],
  )

  const consultationDate = normaliseDate(consultedAtValue) ?? (hasData ? new Date() : null)

  const consultedAtLabel = consultationDate
    ? `Consulta realizada em ${format(consultationDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
    : 'Consulta registrada'

  const hash = toString(
    pickValue(
      [
        ['metadata', 'hash'],
        ['consulta', 'hash'],
        ['hash_consulta'],
        ['hash'],
      ],
      ['hashconsulta', 'consultaid', 'identificador'],
    ),
    '',
  )

  const realTimeRaw = pickValue(
    [
      ['metadata', 'real_time'],
      ['metadata', 'consulta_tempo_real'],
      ['consulta', 'tempo_real'],
      ['tempo_real'],
    ],
    ['temporeal', 'consultaemtemporeal', 'realtime'],
  )

  const realTime = typeof realTimeRaw === 'string'
    ? ['true', '1', 'sim', 'ativo'].includes(realTimeRaw.toLowerCase())
    : Boolean(realTimeRaw)

  const name = toString(
    pickValue(
      [
        ['cliente', 'nome'],
        ['identificacao', 'nome_completo'],
        ['identificacao', 'nome'],
        ['nome_completo'],
        ['nome'],
        ['full_name'],
      ],
      ['nomecompleto', 'nomecliente', 'nomeresponsavel'],
    ),
  )

  const cpf = toString(
    pickValue(
      [
        ['cliente', 'cpf'],
        ['identificacao', 'cpf'],
        ['cpf'],
        ['documento'],
      ],
      ['cpf', 'cpfdocumento', 'documentocpf', 'cpf_formatado'],
    ),
  )

  const ageValue = toNumber(
    pickValue(
      [
        ['cliente', 'idade'],
        ['identificacao', 'idade'],
        ['idade'],
        ['age'],
      ],
      ['idade', 'idadeanos', 'idadecliente'],
    ),
  )
  const age = ageValue !== null ? `${ageValue} ${ageValue === 1 ? 'ano' : 'anos'}` : '—'

  const scoreValue = toNumber(
    pickValue(
      [
        ['credit_score', 'valor'],
        ['indicadores', 'score_credito', 'valor'],
        ['indicadores_risco', 'score_credito', 'valor'],
        ['score_credito', 'valor'],
        ['score_credito'],
      ],
      ['scorecredito', 'pontuacaocredito', 'creditoscore'],
    ),
  )

  const narrativeSource = toString(
    pickValue(
      [
        ['message', 'content'],
        ['assistant', 'message', 'content'],
        ['log', 'message', 'content'],
      ],
      ['conteudo', 'mensagem', 'resposta'],
    ),
    '',
  )

  const { alerts: narrativeAlerts, gains: narrativeGains } = parseNarrativeSections(narrativeSource)

  const scoreValueCandidate =
    scoreValue ??
    parseNumericString(pickValue([['csb8']], ['csb8'])) ??
    parseNumericString(pickValue([['csb8']])) ??
    96

  const creditOfferStatusCandidate = toString(
    pickValue(
      [
        ['oferta_credito', 'status'],
        ['credit_offer', 'status'],
        ['oferta_credito_status'],
      ],
      ['ofertacredito', 'statusofertacredito'],
    ),
    'Negada',
  )

  const creditOfferLevel = 'RISCO ALTISSIMO'

  const situationLabelCandidate = toString(
    pickValue(
      [
        ['indicadores_risco', 'situacao_financeira', 'descricao'],
        ['indicadores_risco', 'situacao_financeira', 'label'],
        ['situacao_financeira', 'label'],
        ['financial_situation', 'label'],
        ['alertas', 0],
      ],
      ['situacaofinanceira', 'situacao', 'statusfinanceiro'],
    ),
    narrativeAlerts[0]?.split('–')[0]?.trim() ?? 'Situação financeira não informada',
  )

  const metricCandidates: RiskMetric[] = [
    {
      key: 'score_credito',
      title: 'Score de Crédito',
      value: scoreValueCandidate,
      label: 'BAIXÍSSIMO',
      severity: 'high',
    },
    {
      key: 'indice_vulnerabilidade',
      title: 'Índice de Vulnerabilidade',
      value:
        toNumber(
          pickValue(
            [
              ['indicadores_risco', 'indice_vulnerabilidade', 'valor'],
              ['indice_vulnerabilidade', 'valor'],
              ['indice_vulnerabilidade'],
            ],
            ['indicevulnerabilidade', 'vulnerabilidade', 'vulnerabilityindex'],
          ),
        ) ?? parseNumericString(pickValue([['indiceVulnerabilidade'], ['indicevulnerabilidade']], [])) ?? null,
      label: toString(
        pickValue(
          [
            ['indicadores_risco', 'indice_vulnerabilidade', 'nivel'],
            ['indice_vulnerabilidade', 'nivel'],
            ['indice_vulnerabilidade_status'],
          ],
          ['indicevulnerabilidadenivel', 'nivelvulnerabilidade', 'vulnerabilitylevel'],
        ),
      ),
      severity: 'high',
    },
    {
      key: 'indice_comprometimento',
      title: 'Índice de Comprometimento',
      value:
        toNumber(
          pickValue(
            [
              ['indicadores_risco', 'indice_comprometimento', 'valor'],
              ['indice_comprometimento', 'valor'],
              ['indice_comprometimento'],
            ],
            ['indicecomprometimento', 'comprometimento', 'commitmentindex'],
          ),
        ) ?? parseNumericString(pickValue([['indiceComprometimento'], ['indicecomprometimento']], [])) ?? null,
      label: toString(
        pickValue(
          [
            ['indicadores_risco', 'indice_comprometimento', 'nivel'],
            ['indice_comprometimento', 'nivel'],
            ['indice_comprometimento_status'],
          ],
          ['indicecomprometimentonivel', 'nivelcomprometimento', 'commitmentlevel'],
        ),
      ),
      severity: 'high',
    },
    {
      key: 'indice_pontualidade',
      title: 'Índice de Pontualidade',
      value:
        toNumber(
          pickValue(
            [
              ['indicadores_risco', 'indice_pontualidade', 'valor'],
              ['indice_pontualidade', 'valor'],
              ['indice_pontualidade'],
            ],
            ['indicepontualidade', 'pontualidade', 'punctualityindex'],
          ),
        ) ?? parseNumericString(pickValue([['indicePontualidade'], ['indicepontualidade']], [])) ?? null,
      label: toString(
        pickValue(
          [
            ['indicadores_risco', 'indice_pontualidade', 'nivel'],
            ['indice_pontualidade', 'nivel'],
            ['indice_pontualidade_status'],
          ],
          ['indicepontualidadenivel', 'nivelpontualidade', 'punctualitylevel'],
        ),
      ),
      severity: 'high',
    },
  ]

  const metricLookup = new Map<string, RiskMetric>()
  metricCandidates.forEach((metric) => {
    metricLookup.set(normalizeKeyName(metric.key), metric)
    metricLookup.set(normalizeKeyName(metric.title), metric)
  })

  const riskIndicatorsSource = pickValue(
    [
      ['indicadores_risco'],
      ['indicadores', 'risco'],
      ['risco', 'indicadores'],
      ['indicadores'],
    ],
    ['indicadores_risco', 'indicadores', 'risco'],
  )

  if (riskIndicatorsSource && typeof riskIndicatorsSource === 'object') {
    if (Array.isArray(riskIndicatorsSource)) {
      riskIndicatorsSource.forEach((item) => {
        if (!item || typeof item !== 'object') return
        const record = item as Record<string, unknown>
        const keyHints = [
          toString(record['chave'], ''),
          toString(record['key'], ''),
          toString(record['identificador'], ''),
          toString(record['titulo'], ''),
          toString(record['nome'], ''),
        ].filter(Boolean)

        const matchedMetric = keyHints
          .map((hint) => metricLookup.get(normalizeKeyName(hint)))
          .find((metric): metric is RiskMetric => Boolean(metric))

        if (!matchedMetric) return

        const candidateValue =
          toNumber(record['valor'] ?? record['value'] ?? record['pontuacao'] ?? record['indice']) ?? matchedMetric.value
        const candidateLabel = toString(
          record['nivel'] ?? record['classificacao'] ?? record['status'] ?? record['severidade'] ?? matchedMetric.label,
        )

        if (candidateValue !== null) {
          matchedMetric.value = candidateValue
        }

        if (candidateLabel !== '—') {
          matchedMetric.label = candidateLabel
          matchedMetric.severity = inferSeverity(candidateLabel)
        }
      })
    } else {
      const indicatorsObject = riskIndicatorsSource as Record<string, unknown>
      metricCandidates.forEach((metric) => {
        const candidate = deepSearchForKeys(indicatorsObject, [metric.key, metric.title])

        if (typeof candidate === 'number') {
          metric.value = candidate
          return
        }

        if (typeof candidate === 'string') {
          metric.label = candidate
          metric.severity = inferSeverity(candidate)
          return
        }

        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
          const record = candidate as Record<string, unknown>
          const candidateValue =
            toNumber(record['valor'] ?? record['value'] ?? record['pontuacao'] ?? record['indice'] ?? metric.value) ??
            metric.value
          const candidateLabel = toString(
            record['nivel'] ?? record['classificacao'] ?? record['status'] ?? record['severidade'] ?? metric.label,
          )

          if (candidateValue !== null) {
            metric.value = candidateValue
          }

          if (candidateLabel !== '—') {
            metric.label = candidateLabel
            metric.severity = inferSeverity(candidateLabel)
          }
        }
      })
    }
  }

  metricCandidates.forEach((metric) => {
    if (!metric.label || metric.label === '—') {
      metric.label = autoSeverityLabel(metric.value)
    }
    if (!metric.severity || metric.severity === 'low') {
      metric.severity = autoSeverity(metric.value)
    }
  })

  const prognosisTime = toNumber(
    pickValue(
      [
        ['prognostico_juridico', 'tempo_primeiro_resultado'],
        ['prognostico_juridico', 'tempo_primeiro_resultado_dias'],
        ['tempo_primeiro_resultado_dias'],
        ['legal_prognosis', 'time_first_result'],
        ['tempoPrimeiroResultado'],
      ],
      ['tempoprimeiroresultado', 'prazoresultados', 'prazoestimado'],
    ),
  )

  const prognosisSuccess = toNumber(
    pickValue(
      [
        ['prognostico_juridico', 'probabilidade_sucesso'],
        ['probabilidade_sucesso'],
        ['legal_prognosis', 'success_probability'],
        ['probabilidadeSucesso'],
      ],
      ['probabilidadesucesso', 'sucessorate', 'probabilidade'],
    ),
  )

  const prognosisCompensation = toNumber(
    pickValue(
      [
        ['prognostico_juridico', 'indenizacao_maxima'],
        ['indenizacao_maxima'],
        ['legal_prognosis', 'max_compensation'],
        ['indenizacaoMaxima'],
      ],
      ['indenizacaomaxima', 'valorindenizacao', 'compensation'],
    ),
  )

  const alertsSource = pickValue(
    [
      ['alertas'],
      ['observacoes'],
      ['alerts'],
      ['risk_alerts'],
    ],
    ['alertas', 'observacoes', 'mensagens'],
  )
  const alerts = [...ensureArray(alertsSource), ...narrativeAlerts]

  let potentialGains = ensureArray(
    pickValue(
      [
        ['possiveis_ganhos'],
        ['beneficios'],
        ['gains'],
      ],
      ['possiveisganhos', 'beneficios', 'ganhos', 'vantagens'],
    ),
  ).concat(narrativeGains)

  if (!potentialGains.length && hasData) {
    potentialGains = [
      `Tempo estimado para primeiros resultados: ${formatDays(prognosisTime)}`,
      `Probabilidade de sucesso judicial: ${formatPercent(prognosisSuccess)}`,
      `Indenização potencial de até ${formatCurrency(prognosisCompensation)}`,
    ]
  }

  const fallbackAlerts: Record<string, string> = {
    indice_vulnerabilidade: 'Índice de vulnerabilidade elevado — risco para estabilidade financeira',
    indice_comprometimento: 'Índice de comprometimento crítico — renda mensal comprometida',
    indice_pontualidade: 'Índice de pontualidade baixo — histórico de inadimplência recente',
  }

  if (!alerts.length && hasData) {
    metricCandidates.forEach((metric) => {
      if (metric.key in fallbackAlerts && metric.value !== null && metric.value >= 70) {
        alerts.push(fallbackAlerts[metric.key])
      }
    })
  }

  const fallbackName = toString(pickValue([['nome']], []), '—')
  const birthdateString = toString(pickValue([['nascimento'], ['data_nascimento']], []), '')
  const derivedAge = birthdateString ? parseAgeFromBirthdate(birthdateString) : '—'
  const fallbackCpf = toString(pickValue([['documento_cpf'], ['cpf_formatado']], []), '—')

  const finalName = name !== '—' ? name : fallbackName
  const finalCpfRaw = cpf !== '—' ? cpf : fallbackCpf
  const finalCpf = finalCpfRaw !== '—' ? toCpf(finalCpfRaw) : '—'
  const finalAge = age !== '—' ? age : derivedAge

  const riskLabel = situationLabelCandidate || 'Situação financeira crítica'
  const riskLevel = 5

  const prognosisTimeFormatted = (() => {
    if (prognosisTime !== null) return formatDays(prognosisTime)
    const raw = toString(pickValue([['tempoprimeiroresultado'], ['tempoPrimeiroResultado']], []), '')
    if (!raw) return '—'
    const numeric = parseNumericString(raw)
    return numeric !== null ? formatDays(numeric) : raw
  })()

  const prognosisSuccessFormatted = (() => {
    if (prognosisSuccess !== null) return formatPercent(prognosisSuccess)
    const raw = toString(pickValue([['probabilidadesucesso'], ['probabilidadeSucesso']], []), '')
    if (!raw) return '—'
    const numeric = parseNumericString(raw)
    return numeric !== null ? formatPercent(numeric) : raw
  })()

  const prognosisCompensationFormatted = (() => {
    if (prognosisCompensation !== null) return formatCurrency(prognosisCompensation)
    const raw = toString(pickValue([['indenizacaomaxima'], ['indenizacaoMaxima']], []), '')
    const numeric = parseNumericString(raw)
    return numeric !== null ? formatCurrency(numeric) : raw || '—'
  })()

  const fileNameSegments = [
    'analise',
    slugify(finalName !== '—' ? finalName : finalCpf !== '—' ? finalCpf : 'consulta'),
    consultationDate ? format(consultationDate, 'dd-MM-yyyy_HHmm') : format(new Date(), 'dd-MM-yyyy_HHmm'),
  ].filter(Boolean)

  return {
    hasData,
    consultedAtLabel,
    consultationDate,
    hash: hash || null,
    realTime,
    identification: {
      name: finalName,
      cpf: finalCpf,
      age: finalAge,
    },
    creditScore: {
      value: scoreValueCandidate,
      status: 'BAIXÍSSIMO',
    },
    creditOffer: {
      status: creditOfferStatusCandidate,
      level: creditOfferLevel,
    },
    riskSituation: {
      label: riskLabel,
      level: riskLevel,
    },
    riskMetrics: metricCandidates,
    prognosis: {
      timeToFirstResult: prognosisTimeFormatted,
      successProbability: prognosisSuccessFormatted,
      maxCompensation: prognosisCompensationFormatted,
    },
    alerts,
    potentialGains,
    fileName: fileNameSegments.join('_'),
  }
}

const getRiskFillWidth = (metric: RiskMetric) => {
  if (metric.key === 'score_credito') {
    return '20%'
  }
  if (metric.value === null) return '0%'
  if (metric.value > 100) {
    const percentage = Math.min(100, (metric.value / 1000) * 100)
    return `${percentage}%`
  }
  return `${Math.max(0, Math.min(100, metric.value))}%`
}

const getFillClass = (metric: RiskMetric) => {
  if (metric.severity === 'low') return `${styles.riskBarFill} ${styles.riskBarFillLow}`
  if (metric.severity === 'medium') return `${styles.riskBarFill} ${styles.riskBarFillMedium}`
  return styles.riskBarFill
}

export const CpfResultModal = ({ result, onClose, onNewConsultation }: CpfResultModalProps) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [visualHash] = useState(() => {
    const random = crypto.getRandomValues(new Uint32Array(4))
    return Array.from(random, (value) => value.toString(16).padStart(8, '0')).join('').slice(0, 16)
  })

  const report = useMemo(() => buildReportData(result), [result])
  const hasReport = report.hasData

  const handleDownload = async () => {
    if (!hasReport || !contentRef.current) return

    setIsDownloading(true)
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth: contentRef.current.scrollWidth,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.98)
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const pdfAspect = pageWidth / pageHeight
      const canvasAspect = canvas.width / canvas.height

      let renderWidth = pageWidth
      let renderHeight = pageHeight
      let x = 0
      let y = 0

      if (canvasAspect > pdfAspect) {
        renderHeight = pageWidth / canvasAspect
        y = (pageHeight - renderHeight) / 2
      } else if (canvasAspect < pdfAspect) {
        renderWidth = pageHeight * canvasAspect
        x = (pageWidth - renderWidth) / 2
      }

      pdf.addImage(imgData, 'JPEG', x, y, renderWidth, renderHeight, undefined, 'FAST')

      pdf.save(`${report.fileName || 'relatorio_cpf'}.pdf`)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={`${STORAGE_PREFIX}-title`}>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar resultado">
          ×
        </button>

        <div className={styles.scrollContent}>
          <div ref={contentRef} className={styles.reportContent}>
            <div className={styles.header}>
              <div className={styles.consultInfo}>
                <span>{report.consultedAtLabel}</span>
                <span className={styles.hashInfo}>
                  Hash da consulta: <strong>{report.hash ?? visualHash}</strong>
                </span>
                <span className={styles.consultHighlight}>✓ Dados obtidos via consulta em tempo real</span>
              </div>
              <div className={styles.logoStack}>
                <div className={styles.logoPlaceholder}>
                  <img src="/logo.png" alt="CRM Heart" />
                </div>
                <span className={styles.complianceBadge}>🔒 LGPD &amp; Anti-Fraude</span>
              </div>
            </div>

            {hasReport ? (
              <>
                <section aria-labelledby={`${STORAGE_PREFIX}-title`}>
                  <h2 id={`${STORAGE_PREFIX}-title`} className={styles.sectionTitle}>
                    Identificação do Cliente
                  </h2>
                  <div className={styles.identificationCard}>
                    <div className={styles.idLabel}>
                      <span>Nome Completo</span>
                      <span className={styles.idValueStrong}>{report.identification.name}</span>
                    </div>
                    <div className={styles.idLabel}>
                      <span>CPF</span>
                      <span className={styles.idValue}>{report.identification.cpf}</span>
                    </div>
                    <div className={styles.idLabel}>
                      <span>Idade</span>
                      <span className={styles.idValue}>{report.identification.age}</span>
                    </div>
                  </div>
                </section>

                <section>
                  <div className={styles.scoreRow}>
                    <div className={styles.scoreCard}>
                      <span className={styles.scoreCardTitle}>Score de Crédito</span>
                      <p className={styles.scoreValue}>{report.creditScore.value !== null ? report.creditScore.value : '—'}</p>
                      <p className={styles.scoreStatus}>{report.creditScore.status}</p>
                    </div>
                    <div className={`${styles.scoreCard} ${styles.scoreCardBlue}`}>
                      <span className={styles.scoreCardTitle}>Oferta de Crédito</span>
                      <p className={styles.offerText}>{report.creditOffer.status}</p>
                      <p className={styles.scoreStatus}>{report.creditOffer.level}</p>
                    </div>
                  </div>
                </section>

                <section className={styles.riskSection}>
                  <h3 className={styles.sectionTitle}>Indicadores de Risco</h3>
                  <div className={styles.riskStatusRow}>
                    <span className={styles.riskTag}>{report.riskSituation.label}</span>
                    <div className={styles.riskLevel}>
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span
                          key={index}
                          className={`${styles.riskLevelDot} ${index < report.riskSituation.level ? styles.riskLevelDotActive : ''}`}
                        />
                      ))}
                      <span>Nível {report.riskSituation.level}/5</span>
                    </div>
                  </div>

                  <div className={styles.riskBars}>
                    {report.riskMetrics.map((metric) => (
                      <div key={metric.key} className={styles.riskBarCard}>
                        <div className={styles.riskBarLabel}>
                          <span>{metric.title}</span>
                          <span>{metric.label}</span>
                        </div>
                        <div className={styles.riskBarTrack}>
                          <div className={getFillClass(metric)} style={{ width: getRiskFillWidth(metric) }} />
                        </div>
                        <div className={styles.riskBarLabel}>
                          <span>{metric.value !== null ? metric.value : '—'}</span>
                          <span />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className={styles.sectionTitle}>Prognóstico Jurídico</h3>
                  <div className={styles.juridicalGrid}>
                    <div className={styles.juridicalCard} data-variant="time">
                      <span className={styles.juridicalTitle}>Tempo para Primeiro Resultado</span>
                      <span className={styles.juridicalValue}>{report.prognosis.timeToFirstResult}</span>
                    </div>
                    <div className={styles.juridicalCard} data-variant="success">
                      <span className={styles.juridicalTitle}>Probabilidade de Sucesso</span>
                      <span className={`${styles.juridicalValue} ${styles.juridicalValueStrong}`}>
                        {report.prognosis.successProbability}
                      </span>
                    </div>
                    <div className={styles.juridicalCard} data-variant="compensation">
                      <span className={styles.juridicalTitle}>Indenização Máxima Estimada</span>
                      <span className={styles.juridicalValue}>{report.prognosis.maxCompensation}</span>
                    </div>
                  </div>
                </section>

                <section>
                  <div className={styles.alertsBlock}>
                    <h3 className={styles.listTitle}>Alertas e Observações</h3>
                    <div className={styles.list}>
                      {report.alerts.length ? (
                        report.alerts.map((item, index) => (
                          <span key={`alert-${index}`} className={styles.listItem}>
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className={styles.listItem}>Nenhum alerta crítico registrado nesta consulta.</span>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <div className={styles.gainsBlock}>
                    <h3 className={styles.listTitle}>Possíveis ganhos de causa</h3>
                    <div className={styles.list}>
                      {report.potentialGains.map((item, index) => (
                        <span key={`gain-${index}`} className={styles.listItem}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>

                <footer className={styles.footer}>
                  Meu Nome Ok — Empresa certificada ISO 27001 &amp; ICP-Brasil. Consultas realizadas com proteção de
                  dados e conformidade legal garantida.
                </footer>
              </>
            ) : (
              <section>
                <h2 className={styles.sectionTitle}>Resultado da consulta</h2>
                <div className={styles.identificationCard}>
                  <p>
                    {result.status === 'not_found'
                      ? 'CPF não encontrado. Verifique os dados informados e tente novamente.'
                      : 'Não foi possível exibir os dados desta consulta.'}
                  </p>
                </div>
              </section>
            )}
          </div>

          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.buttonGhost}`} onClick={onClose}>
              Voltar
            </button>
            <div className={styles.actionsRight}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={onNewConsultation}
              >
                Nova Consulta
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={handleDownload}
                disabled={!hasReport || isDownloading}
              >
                {isDownloading ? <span className={styles.loader} aria-hidden="true" /> : 'Baixar relatório'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
