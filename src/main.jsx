import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'

const t = localStorage.getItem('pf-tema-cache')
if (t) document.documentElement.dataset.theme = t

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)

// Listas con scroll propio: la rueda del ratón o el trackpad las mueven con solo pasar el cursor por encima,
// sin tener que hacer clic antes (algunos navegadores siguen moviendo la página mientras dura el gesto).
// Cuando la lista llega arriba o abajo, el scroll pasa a la página.
document.addEventListener('wheel', e => {
  if (e.ctrlKey || !(e.target instanceof Element)) return
  const el = e.target.closest('.tablewrap, .fill')
  if (!el || el.scrollHeight <= el.clientHeight + 1) return
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY
  if (!dy || Math.abs(e.deltaX) > Math.abs(dy)) return
  const max = el.scrollHeight - el.clientHeight
  if ((dy < 0 && el.scrollTop <= 0) || (dy > 0 && el.scrollTop >= max - 1)) return
  e.preventDefault()
  el.scrollTop = Math.max(0, Math.min(max, el.scrollTop + dy))
}, { passive: false })
