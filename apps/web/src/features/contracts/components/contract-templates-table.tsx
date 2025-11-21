import styles from './contract-templates-table.module.css'

import type { ContractTemplateWithVariables } from '@/features/contracts/types'

const formatVariables = (variables: ContractTemplateWithVariables['variables']) =>
  variables.map((variable) => variable.variable_key).join(', ') || '—'

type ContractTemplatesTableProps = {
  templates: ContractTemplateWithVariables[]
  onEdit: (template: ContractTemplateWithVariables) => void
  onDelete: (template: ContractTemplateWithVariables) => void
  onToggleStatus: (template: ContractTemplateWithVariables) => void
  isLoading: boolean
}

export const ContractTemplatesTable = ({ templates, onEdit, onDelete, onToggleStatus, isLoading }: ContractTemplatesTableProps) => (
  <div className={styles.wrapper}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Template</th>
          <th>Descrição</th>
          <th>Variáveis</th>
          <th>Status</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <tr>
            <td colSpan={5} className={styles.empty}>Carregando templates...</td>
          </tr>
        ) : null}
        {!isLoading && templates.length === 0 ? (
          <tr>
            <td colSpan={5} className={styles.empty}>Nenhum template cadastrado.</td>
          </tr>
        ) : null}
        {templates.map((template) => (
          <tr key={template.id}>
            <td>{template.nome}</td>
            <td>{template.descricao ?? '—'}</td>
            <td>{formatVariables(template.variables)}</td>
              <td>{template.ativo ? 'Ativo' : 'Inativo'}</td>
              <td>
                <div className={styles.actions}>
                  <button type="button" className={template.ativo ? styles.deactivateButton : styles.activateButton} onClick={() => onToggleStatus(template)}>
                    {template.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                  <button type="button" className={styles.editButton} onClick={() => onEdit(template)}>
                    Editar
                  </button>
                  <button type="button" className={styles.deleteButton} onClick={() => onDelete(template)}>
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
