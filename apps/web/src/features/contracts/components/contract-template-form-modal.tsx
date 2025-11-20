import { useEffect, useMemo, useState } from 'react'

import { supabase } from '@/lib/supabase-client'
import type { ContractTemplate, ContractTemplateVariable, VariableOption } from '@/features/contracts/types'
import { DEAL_VARIABLES, LEAD_VARIABLES } from '@/features/contracts/types'

import styles from './contract-template-form-modal.module.css'

type ContractTemplateFormModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: {
    id?: string
    nome: string
    descricao: string | null
    storage_path: string | null
    template_body: string | null
    ativo: boolean
    variables: Array<Omit<ContractTemplateVariable, 'id' | 'template_id' | 'created_at'> & { id?: string }>
  }) => Promise<void>
  initialData?: (ContractTemplate & { variables: ContractTemplateVariable[] }) | null
  draftStorageKey?: string | null
}

const AVAILABLE_VARIABLES: VariableOption[] = [...DEAL_VARIABLES, ...LEAD_VARIABLES]
const ALLOWED_FILE_EXTENSIONS = new Set(['doc', 'docx', 'pdf'])

const deriveFileNameFromPath = (path: string | null) => {
  if (!path) return null

  const fileName = path.split('/').pop() ?? path
  const uuidPrefixPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i
  return fileName.replace(uuidPrefixPattern, '')
}

type TemplateDraftState = {
  nome?: string
  descricao?: string | null
  ativo?: boolean
  storage_path?: string | null
  storage_file_name?: string | null
  template_body?: string | null
  variables?: Array<Omit<ContractTemplateVariable, 'id' | 'template_id' | 'created_at'> & { id?: string }>
}

