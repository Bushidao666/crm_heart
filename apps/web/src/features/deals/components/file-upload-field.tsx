import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase-client'
import { buildDealFilePath, extractFileExtension } from '@/features/deals/utils/deal-file-paths'

import styles from './file-upload-field.module.css'

type FileUploadFieldProps = {
  bucket: 'arquivos_deals' | 'audios_deals'
  dealId: string
  dealName: string
  dealCpf: string
  label: string
  fieldValue: string | null
  onUploaded: (path: string | null) => void
  accept?: string
}

export const FileUploadField = ({
  bucket,
  dealId,
  dealName,
  dealCpf,
  label,
  fieldValue,
  onUploaded,
  accept,
}: FileUploadFieldProps) => {
  const [isUploading, setIsUploading] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadUrl = async () => {
      if (!fieldValue) {
        setSignedUrl(null)
        return
      }

      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(fieldValue, 60)

      if (error) {
        console.error('Failed to create signed URL', error)
        setSignedUrl(null)
        return
      }

      setSignedUrl(data?.signedUrl ?? null)
    }

    void loadUrl()
  }, [bucket, fieldValue])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)

    const extension = extractFileExtension(file.name)
    const path = buildDealFilePath({
      dealId,
      dealName,
      dealCpf,
      label,
      extension,
    })

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })

    if (uploadError) {
      console.error('Failed to upload file', uploadError)
      setError('Não foi possível fazer upload do arquivo.')
      setIsUploading(false)
      return
    }

    onUploaded(path)
    setIsUploading(false)
    event.target.value = ''
  }

  const handleRemove = async () => {
    if (!fieldValue) return

    const { error: removeError } = await supabase.storage.from(bucket).remove([fieldValue])

    if (removeError) {
      console.error('Failed to remove file', removeError)
      setError('Não foi possível remover o arquivo.')
      return
    }

    onUploaded(null)
  }

  return (
    <div className={styles.container}>
      <label className={styles.label}>{label}</label>
      <div className={styles.controls}>
        <input type="file" accept={accept} onChange={handleFileUpload} disabled={isUploading} />
        {isUploading ? <span className={styles.status}>Enviando...</span> : null}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {fieldValue ? (
        <div className={styles.fileInfo}>
          <span className={styles.fileName}>{fieldValue.split('/').pop()}</span>
          <div className={styles.actions}>
            {signedUrl ? (
              <a href={signedUrl} target="_blank" rel="noreferrer" className={styles.link}>
                Abrir
              </a>
            ) : null}
            <button type="button" className={styles.removeButton} onClick={handleRemove}>
              Remover
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
