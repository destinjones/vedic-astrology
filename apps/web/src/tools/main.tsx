import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../fonts'
import '../index.css'
import '../a11y.css'
import '../lib/display'
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

// works offline once opened, and offers a reload when a new version is out (see lib/offline.ts);
// loaded after the page, so it adds nothing to the first load
void import('../lib/offline').then((m) => m.initOffline())
