import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { AuthProvider } from '@/app/providers/auth-provider'
import { CompanyProvider } from '@/app/providers/company-provider'
import '@/styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CompanyProvider>
        <App />
      </CompanyProvider>
    </AuthProvider>
  </StrictMode>,
)
