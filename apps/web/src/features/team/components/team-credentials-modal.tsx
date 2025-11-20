import styles from './team-credentials-modal.module.css'

type Credentials = {
  name: string
  email: string
  password: string
  role: string
}

type TeamCredentialsModalProps = {
  open: boolean
  credentials: Credentials | null
  onClose: () => void
}

export const TeamCredentialsModal = ({ open, credentials, onClose }: TeamCredentialsModalProps) => {
  if (!open || !credentials) {
    return null
  }

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch (error) {
      console.error('Failed to copy text', error)
    }
  }

  const copyAll = () => {
    const text = `Nome: ${credentials.name}\nEmail: ${credentials.email}\nSenha: ${credentials.password}`
    void copyToClipboard(text)
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <header className={styles.header}>
          <div>
            <h3 className={styles.title}>Credenciais geradas</h3>
            <p className={styles.subtitle}>Copie os dados abaixo e compartilhe com o usuário. Esta senha só aparece agora.</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </header>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Nome</span>
          <div className={styles.fieldRow}>
            <code className={styles.value}>{credentials.name}</code>
            <button type="button" className={styles.copyButton} onClick={() => copyToClipboard(credentials.name)}>
              Copiar
            </button>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>E-mail</span>
          <div className={styles.fieldRow}>
            <code className={styles.value}>{credentials.email}</code>
            <button type="button" className={styles.copyButton} onClick={() => copyToClipboard(credentials.email)}>
              Copiar
            </button>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Senha temporária</span>
          <div className={styles.fieldRow}>
            <code className={styles.value}>{credentials.password}</code>
            <button type="button" className={styles.copyButton} onClick={() => copyToClipboard(credentials.password)}>
              Copiar
            </button>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={copyAll}>
            Copiar tudo
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
