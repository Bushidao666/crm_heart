import { format } from 'date-fns'
import ptBR from 'date-fns/locale/pt-BR'

import { MetricCard } from '@/components/metric-card'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useMetrics } from '@/features/metrics/hooks/use-metrics'
import { ADMIN_ROLES } from '@/features/auth/constants'

import styles from './metrics-page.module.css'

export const MetricsPage = () => {
  const { hasRole } = useAuth()
  const isAdmin = hasRole(ADMIN_ROLES)
  const { metrics, isLoading, lastUpdated, refresh } = useMetrics({ includeInstances: Boolean(isAdmin) })

  const formattedUpdatedAt = lastUpdated
    ? format(lastUpdated, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h1>Métricas em tempo real</h1>
          <p>Indicadores consolidados de leads, negócios e instâncias (apenas administradores).</p>
        </div>
        <div className={styles.headerActions}>
          {formattedUpdatedAt ? <span>Atualizado {formattedUpdatedAt}</span> : <span>Carregando…</span>}
          <button type="button" onClick={() => void refresh()} disabled={isLoading}>
            {isLoading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </header>

      <section className={styles.block}>
        <header className={styles.blockHeader}>
          <h2>Leads</h2>
          <p>Indicadores diários baseados em criação e alterações de status.</p>
        </header>
        <div className={styles.grid}>
          <MetricCard title="Total hoje" value={metrics.leads.totalToday} isLoading={isLoading} />
          <MetricCard title="Novos hoje" value={metrics.leads.newToday} isLoading={isLoading} tone="success" />
          <MetricCard title="Descartados hoje" value={metrics.leads.discardedToday} isLoading={isLoading} tone="warning" />
          <MetricCard title="Convertidos hoje" value={metrics.leads.convertedToday} isLoading={isLoading} tone="success" />
        </div>
      </section>

      <section className={styles.block}>
        <header className={styles.blockHeader}>
          <h2>Negócios</h2>
          <p>Resumo diário da evolução de contratos enviados, assinados ou rejeitados.</p>
        </header>
        <div className={styles.grid}>
          <MetricCard title="Gerados hoje" value={metrics.deals.generatedToday} isLoading={isLoading} />
          <MetricCard title="Contratos enviados" value={metrics.deals.sentToday} isLoading={isLoading} tone="warning" />
          <MetricCard title="Contratos assinados" value={metrics.deals.signedToday} isLoading={isLoading} tone="success" />
          <MetricCard title="Contratos rejeitados" value={metrics.deals.rejectedToday} isLoading={isLoading} tone="danger" />
        </div>
      </section>

      {isAdmin ? (
        <section className={styles.block}>
          <header className={styles.blockHeader}>
            <h2>Instâncias</h2>
            <p>Acompanhamento de disponibilidade das instâncias de WhatsApp (somente admins).</p>
          </header>
          <div className={styles.grid}>
            <MetricCard title="Total" value={metrics.instances?.total ?? 0} isLoading={isLoading} />
            <MetricCard title="Conectadas" value={metrics.instances?.connected ?? 0} isLoading={isLoading} tone="success" />
            <MetricCard title="Aguardando" value={metrics.instances?.pending ?? 0} isLoading={isLoading} tone="warning" />
            <MetricCard
              title="Desconectadas"
              value={metrics.instances?.disconnected ?? 0}
              isLoading={isLoading}
              tone="danger"
            />
          </div>
        </section>
      ) : null}
    </section>
  )
}
