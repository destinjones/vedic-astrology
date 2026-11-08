import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../fonts'
import '../index.css'
import '../a11y.css'
import '../lib/display'
import './intake.css'
import IntakeApp from './IntakeApp'
import { I18nProvider } from '../i18n'
import { trackPageview } from '../lib/analytics'

// counts the visit by path only: the astrologer's details after the # are never sent
trackPageview()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <IntakeApp />
    </I18nProvider>
  </StrictMode>,
)
