import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './auth/AuthProvider'
import { CompanyProvider } from './company/CompanyProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'
import { BrandingProvider } from './branding/BrandingProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <CompanyProvider><BrandingProvider><App /></BrandingProvider></CompanyProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
