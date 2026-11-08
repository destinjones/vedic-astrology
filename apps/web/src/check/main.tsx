import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../fonts'
import '../index.css'
import '../tools/tools.css'
import './check.css'
import CheckApp from './CheckApp'
import { I18nProvider } from '../i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <CheckApp />
    </I18nProvider>
  </StrictMode>,
)

// works offline once opened, and offers a reload when a new version is out (see lib/offline.ts);
// loaded after the page, so it adds nothing to the first load
void import('../lib/offline').then((m) => m.initOffline())
