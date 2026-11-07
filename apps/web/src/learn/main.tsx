import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../fonts'
import '../index.css'
import '../a11y.css'
import '../lib/display'
import './learn.css'
import LearnApp from './LearnApp'
import { I18nProvider } from '../i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <LearnApp />
    </I18nProvider>
  </StrictMode>,
)
