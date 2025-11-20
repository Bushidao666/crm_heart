import styles from './contract-tracking-table.module.css'

import type { ContractRecord } from '@/features/contracts/hooks/use-contracts-tracking'
import { formatCPF } from '@/features/deals/utils/format'

type Props = {
  contracts: ContractRecord[]
  isLoading: boolean
  onDownload: (row: ContractRecord) => Promise<void>
}

const formatDateTime = (value: string) => new Date(value).toLocaleString('pt-BR')

export const ContractTrackingTable = ({ contracts, isLoading, onDownload }: Props) => (
  <div className={styles.wrapper}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Contrato</th>
          <th>Cliente</th>
          <th>Status</th>
          <th>Método</th>
          <th>Atualizado</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <tr>
            <td colSpan={6} className={styles.empty}>Carregando contratos...</td>
          </tr>
        ) : null}
        {!isLoading && contracts.length === 0 ? (
          <tr>
            <td colSpan={6} className={styles.empty}>Nenhum contrato encontrado.</td>
          </tr>
        ) : null}
        {contracts.map((contract) => {
          const status = contract.contrato_status ?? '—'
          const canDownload = status === 'contrato_assinado' || status === 'contrato_rejeitado'

          return (
            <tr key={contract.id}>
              <td>{contract.contrato_nome ?? `Contrato ${contract.id.slice(0, 6)}`}</td>
            <td>
              <div className={styles.clientInfo}>
                <span>{contract.deal_name ?? '—'}</span>
                <span className={styles.clientMeta}>{contract.deal_email ?? contract.deal_phone ?? '—'}</span>
                <span className={styles.clientCpf}>
                  {contract.deal_cpf ? formatCPF(contract.deal_cpf) : '—'}
                </span>
              </div>
            </td>
              <td>{status}</td>
              <td>{contract.contrato_metodo ?? '—'}</td>
              <td>{formatDateTime(contract.updated_at)}</td>
              <td>
                <button
                  type="button"
                  className={`${styles.downloadButton} ${canDownload ? '' : styles.downloadButtonDisabled}`}
                  onClick={() => {
                    if (!canDownload) return
                    void onDownload(contract)
                  }}
                  disabled={!canDownload}
                >
                  Baixar
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
)
