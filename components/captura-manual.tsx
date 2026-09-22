'use client'

/**
 * Captura manual de los valores REALES de un mes, quincena a quincena y por
 * bloques.
 *
 * Es la pantalla donde una persona se sienta con el informe de HighLevel
 * delante y teclea lo que de verdad pasó. Tiene que entenderse a simple
 * vista: a la izquierda una tabla por bloque, dos casillas por fila y, al
 * lado, el total del mes y su plan; a la derecha, fijo al bajar, un gráfico
 * de barras sencillo del bloque que se está escribiendo, que dice al momento
 * si va en plan o fuera de plan (`CapturaEnVivo`).
 *
 *  1. SE CAPTURA POR QUINCENA. Cada indicador tiene dos casillas, la 1ª y la
 *     2ª quincena, que se guardan por separado. El total del mes no se
 *     teclea: se calcula con la misma regla que usa el tablero
 *     (`resumirMes`).
 *
 *  2. POR BLOQUES, COMO EN EL EXCEL. Cada etapa con sus canales, en el orden
 *     en que avanza el lead; luego el dinero, el gasto y, plegados, los
 *     insumos (`lib/captura/bloques.ts`). Cada bloque lleva sus propios
 *     nombres de columna: se lee solo, sin buscar una cabecera más arriba.
 *
 *  3. LOS TOTALES NO SE TECLEAN. Salen de sumar sus partes
 *     (`completarTotales`) y van en la última fila del bloque, sin casilla:
 *     no pueden descuadrar. Qué es total lo dice el libro del plan:
 *     Discoveries lo es en los que la reparten por canal (desde el 0726).
 *
 *  4. VACÍO NO ES CERO. Una casilla vacía no se guarda; un 0 sí, porque es un
 *     dato («no hubo cierres»).
 *
 *  5. GUARDAR PIDE LA CONTRASEÑA, SIEMPRE. No hay cuentas: la contraseña de
 *     captura es lo que impide que cualquiera con el enlace cambie las
 *     cifras. Se pide en cada guardado y no se recuerda.
 *
 *  6. LAS TASAS, AL LADO DEL PLAN. Entre las etapas, y bajo las variables
 *     previas de cada canal, la tasa real de cada quincena y del mes frente a
 *     la del plan (hoja «Variables»). Se recalculan al teclear, así que
 *     también delatan una cifra mal escrita: nadie convierte el 300 %.
 */

