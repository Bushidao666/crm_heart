import { addDays, startOfDay } from 'date-fns'
import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase-client'

export type LeadsMetrics = {
  totalToday: number
  newToday: number
  discardedToday: number
  convertedToday: number
}

export type DealsMetrics = {
  generatedToday: number
  sentToday: number
  signedToday: number
  rejectedToday: number
}

export type InstanceMetrics = {
  total: number
  connected: number
  pending: number
  disconnected: number
}

export type MetricsData = {
  leads: LeadsMetrics
  deals: DealsMetrics
  instances?: InstanceMetrics
}

const defaultMetrics: MetricsData = {
  leads: {
    totalToday: 0,
    newToday: 0,
    discardedToday: 0,
    convertedToday: 0,
  },
  deals: {
    generatedToday: 0,
    sentToday: 0,
    signedToday: 0,
    rejectedToday: 0,
  },
}

const countQuery = async (
  table: string,
  filters: (builder: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>,
) => {
  const query = filters(supabase.from(table))
  const { count, error } = await query.select('*', { head: true, count: 'exact' })
  if (error) {
    console.error(`Metrics count failed for ${table}`, error)
    return 0
  }
  return count ?? 0
}

const INSTANCES_CONNECTED = ['conectada', 'connected']
const INSTANCES_DISCONNECTED = ['desconectada', 'disconnected']

export const useMetrics = (options: { includeInstances: boolean }) => {
  const { includeInstances } = options
  const [metrics, setMetrics] = useState<MetricsData>(defaultMetrics)
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true)

    const start = startOfDay(new Date())
    const nextDay = addDays(start, 1)
    const startISO = start.toISOString()
    const nextISO = nextDay.toISOString()

    const [totalToday, newToday, discardedToday, convertedToday] = await Promise.all([
      countQuery('leads_captura', (query) => query.gte('created_at', startISO).lt('created_at', nextISO)),
      countQuery('leads_captura', (query) =>
        query
          .eq('lead_status', 'lead_novo')
          .gte('created_at', startISO)
          .lt('created_at', nextISO),
      ),
      countQuery('leads_captura', (query) =>
        query
          .eq('lead_status', 'descartado')
          .gte('updated_at', startISO)
          .lt('updated_at', nextISO),
      ),
      countQuery('leads_captura', (query) =>
        query
          .eq('lead_status', 'convertido')
          .gte('updated_at', startISO)
          .lt('updated_at', nextISO),
      ),
    ])

    const [generatedToday, sentToday, signedToday, rejectedToday] = await Promise.all([
      countQuery('deals', (query) => query.gte('created_at', startISO).lt('created_at', nextISO)),
      countQuery('deals', (query) =>
        query
          .eq('deal_status', 'contrato_enviado')
          .gte('updated_at', startISO)
          .lt('updated_at', nextISO),
      ),
      countQuery('deals', (query) =>
        query
          .eq('deal_status', 'contrato_assinado')
          .gte('updated_at', startISO)
          .lt('updated_at', nextISO),
      ),
      countQuery('deals', (query) =>
        query
          .eq('deal_status', 'contrato_rejeitado')
          .gte('updated_at', startISO)
          .lt('updated_at', nextISO),
      ),
    ])

    const baseMetrics: MetricsData = {
      leads: {
        totalToday,
        newToday,
        discardedToday,
        convertedToday,
      },
      deals: {
        generatedToday,
        sentToday,
        signedToday,
        rejectedToday,
      },
    }

    if (includeInstances) {
      const { data, error } = await supabase.from('instancias').select('id, status')
      if (error) {
        console.error('Metrics instances fetch failed', error)
        setMetrics({ ...baseMetrics, instances: { total: 0, connected: 0, pending: 0, disconnected: 0 } })
      } else {
        const statuses = data ?? []
        const total = statuses.length
        const connected = statuses.filter((item) => INSTANCES_CONNECTED.includes(item.status ?? '')).length
        const pending = statuses.filter((item) => item.status === 'aguardando').length
        const disconnected = statuses.filter((item) => INSTANCES_DISCONNECTED.includes(item.status ?? '')).length
        setMetrics({ ...baseMetrics, instances: { total, connected, pending, disconnected } })
      }
    } else {
      setMetrics(baseMetrics)
    }

    setLastUpdated(new Date())
    setIsLoading(false)
  }, [includeInstances])

  useEffect(() => {
    void fetchMetrics()
  }, [fetchMetrics])

  useEffect(() => {
    const channel = supabase
      .channel('metrics-listener')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_captura' }, () => {
        void fetchMetrics()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        void fetchMetrics()
      })

    if (includeInstances) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'instancias' }, () => {
        void fetchMetrics()
      })
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMetrics, includeInstances])

  return { metrics, isLoading, lastUpdated, refresh: fetchMetrics }
}
