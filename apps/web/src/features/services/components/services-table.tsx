import styles from './services-table.module.css'

import type { ContractTemplateRecord, ServiceRecord } from '@/features/services/types'

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const getTemplateName = (templates: ContractTemplateRecord[], id: string | null) => {
  if (!id) return '—'
  const template = templates.find((item) => item.id === id)
  return template?.nome ?? `Template ${id.slice(0, 6)}`
}

type ServicesTableProps = {
  services: ServiceRecord[]
  templates: ContractTemplateRecord[]
  onEdit: (service: ServiceRecord) => void
  onDelete: (service: ServiceRecord) => void
  isLoading: boolean
}

export const ServicesTable = ({ services, templates, onEdit, onDelete, isLoading }: ServicesTableProps) => {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Serviço</th>
            <th>Valor padrão</th>
            <th>Parcelas</th>
            <th>Formas de pagamento</th>
            <th>Template contrato</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={6} className={styles.empty}>Carregando serviços...</td>
            </tr>
          ) : null}
          {!isLoading && services.length === 0 ? (
            <tr>
              <td colSpan={6} className={styles.empty}>Nenhum serviço cadastrado ainda.</td>
            </tr>
          ) : null}
          {services.map((service) => (
            <tr key={service.id}>
              <td>
                <div className={styles.serviceName}>
                  <span className={styles.name}>{service.nome}</span>
                  {service.descricao ? <span className={styles.description}>{service.descricao}</span> : null}
                </div>
              </td>
              <td>{formatCurrency(service.valor_padrao)}</td>
              <td>{service.max_parcelas}</td>
              <td>{service.formas_pagamento.join(', ') || '—'}</td>
              <td>{getTemplateName(templates, service.contrato_template_id)}</td>
              <td>
                <div className={styles.actions}>
                  <button type="button" className={styles.editButton} onClick={() => onEdit(service)}>
                    Editar
                  </button>
                  <button type="button" className={styles.deleteButton} onClick={() => onDelete(service)}>
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
