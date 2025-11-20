import styles from './remarketing-history.module.css'

import type { RemarketingJob, RemarketingLog } from '@/features/remarketing/hooks/use-remarketing'

const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR')

type RemarketingHistoryProps = {
  jobs: RemarketingJob[]
  logs: RemarketingLog[]
}

export const RemarketingHistory = ({ jobs, logs }: RemarketingHistoryProps) => (
  <div className={styles.wrapper}>
    <div>
      <h3 className={styles.title}>Jobs recentes</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Criado em</th>
            <th>Audiência</th>
            <th>Método</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.length === 0 ? (
            <tr>
              <td colSpan={4} className={styles.empty}>Nenhum job registrado.</td>
            </tr>
          ) : (
            jobs.map((job) => (
              <tr key={job.id}>
                <td>{formatDate(job.created_at)}</td>
                <td>{job.audience_type}</td>
                <td>{job.delivery_method}</td>
                <td>{job.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    <div>
      <h3 className={styles.title}>Logs recentes</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Data</th>
            <th>Job</th>
            <th>Alvo</th>
            <th>Status</th>
            <th>Mensagem</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.empty}>Nenhum log registrado.</td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id}>
                <td>{formatDate(log.created_at)}</td>
                <td>{log.job_id.slice(0, 6)}</td>
                <td>{log.target_id ?? '—'}</td>
                <td>{log.status ?? '—'}</td>
                <td>{log.error_message ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
)
