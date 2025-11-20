import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase-client'

export type RemarketingJob = {
  id: string
  created_by: string | null
  audience_type: string
  payload: Record<string, unknown>
  delivery_method: string
  scheduled_at: string | null
  status: string
  created_at: string
  updated_at: string
}

export type RemarketingLog = {
  id: string
  job_id: string
  target_id: string | null
  target_type: string | null
  delivery_method: string | null
  status: string | null
  error_message: string | null
  created_at: string
}

export const useRemarketing = () => {
  const [jobs, setJobs] = useState<RemarketingJob[]>([])
  const [logs, setLogs] = useState<RemarketingLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const [jobsResult, logsResult] = await Promise.all([
      supabase.from('remarketing_jobs').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('remarketing_logs').select('*').order('created_at', { ascending: false }).limit(50),
    ])

    if (jobsResult.error) {
      console.error('Failed to load remarketing jobs', jobsResult.error)
      setError('Não foi possível carregar os jobs de remarketing.')
      setJobs([])
    } else {
      setJobs((jobsResult.data ?? []) as RemarketingJob[])
    }

    if (logsResult.error) {
      console.error('Failed to load remarketing logs', logsResult.error)
    } else {
      setLogs((logsResult.data ?? []) as RemarketingLog[])
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const dispatch = useCallback(async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('remarketing-dispatch', { body: payload })

    if (error) {
      console.error('Failed to dispatch remarketing', error)
      throw new Error(error.message ?? 'Falha ao enviar remarketing.')
    }

    if (data?.error) {
      throw new Error(data.error)
    }

    await fetchData()
  }, [fetchData])

  return { jobs, logs, isLoading, error, dispatch, refresh: fetchData }
}
