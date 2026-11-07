import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './index.css'
import './a11y.css'
import './lib/display'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { trackPageview } from './lib/analytics'

trackPageview()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
