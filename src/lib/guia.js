// Capítulos de la guía interactiva. Cada paso ilumina un elemento real de la app.
// sel: clave data-tour, selector CSS, o [escritorio, móvil]. tab: pestaña a abrir antes.
// clic: el paso espera a que la persona pulse lo iluminado (true o texto de la indicación).

const esc = () => new Promise(r => {
  let n = 0
  const paso = () => { if (document.querySelector('.modal-wrap') && n++ < 4) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); setTimeout(paso, 120) } else r() }
  paso()
})
const pulsar = sel => () => { const el = document.querySelector(sel); if (el) el.click() }
const serieGasto = () => { const h = document.querySelector('[data-tour="kpi-gasto"]'); if (h && h.getAttribute('aria-pressed') !== 'true') h.click() }

export const CAPITULOS = [
  {
    id: 'primeros', titulo: 'Primeros pasos', icono: '🧭', min: 1,
    resumen: 'Cómo moverte por la app: presupuestos, periodo, secciones y tu cuenta.',
    pasos: [
      { tab: 'resumen', antes: esc, titulo: 'Bienvenido a Cuentas Claras', texto: 'En dos minutos te enseño lo básico. Puedes salir cuando quieras con la ✕ y volver desde el botón de ayuda (?) de arriba.' },
      { sel: 'perfil', titulo: 'Qué presupuesto estás viendo', texto: 'Aquí cambias entre tu presupuesto personal y los compartidos (por ejemplo, el de la familia). Cada uno tiene sus propias categorías y movimientos.' },
      { sel: 'periodo', titulo: 'El periodo', texto: 'Todo lo que ves se calcula para este periodo. Cambia entre Mes, Año o un rango personalizado, y usa las flechas para ir al anterior o al siguiente.' },
      { sel: ['menu', 'nav'], titulo: 'Las secciones', texto: 'Resumen para ver cómo vas, Movimientos para lo que entra y sale, Presupuesto para planificar el año y Ajustes para tus categorías.' },
      { sel: 'cuenta', titulo: 'Tu cuenta', texto: 'Desde aquí cambias entre modo claro y oscuro, abres esta guía y cierras sesión.' },
      { sel: 'ayuda', titulo: 'Ayuda siempre a mano', texto: 'Este botón abre la guía de la pantalla en la que estés. Si estás en Presupuesto, te enseña Presupuesto.' },
    ],
  },
  {
    id: 'resumen', titulo: 'Leer el Resumen', icono: '📊', min: 2,
    resumen: 'Las cajas, el gráfico del año, los avisos y el detalle de cada categoría.',
    pasos: [
      { tab: 'resumen', antes: async () => { await esc(); serieGasto() }, sel: 'kpi-gasto', titulo: 'Lo que llevas gastado', texto: 'La caja grande compara lo gastado con el presupuesto del periodo y te dice cuánto te queda o cuánto te has pasado.' },
      { sel: 'kpi-ingreso', clic: 'Pulsa la caja de Ingresos', titulo: 'Las cajas son botones', texto: 'Al pulsar Ingresos o Balance, el gráfico y la lista de abajo pasan a mostrar eso.' },
      { sel: 'grafico', titulo: 'El año mes a mes', texto: 'Cada barra es un mes; la raya discontinua es el presupuesto. Pasa el ratón o toca una barra para ver sus cifras.' },
      { antes: serieGasto, sel: 'avisos', titulo: 'Lo que requiere atención', texto: 'Categorías que se pasan, movimientos sin categoría o meses que vienen en rojo. Con el ✓ marcas un aviso como revisado (solo para ti).' },
      { sel: 'categorias', titulo: 'Por categoría', texto: 'Cada categoría con lo gastado, el presupuesto y el saldo. Puedes buscar y ordenar.' },
      { sel: ['[data-tour="categorias"] tbody tr', '[data-tour="categorias"] button.col'], clic: 'Pulsa una categoría', espera: 900, titulo: 'Ver qué hay dentro', texto: 'Al pulsar una categoría se abre una ventana con todos sus movimientos, sin salir del Resumen.' },
      { sel: '.modal', titulo: 'El detalle', texto: 'Aquí ves el total, el presupuesto y cada movimiento. Toca uno para editarlo o cambiarle la categoría. Al cerrar, sigues donde estabas.', despues: () => esc() },
    ],
  },
  {
    id: 'movimientos', titulo: 'Movimientos', icono: '🧾', min: 1,
    resumen: 'Buscar, filtrar, añadir y corregir lo que entra y sale.',
    pasos: [
      { tab: 'movimientos', antes: esc, sel: 'lista-movs', titulo: 'Todos tus movimientos', texto: 'Ordenados por fecha. Puedes buscar por concepto, filtrar por categoría o cuenta y ordenar por cualquier columna.' },
      { sel: 'periodo', titulo: 'Del periodo elegido', texto: 'La lista muestra solo el periodo de arriba. Cámbialo para ver otros meses o el año entero.' },
      { sel: 'nuevo-mov', titulo: 'Añadir a mano', texto: 'Para un gasto en efectivo o algo que aún no sale en el banco.' },
      { sel: 'importar', titulo: 'O traerlos del banco', texto: 'Lo más cómodo es importar el extracto: lo vemos en el capítulo «Importar el extracto».' },
    ],
  },
  {
    id: 'importar', titulo: 'Importar el extracto', icono: '🏦', min: 2,
    resumen: 'Sube el Excel del banco: detecta lo ya apuntado y sugiere categorías.',
    pasos: [
      { tab: 'movimientos', antes: esc, sel: 'importar', clic: 'Pulsa Importar extracto', espera: 900, titulo: 'Descarga el extracto del banco', texto: 'En la web de tu banco, descarga los movimientos en Excel o CSV. Luego pulsa aquí.' },
      { sel: '.modal', titulo: 'Elige el archivo', texto: 'La app reconoce sola las columnas de fecha, concepto e importe. Si el extracto tiene varios bloques (pendientes y confirmados) los separa.' },
      { sel: '.modal', titulo: 'Qué hace con cada movimiento', texto: '«Nuevos» salen marcados con la categoría sugerida según tu historial. «Ya en la app», «Pendientes» y «Anteriores» salen sin marcar para que no se dupliquen.' },
      { sel: '.modal', titulo: 'Revisa e importa', texto: 'Cambia la categoría que quieras, marca o desmarca y pulsa «Importar». Listo.', despues: () => esc() },
    ],
  },
  {
    id: 'presupuesto', titulo: 'Hacer el presupuesto', icono: '🗓️', min: 2,
    resumen: 'Planifica el año por categorías, cópialo del anterior o impórtalo de Excel.',
    pasos: [
      { tab: 'presupuesto', antes: esc, sel: 'rejilla', titulo: 'Tu año por categorías', texto: 'Cada fila es una categoría y cada columna un mes. Arriba puedes ver el presupuesto, lo real o la diferencia.' },
      { sel: ['editar-rejilla', '[data-tour="rejilla"] button.col, [data-tour="rejilla"] .listrow'], titulo: 'Cambiar importes', texto: 'Edita las cifras directamente, o pulsa una categoría para poner «Igual cada mes» (escribe lo de un mes y se reparte solo) o «Mes a mes».' },
      { sel: 'copiar-anyo', titulo: 'Copiar el año anterior', texto: 'Para empezar un año nuevo en un segundo y luego ajustar lo que cambie.' },
      { sel: 'importar-pres', titulo: 'O desde Excel', texto: 'Descarga la plantilla, rellénala y súbela. La app empareja las categorías.' },
      { sel: 'liquidez', titulo: '¿Cómo queda tu liquidez?', texto: 'Debajo ves el saldo mes a mes con este presupuesto, y se recalcula al momento mientras editas.' },
    ],
  },
  {
    id: 'liquidez', titulo: 'Liquidez y saldo', icono: '📈', min: 1,
    resumen: 'Ve con antelación los meses justos y ajusta el saldo real.',
    pasos: [
      { tab: 'resumen', antes: esc, sel: 'liquidez', titulo: 'Tu saldo mes a mes', texto: 'Los meses pasados usan lo real; los futuros, el presupuesto. La zona roja marca cuándo te quedarías en negativo.' },
      { sel: '[aria-label="Editar saldo inicial"]', titulo: 'El punto de partida', texto: 'Pon lo que tenías en las cuentas a 1 de enero. Todo el cálculo parte de aquí.' },
      { sel: '[data-tour="liquidez"] svg', titulo: 'Ajustar a la realidad', texto: 'Si un mes el saldo real no cuadra, pulsa ese mes y ajusta su saldo inicial. Los siguientes se recalculan desde ahí.' },
    ],
  },
  {
    id: 'exportar', titulo: 'Exportar a Excel o PDF', icono: '📄', min: 1,
    resumen: 'Descarga lo que ves o todo el histórico.',
    pasos: [
      { tab: 'resumen', antes: esc, sel: 'exportar', clic: 'Pulsa Exportar', espera: 700, titulo: 'Exportar', texto: 'Está en Resumen, Movimientos y Presupuesto.' },
      { sel: '.modal', titulo: 'Elige formato y contenido', texto: 'Excel para seguir trabajando o PDF con el diseño de la app. «Lo que ves en pantalla» o «Todo completo». Incluye el presupuesto, la fecha y quién lo exporta.', despues: () => esc() },
    ],
  },
  {
    id: 'ajustes', titulo: 'Categorías y ajustes', icono: '⚙️', min: 1,
    resumen: 'Crea, ordena, desactiva o borra categorías.',
    pasos: [
      { tab: 'ajustes', antes: esc, sel: 'categorias-ajustes', titulo: 'Tus categorías', texto: 'Cada presupuesto tiene las suyas, de gasto o de ingreso. Puedes desactivar las que ya no uses sin perder el histórico.' },
      { sel: 'nueva-cat', titulo: 'Crear una categoría', texto: 'Ponle nombre, tipo y color. Luego asígnale presupuesto en la pestaña Presupuesto.' },
    ],
  },
  {
    id: 'compartido', titulo: 'Presupuesto compartido', icono: '👨‍👩‍👧', min: 1,
    resumen: 'Gastos comunes con tu familia sin mezclar lo personal.',
    pasos: [
      { tab: 'resumen', antes: esc, sel: 'perfil', clic: 'Pulsa aquí', espera: 600, titulo: 'Personal y compartido', texto: 'Tu presupuesto personal solo lo ves tú. Los compartidos los ven todos sus miembros.' },
      { sel: '[role="menu"]', titulo: 'Cambia de uno a otro', texto: 'Elige el presupuesto que quieras ver. Cada uno tiene sus categorías, movimientos, avisos y liquidez.', despues: () => document.querySelector('[role="menu"]')?.previousElementSibling?.click() },
    ],
  },
]

// Capítulo que abre el botón de ayuda según la pantalla
export const CAPITULO_DE_TAB = { resumen: 'resumen', movimientos: 'movimientos', presupuesto: 'presupuesto', ajustes: 'ajustes', admin: 'primeros' }