export const ContractTemplateFormModal = ({
  open,
  onClose,
  onSubmit,
  initialData,
  draftStorageKey,
}: ContractTemplateFormModalProps) => {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState<string | null>(null)
  const [ativo, setAtivo] = useState(true)
  const [storagePath, setStoragePath] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [templateBody, setTemplateBody] = useState<string | null>(null)
  const [variables, setVariables] = useState<Array<Omit<ContractTemplateVariable, 'id' | 'template_id' | 'created_at'> & { id?: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    const shouldPauseAutoRefresh =
      !import.meta.env.DEV &&
      typeof supabase.auth.stopAutoRefresh === 'function' &&
      typeof supabase.auth.startAutoRefresh === 'function'

    if (!shouldPauseAutoRefresh) return

    supabase.auth.stopAutoRefresh()

    return () => {
      supabase.auth.startAutoRefresh()
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setNome('')
      setDescricao(null)
      setAtivo(true)
      setStoragePath(null)
      setUploadedFileName(null)
      setTemplateBody(null)
      setVariables([])
      setError(null)
      setUploading(false)
      return
    }

    let restoredFromDraft = false

    if (draftStorageKey && typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(draftStorageKey)
        if (stored) {
          const parsed = JSON.parse(stored) as TemplateDraftState

          setNome(parsed.nome ?? initialData?.nome ?? '')
          setDescricao(parsed.descricao ?? initialData?.descricao ?? null)
          setAtivo(parsed.ativo ?? initialData?.ativo ?? true)
          setStoragePath(parsed.storage_path ?? initialData?.storage_path ?? null)
          setUploadedFileName(
            parsed.storage_file_name ??
              deriveFileNameFromPath(parsed.storage_path ?? initialData?.storage_path ?? null),
          )
          setTemplateBody(parsed.template_body ?? initialData?.template_body ?? null)
          setVariables(
            (parsed.variables ?? initialData?.variables ?? []).map(({ id, variable_key, source, column_name }) => ({
              id,
              variable_key,
              source,
              column_name,
            })),
          )
          setError(null)
          setUploading(false)
          restoredFromDraft = true
        }
      } catch (error) {
        console.warn('Failed to restore contract template draft', error)
        sessionStorage.removeItem(draftStorageKey)
      }
    }

    if (restoredFromDraft) return

    if (initialData) {
      setNome(initialData.nome)
      setDescricao(initialData.descricao)
      setAtivo(initialData.ativo)
      setStoragePath(initialData.storage_path)
      setUploadedFileName(deriveFileNameFromPath(initialData.storage_path ?? null))
      setTemplateBody(initialData.template_body)
      setVariables(initialData.variables.map(({ id, variable_key, source, column_name }) => ({
        id,
        variable_key,
        source,
        column_name,
      })))
    } else {
      setNome('')
      setDescricao(null)
      setAtivo(true)
      setStoragePath(null)
      setUploadedFileName(null)
      setTemplateBody(null)
      setVariables([])
    }

    setError(null)
    setUploading(false)
  }, [open, initialData, draftStorageKey])

  useEffect(() => {
    if (!open) return
    if (!draftStorageKey) return
    if (typeof window === 'undefined') return

    const payload: TemplateDraftState = {
      nome,
      descricao,
      ativo,
      storage_path: storagePath,
      storage_file_name: uploadedFileName,
      template_body: templateBody,
      variables,
    }

    try {
      sessionStorage.setItem(draftStorageKey, JSON.stringify(payload))
    } catch (error) {
      console.warn('Failed to persist contract template draft', error)
    }
  }, [open, draftStorageKey, nome, descricao, ativo, storagePath, uploadedFileName, templateBody, variables])

  const addVariable = () => {
    setVariables((prev) => [
      ...prev,
      {
        variable_key: '',
        source: 'deal',
        column_name: null,
      },
    ])
  }

  const updateVariable = (index: number, key: keyof ContractTemplateVariable, value: string) => {
    setVariables((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [key]: value }
      return copy
    })
  }

  const removeVariable = (index: number) => {
    setVariables((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const fileExt = file.name.split('.').pop()?.toLowerCase()

    if (!fileExt || !ALLOWED_FILE_EXTENSIONS.has(fileExt)) {
      setError('Formato não suportado. Envie arquivos .doc, .docx ou .pdf.')
      setUploading(false)
      event.target.value = ''
      return
    }

    const { data: signedData, error: signedError } = await supabase.functions.invoke<{
      path?: string
      token?: string
    }>('contract-template-upload-url', {
      body: { fileName: file.name },
    })

    if (signedError || !signedData?.path || !signedData?.token) {
      console.error('Failed to create signed upload URL', signedError ?? signedData)
      setError('Não foi possível preparar o upload do template.')
      setUploading(false)
      event.target.value = ''
      return
    }

    const { path, token } = signedData

    const { error: uploadError } = await supabase.storage
      .from('contract_templates')
      .uploadToSignedUrl(path, token, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || undefined,
      })

    if (uploadError) {
      console.error('Failed to upload template file', uploadError)
      setError('Não foi possível fazer o upload do template.')
      setUploading(false)
      event.target.value = ''
      return
    }

    setStoragePath(path)
    setUploadedFileName(file.name)
    setUploading(false)
    event.target.value = ''
  }

  const selectedVariables = useMemo(() => new Set(variables.map((item) => item.variable_key)), [variables])

  if (!open) return null

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!nome.trim()) {
      setError('Informe o nome do template.')
      return
    }

    setError(null)
    await onSubmit({
      id: initialData?.id,
      nome: nome.trim(),
      descricao: descricao ?? null,
      storage_path: storagePath,
      template_body: templateBody,
      ativo,
      variables,
    })
    onClose()
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>{initialData ? 'Editar template' : 'Novo template'}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            Fechar
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Nome</span>
            <input value={nome} onChange={(event) => setNome(event.target.value)} required />
          </label>

          <label className={styles.field}>
            <span>Descrição</span>
            <textarea
              rows={3}
              value={descricao ?? ''}
              onChange={(event) => setDescricao(event.target.value || null)}
            />
          </label>

          <label className={styles.field}>
            <span>Arquivo (DOCX/PDF)</span>
            <input type="file" accept=".doc,.docx,.pdf" onChange={handleFileUpload} disabled={uploading} />
            {storagePath ? (
              <span className={styles.helper}>
                Arquivo atual: {uploadedFileName ?? deriveFileNameFromPath(storagePath)}
              </span>
            ) : null}
          </label>

          <label className={styles.field}>
            <span>Template (texto/HTML para pré-visualização)</span>
            <textarea
              rows={6}
              placeholder="Use {{variavel}} para inserir valores dinâmicos."
              value={templateBody ?? ''}
              onChange={(event) => setTemplateBody(event.target.value || null)}
            />
          </label>

          <label className={styles.checkboxField}>
            <input type="checkbox" checked={ativo} onChange={(event) => setAtivo(event.target.checked)} />
            Template ativo
          </label>

          <section className={styles.variablesSection}>
            <header className={styles.variablesHeader}>
              <h3>Variáveis</h3>
              <button type="button" onClick={addVariable} className={styles.addButton}>
                Adicionar variável
              </button>
            </header>

            <div className={styles.variableOptions}>
              <span className={styles.helper}>Variáveis disponíveis:</span>
              <div className={styles.chips}>
                {AVAILABLE_VARIABLES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={[
                      styles.chip,
                      selectedVariables.has(option.value) ? styles.chipSelected : '',
                    ].join(' ')}
                    onClick={() => {
                      setVariables((prev) => [
                        ...prev,
                        {
                          variable_key: option.value,
                          source: option.source,
                          column_name: option.column,
                        },
                      ])
                      if (!templateBody?.includes(option.value)) {
                        setTemplateBody((prev) => `${prev ?? ''} ${option.value}`.trim())
                      }
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.variablesList}>
              {variables.map((variable, index) => (
                <div key={variable.id ?? index} className={styles.variableRow}>
                  <input
                    className={styles.variableInput}
                    value={variable.variable_key}
                    placeholder="{{variavel}}"
                    onChange={(event) => updateVariable(index, 'variable_key', event.target.value)}
                    required
                  />
                  <select
                    className={styles.variableSelect}
                    value={variable.source}
                    onChange={(event) => updateVariable(index, 'source', event.target.value)}
                  >
                    <option value="deal">Negócio</option>
                    <option value="lead">Lead</option>
                    <option value="custom">Personalizado</option>
                  </select>
                  <input
                    className={styles.variableInput}
                    value={variable.column_name ?? ''}
                    placeholder="Coluna ou valor"
                    onChange={(event) => updateVariable(index, 'column_name', event.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => removeVariable(index)}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </section>

          {error ? <p className={styles.error}>{error}</p> : null}

          <footer className={styles.footer}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.primaryButton} disabled={uploading}>
              Salvar template
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
