import { RouterProvider } from 'react-router-dom'

import { router } from '@/app/router'
import { ToastProvider } from '@/app/providers/toast-provider'

const App = () => {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}

export default App
