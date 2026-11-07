import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../fonts'
import '../index.css'
import './match.css'
import MatchApp from './MatchApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MatchApp />
  </StrictMode>,
)