import {
  Fragment,
  startTransition,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import { ArrowsClockwiseIcon, CaretDownIcon, CheckIcon, WarningIcon } from '@phosphor-icons/react/ssr'
import {
  BadgeCheck,
  Banknote,
  BookOpen,
  Building2,
  ClipboardList,
  Coins,
  Contact,
  Eye,
  FileCheck2,
  FileText,
  Handshake,
  Layers,
  Link2,
  Mail,
  MailOpen,
  Megaphone,
  MousePointerClick,
  PenLine,
  Percent,
  PhoneCall,
  Radar,
  RefreshCw,
  Repeat,
  ScanSearch,
  Send,
  Sigma,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import type { Canal, Indicador, Meta, Periodo, Real, TasaDelPlan, Unidad } from '@/lib/tipos'
import { NOMBRE_CANAL, colorDeCanal } from '@/lib/tipos'
import { formatearTasaConversion, formatearValor } from '@/lib/comparacion'
import { costePorMil, tasaEntre, tasaReal } from '@/lib/tasas'
import { resumirMes } from '@/lib/reales/mes'
import { bloquesDe, bloquesPorCanalDe, type BloqueCaptura } from '@/lib/captura/bloques'
import { completarTotales } from '@/lib/captura/totales'
import { idsCapturables, totalesCalculadosEn } from '@/lib/plan/sumas'
import {
  PATRON_ENTRADA,
  aBorrador,
  aNumero,
  aValores,
  mismoValor,
} from '@/lib/captura/borrador'
import { cn } from '@/lib/utils'
import type { ResultadoGuardado } from '@/app/captura/acciones'
import { COLOR_FAMILIA } from '@/components/graficos/config'
import { IconoEnPastilla } from '@/components/graficos/hoja'
import { DialogoClave } from '@/components/dialogo-clave'
import { CapturaEnVivo, type FilaEnVivo } from '@/components/captura-en-vivo'
import { PlanDeNegocio } from '@/components/plan-de-negocio'

// ── Estructura ──────────────────────────────────────────────────────────

/** Por debajo de este ancho la tabla scrollea dentro de su caja, nunca la página. */
const ANCHO_TABLA = 'min-w-[50rem]'

/**
 * El icono de cada fila, en gris y pequeño: se reconoce el canal o la partida
 * antes de leer el nombre. Los mismos que el tablero donde el tablero los
 * tiene (canales, etapas, partidas del dinero).
 */
const ICONO_CANAL: Record<Canal, LucideIcon> = {
  publicidad: Megaphone,
  prospeccion: Radar,
  referidos: Handshake,
  afiliados: Link2,
  contenido: FileText,
  newsletter: Mail,
  interno: Building2,
}
const ICONO_ETAPA: Record<string, LucideIcon> = {
  eleads: Users,
  llamadas: PhoneCall,
  discoveries: ScanSearch,
  propuestas: ClipboardList,
  ventas: BadgeCheck,
}
const ICONO_INDICADOR: Record<string, LucideIcon> = {
  'ingreso-flecha-recurrente': Repeat,
  'ingreso-arco-recurrente': Repeat,
  'ingreso-flecha-setup': UserPlus,
  'ventas-arco': FileCheck2,
  'ingreso-arco-setup': UserPlus,
  'ingreso-otros': Coins,
  'publicidad-impresiones': Eye,
  'publicidad-clicks': MousePointerClick,
  'publicidad-inversion': Banknote,
  'prospeccion-contactos': Contact,
  'referidos-contactos': Contact,
  'referidos-reactivaciones': RefreshCw,
  'afiliados-contactos': Contact,
  'afiliados-reactivaciones': RefreshCw,
  'contenido-visitas': BookOpen,
  'contenido-creacion': PenLine,
  'newsletter-aperturas': MailOpen,
  'newsletter-envios': Send,
}

/**
 * La banda de una fila al pasar el ratón o escribir en ella: sobresale un
 * poco por los lados, detrás del contenido, para seguir la fila desde el
 * nombre hasta su total sin perderse en el hueco.
 */
const BANDA_FILA =
  'relative isolate before:absolute before:inset-y-0 before:-inset-x-3 before:-z-10 before:rounded-lg before:transition-colors before:duration-150 hover:before:bg-[color-mix(in_oklab,var(--foreground)_2.5%,transparent)] focus-within:before:bg-[color-mix(in_oklab,var(--brand)_4%,transparent)]'

const HAIRLINE = 'border-[color-mix(in_oklab,var(--foreground)_7%,transparent)]'

type Quincena = 'q1' | 'q2'

/**
 * Icono y color de cada bloque: los mismos que el tablero, para que un
 * bloque se reconozca igual aquí que allí.
 */
const APARIENCIA: Record<string, { Icono: LucideIcon; color: string }> = {
  eleads: { Icono: Users, color: COLOR_FAMILIA.embudo },
  llamadas: { Icono: PhoneCall, color: COLOR_FAMILIA.embudo },
  'discoveries-propuestas': { Icono: ScanSearch, color: COLOR_FAMILIA.embudo },
  discoveries: { Icono: ScanSearch, color: COLOR_FAMILIA.embudo },
  propuestas: { Icono: ClipboardList, color: COLOR_FAMILIA.embudo },
  ventas: { Icono: BadgeCheck, color: COLOR_FAMILIA.embudo },
  ingresos: { Icono: Coins, color: COLOR_FAMILIA.dinero },
  captacion: { Icono: Wallet, color: COLOR_FAMILIA.captacion },
  insumos: { Icono: Layers, color: 'var(--muted-foreground)' },
  // Por canal: el icono y el tono de cada canal en el tablero (Canales); los
  // que el plan deja sin cifras, en gris.
  'canal-publicidad': { Icono: Megaphone, color: colorDeCanal('publicidad') },
  'canal-prospeccion': { Icono: Radar, color: colorDeCanal('prospeccion') },
  'canal-referidos': { Icono: Handshake, color: colorDeCanal('referidos') },
  'canal-afiliados': { Icono: Link2, color: colorDeCanal('afiliados') },
  'canal-contenido': { Icono: FileText, color: colorDeCanal('contenido') },
  'canal-newsletter': { Icono: Mail, color: colorDeCanal('newsletter') },
  'canal-interno': { Icono: Building2, color: colorDeCanal('interno') },
  totales: { Icono: Sigma, color: COLOR_FAMILIA.embudo },
}
const APARIENCIA_NEUTRA = { Icono: Layers, color: 'var(--muted-foreground)' }

/** Cómo se agrupan las casillas: por etapa (como el Excel) o por canal. */
type Agrupacion = 'etapa' | 'canal'

/**
 * Los totales que se leen al final de la vista por canal, con su nombre. Solo
 * los que el libro calcula: Discoveries, si la reparte por canal.
 */
const TOTALES_POR_CANAL: Array<{ id: string; nombre: string }> = [
  { id: 'eleads', nombre: 'Engaged Leads' },
  { id: 'llamadas', nombre: 'Llamadas iniciales' },
  { id: 'discoveries', nombre: 'Discoveries' },
  { id: 'ventas', nombre: 'Ventas FLECHA' },
  { id: 'captacion-total', nombre: 'Gasto de captación' },
]

/** Una cifra, o nada si no hay dato: en esta tabla un hueco se lee mejor que un guion. */
const cifra = (valor: number | null, unidad: Unidad) =>
  valor === null ? '' : formatearValor(valor, unidad)

/** Una tasa, o nada si no la hay. */
const porcentaje = (tasa: number | null) => (tasa === null ? '' : formatearTasaConversion(tasa))

/** Las dos filas de las que sale el CPM. Ver `bandaCpm`. */
const ID_INVERSION = 'publicidad-inversion'
const ID_IMPRESIONES = 'publicidad-impresiones'

/**
 * Las tasas que van entre un bloque de etapa y el siguiente. `porCanal`: se
 * despliega canal a canal (solo donde el plan reparte las dos etapas).
 */
const TASAS_TRAS_BLOQUE: Record<string, Array<{ desde: string; hacia: string; porCanal: boolean }>> = {
  eleads: [{ desde: 'eleads', hacia: 'llamadas', porCanal: true }],
  //  en todas: el desplegable aparece solo si el libro reparte por
  // canal las dos etapas del paso. Si no, no hay tasas de canal que enseñar y
  // la fila se queda como una banda simple.
  llamadas: [{ desde: 'llamadas', hacia: 'discoveries', porCanal: true }],
  'discoveries-propuestas': [
    { desde: 'discoveries', hacia: 'propuestas', porCanal: true },
    { desde: 'propuestas', hacia: 'ventas', porCanal: true },
  ],
  discoveries: [{ desde: 'discoveries', hacia: 'propuestas', porCanal: true }],
  propuestas: [{ desde: 'propuestas', hacia: 'ventas', porCanal: true }],
}

/**
 * En la vista por canal, Discoveries repartida vive en cada canal y su total
 * en «Totales»: las dos tasas de Propuestas van juntas tras su bloque.
 */
const TASAS_TRAS_BLOQUE_POR_CANAL: typeof TASAS_TRAS_BLOQUE = {
  ...TASAS_TRAS_BLOQUE,
  propuestas: TASAS_TRAS_BLOQUE['discoveries-propuestas'],
}

/**
 * La banda de una tasa, en carmín: una aguada, un filo muy fino y una raya a
 * la izquierda. Las tasas son el embudo convirtiendo, y el embudo es carmín;
 * así se distinguen de un vistazo de las filas que se teclean.
 */
const BANDA_TASA =
  'bg-[color-mix(in_oklab,var(--brand)_5%,transparent)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--brand)_16%,transparent)] shadow-[inset_3px_0_0_var(--brand)]'

// ── Props ───────────────────────────────────────────────────────────────

export interface CapturaManualProps {
  /** El mes que se captura (siempre un periodo de tipo 'mes'). */
  mes: Periodo
  /** El periodo actualmente seleccionado en el selector (puede ser mes o quincena). */
  periodoActivo: Periodo
  indicadores: Indicador[]
  metasQ1: Meta[]
  metasQ2: Meta[]
  realesQ1: Real[]
  realesQ2: Real[]
  /** Las tasas del plan (hoja «Variables»). */
  tasas: TasaDelPlan[]
  /** El libro del plan en uso, para cambiarlo desde aquí. */
  plan: { libro: string; modificadoEn: string } | null
  /** Por qué no se puede guardar ahora, o null si se puede. */
  bloqueo: string | null
  onGuardar: (
    q1: Record<string, number>,
    q2: Record<string, number>,
    clave: string,
  ) => Promise<ResultadoGuardado>
  /** Cuántas casillas difieren de lo guardado: el tablero avisa antes de salir. */
  onCambiosPendientes: (cuantos: number) => void
}

// ── Componente ──────────────────────────────────────────────────────────

export function CapturaManual({
  mes,
  periodoActivo,
  indicadores,
  metasQ1,
  metasQ2,
  realesQ1,
  realesQ2,
  tasas,
  plan,
  bloqueo,
  onGuardar,
  onCambiosPendientes,
}: CapturaManualProps) {
  const prefijoId = useId()

  const esMes = periodoActivo.tipo === 'mes'
  /** En la vista de quincena, la que se mira. */
  const quincenaVisible: Quincena = periodoActivo.quincena === 2 ? 'q2' : 'q1'
  const quincenasAMostrar: Quincena[] = esMes ? ['q1', 'q2'] : [quincenaVisible]

  /*
   * En quincena la tabla se normaliza a la quincena: no hay total del mes y
   * el plan es el de esa quincena (el del mes entre dos, como lo reparte
   * `lib/plan/quincenas.ts`; las tasas no se parten).
   */
  const columnasAMostrar = esMes
    ? ['1ª quincena', '2ª quincena', 'Total mes', 'Plan mes']
    : [quincenaVisible === 'q1' ? '1ª quincena' : '2ª quincena', 'Plan quincena']

  const claseRejilla = esMes
    ? 'grid grid-cols-[minmax(14rem,1fr)_7rem_7rem_6rem_6rem] items-center gap-x-4'
    : 'grid grid-cols-[minmax(14rem,1fr)_7rem_6rem] items-center gap-x-4'

  const [agrupacion, setAgrupacion] = useState<Agrupacion>('etapa')

  /**
   * El bloque que enseña el panel de la derecha: el último en el que se puso
   * el foco o, al hacer scroll, el que cruza la franja alta de la ventana.
   * Sin ninguno todavía, el primero.
   */
  const refTabla = useRef<HTMLDivElement>(null)
  const [bloqueActivo, setBloqueActivo] = useState<string | null>(null)
  useEffect(() => {
    let marco = 0
    const alDesplazar = () => {
      cancelAnimationFrame(marco)
      marco = requestAnimationFrame(() => {
        // Manda la casilla con el foco mientras siga a la vista: poner el foco
        // hace scroll, y ese scroll no debe llevarse el panel al bloque de
        // arriba. Si la casilla ya salió de la pantalla, manda el scroll.
        const enfocado = document.activeElement
        const conFoco = enfocado?.closest<HTMLElement>('[data-bloque]')
        if (enfocado && conFoco && refTabla.current?.contains(conFoco)) {
          const caja = enfocado.getBoundingClientRect()
          if (caja.bottom > 0 && caja.top < window.innerHeight) {
            setBloqueActivo(conFoco.dataset.bloque ?? null)
            return
          }
        }
        const linea = window.innerHeight * 0.35
        let elegido: string | undefined
        for (const nodo of refTabla.current?.querySelectorAll<HTMLElement>('[data-bloque]') ?? []) {
          if (nodo.getBoundingClientRect().top <= linea) elegido = nodo.dataset.bloque
        }
        if (elegido) setBloqueActivo(elegido)
      })
    }
    window.addEventListener('scroll', alDesplazar, { passive: true })
    // Al cambiar de mes a quincena o de agrupación, la tabla se rehace bajo
    // el mismo scroll: se vuelve a mirar qué bloque queda a la vista.
    alDesplazar()
    return () => {
      window.removeEventListener('scroll', alDesplazar)
      cancelAnimationFrame(marco)
    }
  }, [esMes, agrupacion])

  /**
   * Los bloques y las casillas salen de las filas que trae el libro del plan:
   * Discoveries es una casilla en unos libros y un total en otros.
   */
  const idsDelPlan = useMemo(() => indicadores.map((i) => i.id), [indicadores])
  const bloques = useMemo(() => bloquesDe(idsDelPlan), [idsDelPlan])
  const bloquesPorCanal = useMemo(() => bloquesPorCanalDe(idsDelPlan), [idsDelPlan])
  const esCasilla = useMemo(() => idsCapturables(idsDelPlan), [idsDelPlan])
  const calculados = useMemo(() => totalesCalculadosEn(idsDelPlan), [idsDelPlan])
  /** El último bloque de canal de la vista por canal: detrás van los totales. */
  const ultimoCanal = bloquesPorCanal.filter((b) => b.canal).at(-1)?.id

  const [guardado, setGuardado] = useState(() => ({
    q1: aBorrador(realesQ1, esCasilla),
    q2: aBorrador(realesQ2, esCasilla),
  }))
  const [borrador, setBorrador] = useState(guardado)

  /**
   * Al cambiar de mes —o de libro del plan— se recarga todo, ajustando el
   * estado durante el render (patrón oficial de React para estado derivado de
   * props): así no se pinta ni un fotograma con las cifras del mes anterior
   * bajo el título del nuevo. El tablero ya preguntó antes si había cambios
   * sin guardar, y el plan no se puede cambiar con cambios pendientes.
   */
  const firma = `${mes.id}#${[...esCasilla].join('|')}`
  const [sincronizado, setSincronizado] = useState(firma)
  if (sincronizado !== firma) {
    const nuevo = { q1: aBorrador(realesQ1, esCasilla), q2: aBorrador(realesQ2, esCasilla) }
    setSincronizado(firma)
    setGuardado(nuevo)
    setBorrador(nuevo)
  }

  const [pidiendoClave, setPidiendoClave] = useState(false)
  const [guardando, iniciarGuardado] = useTransition()
  const [errorClave, setErrorClave] = useState<string | null>(null)
  /** El último guardado bueno: su aviso sale cuando el tablero ya está al día. */
  const [guardadoBien, setGuardadoBien] = useState<{ cifras: number; mes: string } | null>(null)

  /** Los indicadores que el plan trajo: uno perdido (una incidencia) no pinta fila. */
  const porId = useMemo(() => new Map(indicadores.map((i) => [i.id, i])), [indicadores])

  const metaDe = useMemo(
    () => ({
      q1: new Map(metasQ1.map((m) => [m.indicadorId, m.valor])),
      q2: new Map(metasQ2.map((m) => [m.indicadorId, m.valor])),
    }),
    [metasQ1, metasQ2],
  )

  /**
   * En la vista por canal, qué canales abren desplegados: los que tienen plan
   * este mes o algo guardado. Los que el plan deja a cero y nadie ha
   * capturado empiezan plegados. Se calcula sobre lo guardado y no sobre el
   * borrador, para que un canal no se pliegue ni se abra mientras se teclea.
   */
  const abiertosPorCanal = useMemo(() => {
    const abiertos = new Set<string>()
    for (const bloque of bloquesPorCanal) {
      if (!bloque.canal) continue
      const filas = bloque.grupos.flatMap((g) => g.filas)
      const conPlan = filas.some((id) => (metaDe.q1.get(id) ?? 0) > 0 || (metaDe.q2.get(id) ?? 0) > 0)
      const conDatos = filas.some((id) => aNumero(guardado.q1[id] ?? '') !== null || aNumero(guardado.q2[id] ?? '') !== null)
      if (conPlan || conDatos) abiertos.add(bloque.id)
    }
    return abiertos
  }, [bloquesPorCanal, metaDe, guardado])

  /** Las casillas de la pantalla, en orden: las filas de los bloques que existen. */
  const capturables = useMemo(
    () =>
      bloques.flatMap((b) => b.grupos.flatMap((g) => g.filas)).filter((id) => porId.has(id)),
    [bloques, porId],
  )

  // Las cifras tecleadas y, con ellas, los totales de cada quincena. Se
  // recalculan en cada pulsación: son pocas sumas, y un total no puede ir un
  // carácter por detrás de sus canales.
  const valores = { q1: aValores(borrador.q1), q2: aValores(borrador.q2) }
  const conTotales = {
    q1: completarTotales(valores.q1, calculados),
    q2: completarTotales(valores.q2, calculados),
  }

  const cambiado = (q: Quincena, id: string) => !mismoValor(borrador[q][id], guardado[q][id])
  // Solo cuentan las casillas tecleadas: un total que cambia porque cambió
  // un canal no es un cambio aparte.
  const cambios = capturables.reduce(
    (n, id) => n + Number(cambiado('q1', id)) + Number(cambiado('q2', id)),
    0,
  )
  const hayCambios = cambios > 0

  useEffect(() => {
    onCambiosPendientes(cambios)
  }, [cambios, onCambiosPendientes])

  // Recargar o cerrar la pestaña con cambios sin guardar: el navegador pregunta.
  useEffect(() => {
    if (cambios === 0) return
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [cambios])

  // El aviso sale al confirmar la transición, cuando el tablero ya se ha
  // vuelto a pintar con lo guardado.
  useEffect(() => {
    if (!guardadoBien) return
    toast.success('Cambios guardados', {
      description: `${guardadoBien.mes}: ${guardadoBien.cifras} ${guardadoBien.cifras === 1 ? 'cifra' : 'cifras'}.`,
    })
  }, [guardadoBien])

  function escribir(quincena: Quincena, indicadorId: string, texto: string) {
    // Una entrada que no encaja se descarta entera: el campo se queda como
    // estaba y el cursor no salta. Nunca se guarda un valor inválido.
    if (!PATRON_ENTRADA.test(texto)) return
    setBorrador((anterior) => ({
      ...anterior,
      [quincena]: { ...anterior[quincena], [indicadorId]: texto },
    }))
  }

  function confirmar(clave: string) {
    setErrorClave(null)
    const enviado = borrador
    const cifras = cambios
    // Dentro de una transición, como pide Next para invocar una Server Action
    // desde un evento: así «Guardando…» dura hasta que el tablero ya se ha
    // vuelto a pintar con lo guardado, y no solo hasta que responde la acción.
    iniciarGuardado(async () => {
      // Solo viajan las casillas del plan en uso: la acción rechaza el resto.
      const soloCasillas = (valores: Record<string, number>) =>
        Object.fromEntries(Object.entries(valores).filter(([id]) => esCasilla.has(id)))
      let resultado: ResultadoGuardado
      try {
        resultado = await onGuardar(soloCasillas(aValores(enviado.q1)), soloCasillas(aValores(enviado.q2)), clave)
      } catch {
        resultado = {
          ok: false,
          motivo: 'servidor',
          mensaje: 'No se pudo conectar con el servidor. Inténtalo de nuevo.',
        }
      }
      // Tras un await, React pide volver a envolver las actualizaciones para
      // que sigan dentro de la transición.
      startTransition(() => {
        if (!resultado.ok) {
          setErrorClave(resultado.mensaje)
          return
        }
        setGuardado(enviado)
        setPidiendoClave(false)
        setGuardadoBien({ cifras, mes: mes.etiqueta })
      })
    })
  }

  /**
   * Las cifras de una fila: cada quincena, el total del mes y el plan que se
   * enseña (el del mes, o el de la quincena en la vista de quincena).
   */
  function delMes(indicador: Indicador) {
    const q1 = conTotales.q1[indicador.id] ?? null
    const q2 = conTotales.q2[indicador.id] ?? null
    const metaQ1 = metaDe.q1.get(indicador.id) ?? null
    const metaQ2 = metaDe.q2.get(indicador.id) ?? null
    // Las metas de las quincenas suman exactamente el mes (lib/plan/quincenas.ts).
    const planMes =
      metaQ1 !== null && metaQ2 !== null ? Math.round((metaQ1 + metaQ2) * 100) / 100 : null
    const plan = esMes ? planMes : quincenaVisible === 'q1' ? metaQ1 : metaQ2
    return { q1, q2, total: resumirMes(q1, q2, metaQ1, metaQ2, planMes).real, plan }
  }

  /**
   * El nombre de una fila en la vista por canal: dentro del bloque de
   * Publicidad, «Publicidad» no dice nada; dice la etapa («Engaged Leads») o
   * que es su gasto.
   */
  function nombreDeFila(bloque: BloqueCaptura, indicador: Indicador) {
    if (!bloque.canal) return indicador.nombre
    if (indicador.desglosaA) return porId.get(indicador.desglosaA)?.nombre ?? indicador.nombre
    if (indicador.grupo === 'captacion') return 'Gasto de captación'
    return indicador.nombre
  }

  /** Los nombres de columna de un bloque, en la fila de su título. */
  function nombresDeColumna(ocultos = false) {
    return columnasAMostrar.map((nombre) => (
      <span
        key={nombre}
        className={cn(
          'text-right text-xs font-medium text-muted-foreground',
          // En un bloque plegado solo se ven al abrirlo.
          ocultos && 'invisible group-open/plegado:visible',
        )}
      >
        {nombre}
      </span>
    ))
  }

  function titulo(bloque: BloqueCaptura, idTitulo: string, detalle?: string) {
    const { Icono, color } = APARIENCIA[bloque.id] ?? APARIENCIA_NEUTRA
    return (
      <span className="flex min-w-0 items-center gap-2.5">
        <IconoEnPastilla Icono={Icono} color={color} tamano="sm" />
        <h3 id={idTitulo} className="text-[0.9375rem] leading-snug font-semibold text-balance text-foreground">
          {bloque.titulo}
        </h3>
        {detalle && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{detalle}</span>
        )}
      </span>
    )
  }

  /**
   * El icono de una fila. En la vista por canal, dentro del bloque de un
   * canal, lo que distingue una fila es su etapa (leads, llamadas…) y no el
   * canal, que ya lo dice el bloque.
   */
  function iconoDeFila(bloque: BloqueCaptura, indicador: Indicador): LucideIcon | undefined {
    if (ICONO_INDICADOR[indicador.id]) return ICONO_INDICADOR[indicador.id]
    if (bloque.canal) {
      if (indicador.desglosaA) return ICONO_ETAPA[indicador.desglosaA]
      if (indicador.grupo === 'captacion') return Wallet
    }
    if (indicador.canal) return ICONO_CANAL[indicador.canal]
    return ICONO_ETAPA[indicador.id]
  }

  function fila(bloque: BloqueCaptura, indicador: Indicador) {
    const { total, plan } = delMes(indicador)
    const nombre = nombreDeFila(bloque, indicador)
    const Icono = iconoDeFila(bloque, indicador)
    return (
      <div key={indicador.id} className={cn(claseRejilla, BANDA_FILA, 'border-t py-1.5', HAIRLINE)}>
        <span title={indicador.definicion} className="flex min-w-0 items-center gap-2.5 text-sm text-foreground">
          {Icono && (
            <Icono aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{nombre}</span>
        </span>
        {quincenasAMostrar.map((q) => (
          <Casilla
            key={q}
            id={`${prefijoId}-${q}-${indicador.id}`}
            // El nombre que se lee en voz alta dice además de qué bloque es:
            // «Engaged Leads, Publicidad» o «Publicidad, Engaged Leads».
            etiqueta={`${bloque.titulo}, ${nombre}, ${q === 'q1' ? '1ª' : '2ª'} quincena`}
            texto={borrador[q][indicador.id] ?? ''}
            unidad={indicador.unidad}
            cambiado={cambiado(q, indicador.id)}
            onEscribir={(texto) => escribir(q, indicador.id, texto)}
          />
        ))}
        {esMes && (
          <span className="text-right text-sm font-medium text-foreground tabular-nums">
            {cifra(total, indicador.unidad)}
          </span>
        )}
        <span className="text-right text-sm text-muted-foreground tabular-nums">
          {cifra(plan, indicador.unidad)}
        </span>
      </div>
    )
  }

  /**
   * Una fila calculada, sin casilla. Como cierre de bloque («Total»), raya
   * más marcada encima y en negrita; en el bloque de totales de la vista por
   * canal, con el filete de las demás filas.
   */
  function filaTotal(totalId: string, nombre = 'Total', cierre = true) {
    const indicador = porId.get(totalId)
    if (!indicador) return null
    const { q1, q2, total, plan } = delMes(indicador)
    const suma = { q1, q2 }
    return (
      <div
        key={totalId}
        data-total
        className={cn(
          claseRejilla,
          'border-t text-sm tabular-nums',
          cierre
            ? // El cierre va sobre una aguada: se lee como el resultado del bloque.
              'relative isolate py-2.5 before:absolute before:inset-y-0 before:-inset-x-3 before:-z-10 before:rounded-b-lg before:bg-[color-mix(in_oklab,var(--foreground)_3.5%,transparent)]'
            : cn(BANDA_FILA, 'py-2', HAIRLINE),
        )}
        style={cierre ? { borderColor: 'var(--regla)' } : undefined}
      >
        <span className={cn('flex min-w-0 items-center gap-2.5 text-foreground', cierre ? 'font-semibold' : 'font-medium')}>
          <Sigma
            aria-hidden="true"
            size={16}
            strokeWidth={cierre ? 2 : 1.75}
            className="shrink-0 text-muted-foreground"
          />
          <span className="truncate">{nombre}</span>
        </span>
        {/* `pr-3`: el mismo relleno que la casilla, para acabar en la misma
            vertical que las cifras tecleadas encima. */}
        {quincenasAMostrar.map((q) => (
          <span key={q} className="pr-3 text-right font-semibold text-foreground">
            {cifra(suma[q], indicador.unidad)}
          </span>
        ))}
        {esMes && (
          <span className="text-right font-semibold text-foreground">{cifra(total, indicador.unidad)}</span>
        )}
        <span className="text-right font-medium text-muted-foreground">{cifra(plan, indicador.unidad)}</span>
      </div>
    )
  }

  /**
   * El CPM, en su banda, entre la inversión y las impresiones.
   *
   * No sale de la hoja «Variables» como las demás tasas: es un precio que se
   * deriva de dos filas que ya están en la tabla, justo las dos entre las que
   * va. Por eso no es un `TasaDelPlan` y necesita su propia banda: va en
   * euros y no en porcentaje.
   */
  function bandaCpm() {
    const cpm = (q: Quincena) =>
      costePorMil(conTotales[q][ID_INVERSION] ?? null, conTotales[q][ID_IMPRESIONES] ?? null)
    const planMes = (id: string) => {
      const m1 = metaDe.q1.get(id) ?? null
      const m2 = metaDe.q2.get(id) ?? null
      return m1 === null && m2 === null ? null : (m1 ?? 0) + (m2 ?? 0)
    }
    const delPlan = costePorMil(planMes(ID_INVERSION), planMes(ID_IMPRESIONES))
    const enEuros = (valor: number | null) => (valor === null ? '' : formatearValor(valor, 'moneda'))

    return (
      <div
        key="cpm"
        data-tasa="cpm"
        className={cn(claseRejilla, '-mx-3 my-1 mb-1 rounded-lg py-2 pr-3 pl-4', BANDA_TASA)}
      >
        <NombreTasa texto="CPM" Icono={Banknote} />
        {quincenasAMostrar.map((q) => (
          <span
            key={q}
            className={cn(
              'pr-3 text-right text-sm tabular-nums',
              esMes ? 'text-muted-foreground' : 'font-medium text-foreground',
            )}
          >
            {enEuros(cpm(q))}
          </span>
        ))}
        {esMes && (
          <span className="text-right text-sm font-medium text-foreground tabular-nums">
            {enEuros(costePorMil(realDelMes(ID_INVERSION), realDelMes(ID_IMPRESIONES)))}
          </span>
        )}
        <span className="text-right text-sm text-muted-foreground tabular-nums">{enEuros(delPlan)}</span>
      </div>
    )
  }

  /** Una tasa en su banda, entre las filas que se teclean. */
  function bandaTasa(tasa: TasaDelPlan, clase = 'mb-1') {
    return (
      <div
        key={tasa.id}
        data-tasa={tasa.id}
        className={cn(claseRejilla, '-mx-3 my-1 rounded-lg py-2 pr-3 pl-4', clase, BANDA_TASA)}
      >
        {celdasTasa(tasa, <NombreTasa texto={tasa.nombre} />)}
      </div>
    )
  }

  /**
   * Las filas de un canal, en la vista por canal: su materia prima con sus
   * tasas; sus leads y, debajo, su conversión a llamada; sus llamadas, sus
   * ventas y su gasto.
   */
  function filasDeCanal(bloque: BloqueCaptura) {
    const canal = bloque.canal
    if (!canal) return null
    const indicadoresDe = (ids: readonly string[]) =>
      ids.map((id) => porId.get(id)).filter((x): x is Indicador => !!x)
    const todas = indicadoresDe(bloque.grupos.flatMap((g) => g.filas))
    const previas = todas.filter((i) => i.grupo === 'insumo')
    const resto = todas.filter((i) => i.grupo !== 'insumo')
    const tasasPrevias = tasas.filter((t) => t.canal === canal && porId.get(t.desde)?.grupo === 'insumo')
    // Cada tasa bajo su etapa de origen, si el canal tiene también la de destino.
    const tasaTras = (indicador: Indicador) => {
      if (indicador.desglosaA === 'eleads') return tasaEntre(tasas, indicador.id, `llamadas.${canal}`)
      if (indicador.desglosaA === 'llamadas' && porId.has(`discoveries.${canal}`)) {
        return tasaEntre(tasas, indicador.id, `discoveries.${canal}`)
      }
      return undefined
    }
    return (
      <>
        {/* Cada variable previa con la tasa que sale de ella, y no todas las
            tasas juntas al final: la cadena del canal es «impresiones ─CTR→
            clics ─CVR→ leads», y leerla en ese orden es lo que explica de
            dónde sale cada cifra. Agrupadas, había que ir y volver. */}
        {previas.map((indicador) => {
          const tasa = tasasPrevias.find((t) => t.desde === indicador.id)
          return (
            <Fragment key={indicador.id}>
              {fila(bloque, indicador)}
              {/* El CPM no está en «Variables»: se deriva de la inversión y
                  las impresiones, y va entre las dos. */}
              {indicador.id === ID_INVERSION && porId.has(ID_IMPRESIONES) && bandaCpm()}
              {tasa && bandaTasa(tasa)}
            </Fragment>
          )
        })}
        {/* Una tasa cuyo origen no es ninguna de las filas de arriba se
            quedaría sin pintar: va detrás, que es mejor que perderla. */}
        {tasasPrevias
          .filter((t) => !previas.some((i) => i.id === t.desde))
          .map((tasa) => bandaTasa(tasa))}
        {resto.map((indicador) => {
          const tasa = tasaTras(indicador)
          return (
            <Fragment key={indicador.id}>
              {fila(bloque, indicador)}
              {tasa && bandaTasa(tasa)}
            </Fragment>
          )
        })}
      </>
    )
  }

  function filasDe(bloque: BloqueCaptura) {
    return bloque.grupos.map((grupo, i) => {
      const filas = grupo.filas.map((id) => porId.get(id)).filter((x): x is Indicador => !!x)
      if (filas.length === 0) return null
      // Las variables previas de un canal llevan debajo sus tasas: de la
      // materia prima a los leads, con el nombre que les da el Excel.
      const canal = filas[0].grupo === 'insumo' ? filas[0].canal : undefined
      const tasasDelGrupo = canal
        ? tasas.filter((t) => t.canal === canal && porId.get(t.desde)?.grupo === 'insumo')
        : []
      return (
        <div key={grupo.titulo ?? i}>
          {grupo.titulo && (
            <p className={cn('border-t pt-3 pb-1 text-xs font-medium text-muted-foreground', HAIRLINE)}>
              {grupo.titulo}
            </p>
          )}
          {filas.map((indicador) => fila(bloque, indicador))}
          {tasasDelGrupo.map((tasa) => bandaTasa(tasa))}
        </div>
      )
    })
  }

  /**
   * Un bloque que se pliega: el título con cuántas casillas llevan cifra y
   * los nombres de columna, que solo se ven al abrirlo. Plegar no descarta
   * nada: sus casillas siguen en el borrador y en el contador de cambios.
   */
  function bloquePlegable(bloque: BloqueCaptura, idTitulo: string, contenido: ReactNode, abierto?: boolean) {
    const filas = bloque.grupos.flatMap((g) => g.filas).filter((id) => porId.has(id))
    if (filas.length === 0) return null
    const capturados = filas.filter(
      (id) => aNumero(borrador.q1[id] ?? '') !== null || aNumero(borrador.q2[id] ?? '') !== null,
    ).length
    return (
      <details
        key={bloque.id}
        open={abierto}
        data-bloque={bloque.id}
        onFocus={() => setBloqueActivo(bloque.id)}
        className="group/plegado pt-8"
      >
        <summary
          className={cn(
            claseRejilla,
            'cursor-pointer list-none rounded-md pb-2 -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {titulo(bloque, idTitulo, `${capturados} de ${filas.length}`)}
            <CaretDownIcon
              weight="bold"
              aria-hidden="true"
              className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open/plegado:rotate-180"
            />
          </span>
          {nombresDeColumna(true)}
        </summary>
        {contenido}
      </details>
    )
  }

  /**
   * En la vista por canal, los totales de todos los canales, sin casilla:
   * lo que se compara con el total del informe del CRM. Con la conversión a
   * llamada y la cualificación globales entre sus filas.
   */
  function bloqueTotales() {
    const idTitulo = `${prefijoId}-bloque-totales`
    const conversion = tasaEntre(tasas, 'eleads', 'llamadas')
    const cualificacion = tasaEntre(tasas, 'llamadas', 'discoveries')
    const pseudo: BloqueCaptura = { id: 'totales', titulo: 'Totales', grupos: [], total: null, plegado: false }
    return (
      <div
        role="group"
        aria-labelledby={idTitulo}
        data-bloque="totales"
        onFocus={() => setBloqueActivo('totales')}
        className="pt-8"
      >
        <div className={cn(claseRejilla, 'pb-2')}>
          {titulo(pseudo, idTitulo)}
          {nombresDeColumna()}
        </div>
        {TOTALES_POR_CANAL.filter(({ id }) => calculados.has(id)).map(({ id, nombre }) => (
          <Fragment key={id}>
            {filaTotal(id, nombre, false)}
            {id === 'eleads' && conversion && bandaTasa(conversion)}
            {id === 'llamadas' && cualificacion && bandaTasa(cualificacion)}
          </Fragment>
        ))}
      </div>
    )
  }

  /** Lo real de un indicador en el mes, con la regla de siempre. */
  function realDelMes(id: string) {
    const q1 = conTotales.q1[id] ?? null
    const q2 = conTotales.q2[id] ?? null
    return resumirMes(q1, q2, null, null, null).real
  }

  /**
   * Las celdas de una fila de tasa, en las columnas de la tabla: la tasa real
   * de cada quincena visible, la del mes en «Total mes» (solo en la vista de
   * mes) y la del plan en la columna del plan. La tasa del plan no se parte.
   */
  function celdasTasa(tasa: TasaDelPlan, nombre: ReactNode) {
    const real = (q: Quincena) =>
      tasaReal(conTotales[q][tasa.desde] ?? null, conTotales[q][tasa.hacia] ?? null)
    return (
      <>
        {nombre}
        {quincenasAMostrar.map((q) => (
          <span
            key={q}
            className={cn(
              'pr-3 text-right text-sm tabular-nums',
              // En quincena es la única tasa real: se lee como la del mes.
              esMes ? 'text-muted-foreground' : 'font-medium text-foreground',
            )}
          >
            {porcentaje(real(q))}
          </span>
        ))}
        {esMes && (
          <span className="text-right text-sm font-medium text-foreground tabular-nums">
            {porcentaje(tasaReal(realDelMes(tasa.desde), realDelMes(tasa.hacia)))}
          </span>
        )}
        <span className="text-right text-sm text-muted-foreground tabular-nums">
          {porcentaje(tasa.plan)}
        </span>
      </>
    )
  }

  /** ¿Tiene el canal algo que convertir este mes? Plan o resultado en su etapa de origen. */
  function canalConCifras(desdeId: string) {
    const conPlan = (metaDe.q1.get(desdeId) ?? 0) > 0 || (metaDe.q2.get(desdeId) ?? 0) > 0
    return conPlan || conTotales.q1[desdeId] !== undefined || conTotales.q2[desdeId] !== undefined
  }

  /**
   * Las tasas que van entre un bloque de etapa y el siguiente. La que se
   * reparte por canal es un desplegable: cerrado, la tasa total; abierto,
   * una fila por canal con cifras.
   */
  function tasasTras(bloqueId: string) {
    const pasos = (agrupacion === 'canal' ? TASAS_TRAS_BLOQUE_POR_CANAL : TASAS_TRAS_BLOQUE)[bloqueId]
    if (!pasos) return null
    return pasos.map(({ desde, hacia, porCanal }) => {
      const total = tasaEntre(tasas, desde, hacia)
      if (!total) return null
      const canales = porCanal
        ? tasas.filter(
            (t) =>
              t.canal !== undefined &&
              t.desde === `${desde}.${t.canal}` &&
              t.hacia === `${hacia}.${t.canal}` &&
              canalConCifras(t.desde),
          )
        : []

      if (canales.length === 0) {
        return (
          <div
            key={total.id}
            data-tasa={total.id}
            className={cn(claseRejilla, '-mx-3 mt-3 rounded-lg py-2.5 pr-3 pl-4', BANDA_TASA)}
          >
            {celdasTasa(total, <NombreTasa texto={total.nombre} fuerte />)}
          </div>
        )
      }

      return (
        <details key={total.id} data-tasa={total.id} className={cn('group/tasa -mx-3 mt-3 rounded-lg', BANDA_TASA)}>
          <summary
            className={cn(
              claseRejilla,
              'cursor-pointer list-none rounded-lg py-2.5 pr-3 pl-4 -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden',
            )}
          >
            {celdasTasa(
              total,
              <NombreTasa texto={total.nombre} fuerte>
                {/* Un botón que se ve botón: en carmín, con la flecha que
                    gira al abrirse. */}
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--brand)_10%,transparent)] py-0.5 pr-1.5 pl-2 text-xs font-medium text-brand transition-colors duration-150 group-hover/tasa:bg-[color-mix(in_oklab,var(--brand)_16%,transparent)]">
                  Por canal
                  <CaretDownIcon
                    weight="bold"
                    aria-hidden="true"
                    className="size-3 transition-transform duration-200 group-open/tasa:rotate-180"
                  />
                </span>
              </NombreTasa>,
            )}
          </summary>
          <div className="pr-3 pb-1.5 pl-4">
            {canales.map((tasa) => {
              const IconoCanal = tasa.canal ? ICONO_CANAL[tasa.canal] : undefined
              return (
                <div
                  key={tasa.id}
                  data-tasa={tasa.id}
                  className={cn(
                    claseRejilla,
                    'border-t border-[color-mix(in_oklab,var(--brand)_14%,transparent)] py-1.5',
                  )}
                >
                  {celdasTasa(
                    tasa,
                    <span className="flex min-w-0 items-center gap-2.5 pl-8.5 text-sm text-foreground">
                      {IconoCanal && (
                        <IconoCanal aria-hidden="true" size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{tasa.canal ? NOMBRE_CANAL[tasa.canal] : tasa.nombre}</span>
                    </span>,
                  )}
                </div>
              )
            })}
          </div>
        </details>
      )
    })
  }

  /** Real y plan de una fila para el panel: el mes (a la fecha) o la quincena que se mira. */
  function lecturaEnVivo(id: string): { real: number | null; plan: number | null } {
    const q1 = conTotales.q1[id] ?? null
    const q2 = conTotales.q2[id] ?? null
    const m1 = metaDe.q1.get(id) ?? null
    const m2 = metaDe.q2.get(id) ?? null
    if (!esMes) return quincenaVisible === 'q1' ? { real: q1, plan: m1 } : { real: q2, plan: m2 }
    // Un mes a medias se compara con el plan de lo que ya pasó, como el tablero.
    const planMes = m1 !== null && m2 !== null ? Math.round((m1 + m2) * 100) / 100 : null
    const { real, meta } = resumirMes(q1, q2, m1, m2, planMes)
    return { real, plan: meta }
  }

  function filaEnVivo(indicador: Indicador, nombre: string): FilaEnVivo {
    return {
      id: indicador.id,
      nombre,
      unidad: indicador.unidad,
      direccion: indicador.direccion,
      ...lecturaEnVivo(indicador.id),
    }
  }

  /** Lo que enseña el panel de la derecha para el bloque activo. */
  function panelEnVivo() {
    const visibles = agrupacion === 'canal' ? bloquesPorCanal : bloques
    const periodo = esMes ? mes.etiqueta : periodoActivo.etiqueta

    if (agrupacion === 'canal' && bloqueActivo === 'totales') {
      const { Icono, color } = APARIENCIA.totales
      const filas = TOTALES_POR_CANAL.flatMap(({ id, nombre }) => {
        const indicador = calculados.has(id) ? porId.get(id) : undefined
        return indicador ? [filaEnVivo(indicador, nombre)] : []
      })
      return <CapturaEnVivo titulo="Totales" Icono={Icono} color={color} periodo={periodo} total={null} filas={filas} />
    }

    const bloque = visibles.find((b) => b.id === bloqueActivo) ?? visibles[0]
    if (!bloque) return null
    const { Icono, color } = APARIENCIA[bloque.id] ?? APARIENCIA_NEUTRA
    const filas = bloque.grupos
      .flatMap((g) => g.filas)
      .map((id) => porId.get(id))
      .filter((x): x is Indicador => !!x)
      .map((indicador) => {
        // En las variables previas por etapa, dos canales tienen «Contactos
        // reactivados»: el canal va entre paréntesis.
        const nombre =
          !bloque.canal && indicador.grupo === 'insumo' && indicador.canal
            ? `${indicador.nombre} (${NOMBRE_CANAL[indicador.canal]})`
            : nombreDeFila(bloque, indicador)
        return filaEnVivo(indicador, nombre)
      })
    const indicadorTotal = bloque.total ? porId.get(bloque.total) : undefined
    return (
      <CapturaEnVivo
        titulo={bloque.titulo}
        Icono={Icono}
        color={color}
        periodo={periodo}
        total={indicadorTotal ? filaEnVivo(indicadorTotal, 'Total') : null}
        filas={filas}
      />
    )
  }

  return (
    <div className="aparecer mx-auto grid max-w-7xl grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="bandeja min-w-0">
        <div className="nucleo">
          {/* ── Cabecera ─────────────────────────────────────────────── */}
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-6 pt-6">
            <div>
              <h2 className="font-display text-3xl leading-none tracking-tight text-foreground">
                {mes.etiqueta}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">Escribe lo que pasó en cada quincena.</p>
            </div>

            <p
              data-contador
              className="flex items-center gap-2 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {hayCambios ? (
                <>
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                  <span>
                    <span className="font-medium text-foreground tabular-nums">{cambios}</span>{' '}
                    {cambios === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}
                  </span>
                </>
              ) : (
                <>
                  <CheckIcon weight="bold" aria-hidden="true" className="size-3.5 text-estado-ok" />
                  Todo guardado
                </>
              )}
            </p>
          </header>

          {/* El libro del plan que se lee, y cómo cambiarlo. Con cifras sin
            guardar no se puede: el plan nuevo podría no traer sus filas. */}
        <PlanDeNegocio
          libro={plan?.libro ?? null}
          modificadoEn={plan?.modificadoEn ?? null}
          bloqueo={hayCambios ? 'Guarda los cambios antes de cambiar el plan.' : null}
        />

        {/* Justo encima de la tabla que reordena. */}
          <div className="px-6 pt-5">
            <ConmutadorAgrupacion valor={agrupacion} onCambiar={setAgrupacion} />
          </div>

          {/* ── Bloques ── En pantalla estrecha scrollean dentro de su caja. */}
          <div ref={refTabla} className="overflow-x-auto pb-4">
            <div className={cn(ANCHO_TABLA, 'px-6')}>
              {(agrupacion === 'canal' ? bloquesPorCanal : bloques).map((bloque) => {
                const idTitulo = `${prefijoId}-bloque-${bloque.id}`

                if (bloque.canal) {
                  return (
                    <Fragment key={bloque.id}>
                      {bloquePlegable(bloque, idTitulo, filasDeCanal(bloque), abiertosPorCanal.has(bloque.id))}
                      {/* Detrás del último canal, los totales de todos. */}
                      {bloque.id === ultimoCanal && bloqueTotales()}
                    </Fragment>
                  )
                }

                if (bloque.plegado) return bloquePlegable(bloque, idTitulo, filasDe(bloque))

                const hayFilas = bloque.grupos.some((g) => g.filas.some((id) => porId.has(id)))
                if (!hayFilas) return null
                return (
                  <Fragment key={bloque.id}>
                    <div
                      role="group"
                      aria-labelledby={idTitulo}
                      data-bloque={bloque.id}
                      onFocus={() => setBloqueActivo(bloque.id)}
                      className="pt-8"
                    >
                      <div className={cn(claseRejilla, 'pb-2')}>
                        {titulo(bloque, idTitulo)}
                        {nombresDeColumna()}
                      </div>
                      {filasDe(bloque)}
                      {bloque.total && filaTotal(bloque.total)}
                    </div>
                    {tasasTras(bloque.id)}
                  </Fragment>
                )
              })}
            </div>
          </div>

          {/* ── Pie ── Con cambios pendientes se pega al borde de abajo de la
              ventana: guardar queda a mano esté donde esté la fila escrita. */}
          <footer
            className={cn(
              'z-10 flex flex-wrap items-center justify-between gap-4 rounded-b-[0.9375rem] border-t px-6 py-4',
              'bg-[color-mix(in_oklab,var(--card)_94%,transparent)] backdrop-blur-md',
              hayCambios && 'sticky bottom-0 shadow-[0_-12px_28px_-20px_rgba(29,29,27,0.35)]',
              HAIRLINE,
            )}
          >
            <div className="max-w-md space-y-1.5">
              {bloqueo && (
                <p role="status" className="flex items-start gap-2 text-xs text-estado-alerta">
                  <WarningIcon weight="duotone" aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                  <span>{bloqueo}</span>
                </p>
              )}
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <ArrowsClockwiseIcon
                  weight="duotone"
                  aria-hidden="true"
                  className="mt-px size-3.5 shrink-0 text-brand"
                />
                <span>En la fase 2 estas cifras llegarán solas del CRM.</span>
              </p>
            </div>

            <button
              type="button"
              disabled={!hayCambios || bloqueo !== null}
              onClick={() => {
                setErrorClave(null)
                setPidiendoClave(true)
              }}
              className="group/guardar relative inline-flex h-11 shrink-0 items-center rounded-full bg-brand pr-12 pl-5 text-sm font-medium text-primary-foreground shadow-(--sombra-tray) transition-[transform,background-color,opacity] duration-300 ease-(--ease-fluid) outline-none hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Guardar cambios
              <span
                aria-hidden="true"
                className="absolute right-2 grid h-7 w-7 place-items-center rounded-full bg-primary-foreground/15 transition-transform duration-300 ease-(--ease-fluid) group-hover/guardar:translate-x-0.5 group-hover/guardar:-translate-y-0.5 group-hover/guardar:scale-105"
              >
                <CheckIcon weight="bold" className="size-3.5" />
              </span>
            </button>
          </footer>
        </div>

        <DialogoClave
          abierto={pidiendoClave}
          guardando={guardando}
          error={errorClave}
          cambios={cambios}
          onConfirmar={confirmar}
          onCancelar={() => setPidiendoClave(false)}
        />
      </section>

      {/* El panel en vivo: fijo bajo la barra mientras se baja por la tabla.
          En pantallas estrechas no cabe al lado y no se enseña. */}
      <div className="sticky top-27 hidden lg:block">{panelEnVivo()}</div>
    </div>
  )
}

/**
 * Por etapa o por canal: el mismo dibujo que Mes/Quincena de la barra. Solo
 * cambia cómo se agrupan las casillas; lo escrito no se toca.
 */
function ConmutadorAgrupacion({
  valor,
  onCambiar,
}: {
  valor: Agrupacion
  onCambiar: (valor: Agrupacion) => void
}) {
  const opciones: Array<{ id: Agrupacion; etiqueta: string }> = [
    { id: 'etapa', etiqueta: 'Por etapa' },
    { id: 'canal', etiqueta: 'Por canal' },
  ]
  return (
    <div
      role="group"
      aria-label="Agrupar las casillas"
      className="flex w-fit items-center gap-0.5 rounded-full p-1"
      style={{ background: 'color-mix(in oklab, var(--foreground) 5%, transparent)' }}
    >
      {opciones.map((opcion) => {
        const activa = opcion.id === valor
        return (
          <button
            key={opcion.id}
            type="button"
            aria-pressed={activa}
            onClick={() => onCambiar(opcion.id)}
            className={cn(
              'h-7 rounded-full px-3.5 text-[0.8125rem] font-medium',
              'transition-[background-color,color,box-shadow] duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              activa
                ? 'bg-background text-foreground shadow-(--sombra-tray)'
                : 'text-muted-foreground hover:text-foreground',
            )}
            style={{ transitionTimingFunction: 'var(--ease-fluid)' }}
          >
            {opcion.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

/**
 * El nombre de una fila de tasa: el porcentaje en su pastilla carmín y cómo
 * la llama el Excel.
 */
function NombreTasa({
  texto,
  fuerte = false,
  /** El CPM es un precio, no un porcentaje: su pastilla lleva el billete. */
  Icono = Percent,
  children,
}: {
  texto: string
  fuerte?: boolean
  Icono?: LucideIcon
  children?: ReactNode
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <IconoEnPastilla Icono={Icono} color="var(--brand)" tamano="sm" />
      {/* Parte en dos líneas antes que cortarse: en móvil la columna del
          nombre es estrecha y «Tasa…» no dice nada. */}
      <span className={cn('min-w-0 text-sm leading-snug text-foreground', fuerte ? 'font-semibold' : 'font-medium')}>
        {texto}
      </span>
      {children}
    </span>
  )
}

/** Una casilla de quincena: una caja de las de siempre, cifra a la derecha. */
function Casilla({
  id,
  etiqueta,
  texto,
  unidad,
  cambiado,
  onEscribir,
}: {
  id: string
  etiqueta: string
  texto: string
  unidad: Unidad
  cambiado: boolean
  onEscribir: (texto: string) => void
}) {
  return (
    <div className="relative">
      <input
        id={id}
        aria-label={etiqueta}
        /*
         * type="text" con inputMode="decimal" y no type="number": el campo
         * numérico nativo admite «e», «+» y «-», y cambia el valor con la
         * rueda del ratón. En una pantalla de captura eso es corromper un
         * dato sin que nadie lo note. El teclado del móvil sigue saliendo
         * numérico gracias a inputMode.
         */
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={texto}
        onChange={(evento) => onEscribir(evento.target.value)}
        data-cambiado={cambiado || undefined}
        className={cn(
          'h-9 w-full min-w-0 rounded-md border bg-card px-3 text-right text-sm text-foreground tabular-nums outline-none',
          'border-(--regla) transition-[border-color,box-shadow] duration-150',
          'hover:border-[color-mix(in_oklab,var(--foreground)_35%,transparent)]',
          unidad !== 'cantidad' && 'pr-7',
          // Cambiado y aún sin guardar: borde y fondo de marca muy suaves.
          cambiado &&
            'border-[color-mix(in_oklab,var(--brand)_55%,transparent)] bg-[color-mix(in_oklab,var(--brand)_4%,var(--card))]',
          'focus:border-brand focus:ring-3 focus:ring-[color-mix(in_oklab,var(--brand)_18%,transparent)]',
        )}
      />
      {/* La unidad va detrás de la cifra, como se escribe en español: «18.500 €», «42 %». */}
      {unidad !== 'cantidad' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
        >
          {unidad === 'moneda' ? '€' : '%'}
        </span>
      )}
    </div>
  )
}

export default CapturaManual
