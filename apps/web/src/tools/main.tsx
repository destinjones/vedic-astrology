import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../fonts'
import '../index.css'
import './tools.css'
import ToolsApp from './ToolsApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToolsApp />
  </StrictMode>,
)
