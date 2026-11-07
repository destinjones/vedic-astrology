import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { checkOnOpen } from './lib/notify'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)

// favourable-window notifications, if the user turned them on (see lib/notify.ts)
checkOnOpen()
