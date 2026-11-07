import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../fonts'
import '../index.css'
import './tools.css'
import ToolsApp from './ToolsApp'
import { I18nProvider } from '../i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ToolsApp />
    </I18nProvider>
  </StrictMode>,
)
