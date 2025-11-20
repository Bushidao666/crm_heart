import { Outlet } from 'react-router-dom'

import { Sidebar } from '@/app/layouts/sidebar'
import { Topbar } from '@/app/layouts/topbar'
import { ActivityTracker } from '@/app/components/activity-tracker'

import styles from './app-layout.module.css'

export const AppLayout = () => {
  return (
    <div className={styles.layout}>
      <ActivityTracker />
      <Sidebar />
      <div className={styles.content}>
        <Topbar />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
