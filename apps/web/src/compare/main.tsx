import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../fonts'
import '../index.css'
import '../a11y.css'
import '../lib/display'
import './compare.css'
import CompareApp from './CompareApp'
import { I18nProvider } from '../i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <CompareApp />
    </I18nProvider>
  </StrictMode>,
)
