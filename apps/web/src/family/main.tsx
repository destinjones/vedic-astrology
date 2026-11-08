import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../fonts'
import '../index.css'
import '../a11y.css'
import '../lib/display'
import './family.css'
import FamilyApp from './FamilyApp'
import { I18nProvider } from '../i18n'
import { trackPageview } from '../lib/analytics'

trackPageview()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <FamilyApp />
    </I18nProvider>
  </StrictMode>,
)

// works offline once opened, and offers a reload when a new version is out (see lib/offline.ts);
// loaded after the page, so it adds nothing to the first load
void import('../lib/offline').then((m) => m.initOffline())
