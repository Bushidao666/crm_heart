import { format } from 'date-fns'
import ptBR from 'date-fns/locale/pt-BR'
import { useEffect, useMemo, useState } from 'react'

import { MetricCard } from '@/components/metric-card'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { ADMIN_ROLES } from '@/features/auth/constants'
import type { MetricsPeriod, MetricsRow } from '@/features/metrics/hooks/use-metrics'
import { useMetrics } from '@/features/metrics/hooks/use-metrics'
import { heartSupabase } from '@/lib/supabase-client'

import styles from './metrics-page.module.css'

type VendorOption = {
  id: string
  name: string
}

const periodOptions: { label: string; value: MetricsPeriod }[] = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Semana', value: 'esta_semana' },
  { label: 'Mês', value: 'este_mes' },
  { label: 'Todo período', value: 'todo_periodo' },
  { label: 'Personalizado', value: 'personalizado' },
]

const formatPercent = (value: number) => `${value.toFixed(1)}%`
const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })

const getVendorLabel = (row: MetricsRow, vendorLookup: Map<string, string>, fallbackName?: string | null) => {
  if (!row.vendedor_responsavel) return '—'
  return vendorLookup.get(row.vendedor_responsavel) ?? fallbackName ?? row.vendedor_responsavel.slice(0, 8)
}

