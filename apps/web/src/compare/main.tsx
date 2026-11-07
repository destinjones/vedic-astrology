import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../fonts'
import '../index.css'
import './compare.css'
import CompareApp from './CompareApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CompareApp />
  </StrictMode>,
)
