import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  clearAccessRevokedInfo,
  getAccessRevokedInfo,
  type AccessRevokedInfo,
} from '@/features/auth/utils/access-revoked'

import styles from './access-revoked-page.module.css'

export const AccessRevokedPage = () => {
  const [info, setInfo] = useState<AccessRevokedInfo | null>(null)

  useEffect(() => {
    const stored = getAccessRevokedInfo()
    setInfo(stored)
    clearAccessRevokedInfo()
  }, [])

  const primaryMessage =
    info?.message ?? 'Seu acesso foi revogado. Caso acredite que isso seja um engano, fale com um administrador.'

  return (
    <section className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Acesso revogado</h1>
        <p className={styles.description}>{primaryMessage}</p>
        {info?.banReason ? <p className={styles.meta}>Motivo informado: {info.banReason}</p> : null}
        {info?.detail ? <p className={styles.meta}>Origem: {info.detail}</p> : null}
        {info?.at ? <p className={styles.meta}>Horário: {new Date(info.at).toLocaleString()}</p> : null}
        <Link to="/auth/login" className={styles.link}>
          Voltar para o login
        </Link>
      </div>
    </section>
  )
}