export const MetricsPage = () => {
  const { hasRole, profile } = useAuth()
  const isAdmin = hasRole(ADMIN_ROLES)
  const [period, setPeriod] = useState<MetricsPeriod>('hoje')
  const [selectedVendor, setSelectedVendor] = useState<string>('all')
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([])
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)

  const { rows, summary, isLoading, lastUpdated, error, refresh } = useMetrics({
    period,
    companyId: profile?.company_id ?? undefined,
    vendorId: isAdmin && selectedVendor !== 'all' ? selectedVendor : undefined,
    startDate,
    endDate,
  })

  useEffect(() => {
    if (!isAdmin) return

    const loadVendors = async () => {
      const { data, error: loadError } = await heartSupabase
        .from('equipe')
        .select('id, user_name, role')
        .order('user_name', { ascending: true })

      if (loadError) {
        console.error('Falha ao carregar vendedores', loadError)
        return
      }

      const mapped =
        data?.map((item) => ({
          id: item.id,
          name: item.user_name || 'Sem nome',
        })) ?? []
      setVendorOptions(mapped)
    }

    void loadVendors()
  }, [isAdmin])

  const vendorLookup = useMemo(() => {
    const map = new Map<string, string>()
    vendorOptions.forEach((vendor) => map.set(vendor.id, vendor.name))
    if (profile?.id && profile.user_name) {
      map.set(profile.id, profile.user_name)
    }
    return map
  }, [profile?.id, profile?.user_name, vendorOptions])

  const formattedUpdatedAt = lastUpdated
    ? format(lastUpdated, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : '—'

  const personalRow = !isAdmin ? rows[0] : null

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{isAdmin ? 'Visão do time' : 'Visão pessoal'}</p>
          <h1>Métricas comerciais</h1>
          <p>Consolidado de leads e deals com recortes por período e vendedor.</p>
        </div>
        <div className={styles.headerActions}>
          <span>Atualizado {formattedUpdatedAt}</span>
          <button type="button" onClick={() => void refresh()} disabled={isLoading}>
            {isLoading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </header>

      <div className={styles.filters}>
        <div className={styles.periodGroup}>
          <span>Período</span>
          <div className={styles.periodButtons}>
            {periodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={period === option.value ? styles.periodButtonActive : styles.periodButton}
                onClick={() => {
                  setPeriod(option.value)
                  if (option.value !== 'personalizado') {
                    setStartDate(null)
                    setEndDate(null)
                  } else {
                    const today = new Date()
                    const iso = today.toISOString().slice(0, 10)
                    setStartDate((prev) => prev ?? iso)
                    setEndDate((prev) => prev ?? iso)
                  }
                }}
                disabled={isLoading}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'personalizado' ? (
          <div className={styles.dateRange}>
            <label className={styles.selectField}>
              <span>Início</span>
              <input
                type="date"
                value={startDate ?? ''}
                onChange={(event) => setStartDate(event.target.value || null)}
                disabled={isLoading}
              />
            </label>
            <label className={styles.selectField}>
              <span>Fim</span>
              <input
                type="date"
                value={endDate ?? ''}
                onChange={(event) => setEndDate(event.target.value || null)}
                disabled={isLoading}
              />
            </label>
          </div>
        ) : null}

        {isAdmin ? (
          <label className={styles.selectField}>
            <span>Filtrar vendedor</span>
            <select
              value={selectedVendor}
              onChange={(event) => setSelectedVendor(event.target.value)}
              disabled={isLoading}
            >
              <option value="all">Todos os vendedores</option>
              {vendorOptions.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <section className={styles.grid}>
        <MetricCard title="Total de leads" value={summary.totalLeads} isLoading={isLoading} />
        <MetricCard title="Leads em atendimento" value={summary.leadsInProgress} isLoading={isLoading} />
        <MetricCard title="Leads convertidos" value={summary.leadsConverted} isLoading={isLoading} tone="success" />
        <MetricCard
          title="Taxa de conversão de leads"
          value={formatPercent(summary.leadsConversionRate)}
          isLoading={isLoading}
          tone="success"
        />
        <MetricCard title="Total de deals" value={summary.totalDeals} isLoading={isLoading} />
        <MetricCard title="Contratos enviados" value={summary.dealsSent} isLoading={isLoading} />
        <MetricCard title="Contratos assinados" value={summary.dealsSigned} isLoading={isLoading} tone="success" />
        <MetricCard title="Contratos rejeitados" value={summary.dealsRejected} isLoading={isLoading} tone="danger" />
        <MetricCard
          title="Taxa de fechamento"
          value={formatPercent(summary.dealsWinRate)}
          isLoading={isLoading}
          tone="success"
        />
        <MetricCard
          title="Taxa de rejeição"
          value={formatPercent(summary.dealsRejectRate)}
          isLoading={isLoading}
          tone="warning"
        />
        <MetricCard
          title="Comissão prevista (todos deals)"
          value={formatCurrency(summary.commissionAll)}
          isLoading={isLoading}
        />
        <MetricCard
          title="Comissão prevista (assinados)"
          value={formatCurrency(summary.commissionSigned)}
          isLoading={isLoading}
          tone="success"
        />
      </section>

      {isAdmin ? (
        <section className={styles.tableBlock}>
          <header className={styles.blockHeader}>
            <h2>Ranking por vendedor</h2>
            <p>Valores já respeitam a segurança (admin vê todos, vendedor só vê a si mesmo).</p>
          </header>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Total leads</th>
                  <th>Em atendimento</th>
                  <th>Convertidos</th>
                  <th>Taxa conv. leads</th>
                  <th>Total deals</th>
                  <th>Enviados</th>
                  <th>Visualizados</th>
              <th>Assinados</th>
              <th>Rejeitados</th>
              <th>Taxa fechamento</th>
              <th>Taxa rejeição</th>
              <th>Comissão (todos)</th>
              <th>Comissão (assinados)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                    <td colSpan={12} className={styles.emptyCell}>
                      {isLoading ? 'Carregando…' : 'Nenhum dado encontrado para o recorte selecionado.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={`${row.company_id ?? 'no-company'}-${row.vendedor_responsavel ?? 'unknown'}`}>
                      <td>{getVendorLabel(row, vendorLookup, profile?.user_name)}</td>
                      <td>{row.total_leads}</td>
                      <td>{row.qtd_em_atendimento}</td>
                      <td>{row.qtd_convertido}</td>
                      <td>{formatPercent(row.taxa_conversao_global * 100)}</td>
                      <td>{row.total_deals}</td>
                      <td>{row.qtd_contrato_enviado}</td>
                      <td>{row.qtd_contrato_visualizado}</td>
                      <td>{row.qtd_contrato_assinado}</td>
                      <td>{row.qtd_contrato_rejeitado}</td>
                      <td>{formatPercent(row.taxa_fechamento_deals * 100)}</td>
                      <td>{formatPercent(row.taxa_rejeicao_deals * 100)}</td>
                      <td>{formatCurrency(row.comissao_todos_deals)}</td>
                      <td>{formatCurrency(row.comissao_deals_assinados)}</td>
                    </tr>
                  ))
                )}
            </tbody>
          </table>
          </div>
        </section>
      ) : null}

      {/* Para vendedor, evitamos redundância: apenas cards e, se quiser no futuro, gráficos compactos. */}
    </section>
  )
}
