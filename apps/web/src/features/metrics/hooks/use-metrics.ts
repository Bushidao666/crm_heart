import { useCallback, useEffect, useMemo, useState } from 'react'

import { heartSupabase, supabase } from '@/lib/supabase-client'

export type MetricsPeriod = 'hoje' | 'esta_semana' | 'este_mes' | 'todo_periodo' | 'personalizado'

export type MetricsRow = {
  company_id: string | null
  vendedor_responsavel: string | null
  total_leads: number
  qtd_lead_novo: number
  qtd_em_atendimento: number
  qtd_descartado: number
  qtd_convertido: number
  qtd_leads_ativos: number
  taxa_conversao_global: number
  taxa_conversao_sobre_ativos: number
  taxa_descarte: number
  total_deals: number
  qtd_negocio_novo: number
  qtd_contrato_enviado: number
  qtd_contrato_visualizado: number
  qtd_contrato_assinado: number
  qtd_contrato_rejeitado: number
  taxa_fechamento_deals: number
  taxa_rejeicao_deals: number
  comissao_todos_deals: number
  comissao_deals_assinados: number
}

export type MetricsSummary = {
  totalLeads: number
  leadsConverted: number
  leadsInProgress: number
  leadsConversionRate: number
  totalDeals: number
  dealsSent: number
  dealsSigned: number
  dealsRejected: number
  dealsWinRate: number
  dealsRejectRate: number
  commissionAll: number
  commissionSigned: number
}

const periodViewMap: Record<MetricsPeriod, string> = {
  hoje: 'metricas_hoje',
  esta_semana: 'metricas_semana',
  este_mes: 'metricas_mes',
  todo_periodo: 'metricas_todo_periodo',
}

const defaultSummary: MetricsSummary = {
  totalLeads: 0,
  leadsConverted: 0,
  leadsInProgress: 0,
  leadsConversionRate: 0,
  totalDeals: 0,
  dealsSent: 0,
  dealsSigned: 0,
  dealsRejected: 0,
  dealsWinRate: 0,
  dealsRejectRate: 0,
  commissionAll: 0,
  commissionSigned: 0,
}

export const useMetrics = (options: {
  period: MetricsPeriod
  companyId?: string | null
  vendorId?: string | null
  startDate?: string | null
  endDate?: string | null
}) => {
  const { period, companyId, vendorId, startDate, endDate } = options
  const [rows, setRows] = useState<MetricsRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (period === 'personalizado') {
        if (!startDate || !endDate) {
          setError('Selecione o período inicial e final.')
          setRows([])
          setIsLoading(false)
          return
        }

        const { data, error: rpcError } = await heartSupabase.rpc('metricas_vendedor_periodo', {
          p_company_id: companyId ?? null,
          p_vendedor_responsavel: vendorId ?? null,
          p_periodo: 'personalizado',
          p_data_inicio: startDate,
          p_data_fim: endDate,
        })

        if (rpcError) {
          console.error('Falha ao carregar métricas personalizadas', rpcError)
          setError('Não foi possível carregar as métricas no momento.')
          setRows([])
        } else {
          setRows((data as MetricsRow[]) ?? [])
        }
      } else {
        const viewName = periodViewMap[period]
        let query = heartSupabase.from(viewName).select('*')

        if (companyId) {
          query = query.eq('company_id', companyId)
        }

        if (vendorId) {
          query = query.eq('vendedor_responsavel', vendorId)
        }

        const { data, error: queryError } = await query.returns<MetricsRow[]>()

        if (queryError) {
          console.error('Falha ao carregar métricas', queryError)
          setError('Não foi possível carregar as métricas no momento.')
          setRows([])
        } else {
          setRows(data ?? [])
        }
      }
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Erro inesperado ao carregar métricas', err)
      setError('Erro inesperado ao carregar métricas.')
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [companyId, endDate, period, startDate, vendorId])

  useEffect(() => {
    void fetchMetrics()
  }, [fetchMetrics])

  useEffect(() => {
    const channel = supabase
      .channel('metrics-dashboard')
      .on('postgres_changes', { event: '*', schema: 'heart', table: 'leads_captura' }, () => {
        void fetchMetrics()
      })
      .on('postgres_changes', { event: '*', schema: 'heart', table: 'deals' }, () => {
        void fetchMetrics()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMetrics])

  const summary = useMemo<MetricsSummary>(() => {
    if (!rows.length) return defaultSummary

    const totals = rows.reduce(
      (acc, row) => {
        acc.totalLeads += row.total_leads
        acc.leadsConverted += row.qtd_convertido
        acc.leadsInProgress += row.qtd_em_atendimento
        acc.totalDeals += row.total_deals
        acc.dealsSent += row.qtd_contrato_enviado
        acc.dealsSigned += row.qtd_contrato_assinado
        acc.dealsRejected += row.qtd_contrato_rejeitado
        acc.commissionAll += Number(row.comissao_todos_deals ?? 0)
        acc.commissionSigned += Number(row.comissao_deals_assinados ?? 0)
        return acc
      },
      {
        totalLeads: 0,
        leadsConverted: 0,
        leadsInProgress: 0,
        totalDeals: 0,
        dealsSent: 0,
        dealsSigned: 0,
        dealsRejected: 0,
        commissionAll: 0,
        commissionSigned: 0,
      },
    )

    return {
      totalLeads: totals.totalLeads,
      leadsConverted: totals.leadsConverted,
      leadsInProgress: totals.leadsInProgress,
      leadsConversionRate: totals.totalLeads > 0 ? (totals.leadsConverted / totals.totalLeads) * 100 : 0,
      totalDeals: totals.totalDeals,
      dealsSent: totals.dealsSent,
      dealsSigned: totals.dealsSigned,
      dealsRejected: totals.dealsRejected,
      dealsWinRate: totals.totalDeals > 0 ? (totals.dealsSigned / totals.totalDeals) * 100 : 0,
      dealsRejectRate: totals.totalDeals > 0 ? (totals.dealsRejected / totals.totalDeals) * 100 : 0,
      commissionAll: totals.commissionAll,
      commissionSigned: totals.commissionSigned,
    }
  }, [rows])

  return { rows, summary, isLoading, lastUpdated, error, refresh: fetchMetrics }
}
