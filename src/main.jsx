import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'

const t = localStorage.getItem('pf-tema-cache')
if (t) document.documentElement.dataset.theme = t

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
