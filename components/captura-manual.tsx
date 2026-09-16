'use client'

/**
 * Captura manual de los valores REALES de un mes, quincena a quincena y por
 * bloques.
 *
 * Es la pantalla donde una persona se sienta con el informe de HighLevel
 * delante y teclea lo que de verdad pasó. Tiene que entenderse a simple
 * vista: una tabla por bloque, dos casillas por fila y, al lado, el total
 * del mes y su plan para comparar. Nada más. El juicio (semáforos,
 * cumplimiento, gráficos) vive en el tablero; aquí se escribe.
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
 *  3. LOS TOTALES NO SE TECLEAN. Los cinco totales salen de sumar sus partes
 *     (`completarTotales`) y van en la última fila del bloque, sin casilla:
 *     no pueden descuadrar.
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
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import { ArrowsClockwiseIcon, CaretDownIcon, CheckIcon, WarningIcon } from '@phosphor-icons/react/ssr'
import {
  BadgeCheck,
  Coins,
  Layers,
  Percent,
  PhoneCall,
  ScanSearch,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import type { Indicador, Meta, Periodo, Real, TasaDelPlan, Unidad } from '@/lib/tipos'
import { NOMBRE_CANAL } from '@/lib/tipos'
import { formatearTasaConversion, formatearValor } from '@/lib/comparacion'
import { tasaEntre, tasaReal } from '@/lib/tasas'
import { resumirMes } from '@/lib/reales/mes'
import { BLOQUES, type BloqueCaptura } from '@/lib/captura/bloques'
import { completarTotales } from '@/lib/captura/totales'
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

// ── Estructura ──────────────────────────────────────────────────────────

/** Por debajo de este ancho la tabla scrollea dentro de su caja, nunca la página. */
const ANCHO_TABLA = 'min-w-[46rem]'

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
  ventas: { Icono: BadgeCheck, color: COLOR_FAMILIA.embudo },
  ingresos: { Icono: Coins, color: COLOR_FAMILIA.dinero },
  captacion: { Icono: Wallet, color: COLOR_FAMILIA.captacion },
  insumos: { Icono: Layers, color: 'var(--muted-foreground)' },
}
const APARIENCIA_NEUTRA = { Icono: Layers, color: 'var(--muted-foreground)' }

/** Una cifra, o nada si no hay dato: en esta tabla un hueco se lee mejor que un guion. */
const cifra = (valor: number | null, unidad: Unidad) =>
  valor === null ? '' : formatearValor(valor, unidad)

/** Una tasa, o nada si no la hay. */
const porcentaje = (tasa: number | null) => (tasa === null ? '' : formatearTasaConversion(tasa))

/**
 * Las tasas que van entre un bloque de etapa y el siguiente. `porCanal`: se
 * despliega canal a canal (solo donde el plan reparte las dos etapas).
 */
const TASAS_TRAS_BLOQUE: Record<string, Array<{ desde: string; hacia: string; porCanal: boolean }>> = {
  eleads: [{ desde: 'eleads', hacia: 'llamadas', porCanal: true }],
  llamadas: [{ desde: 'llamadas', hacia: 'discoveries', porCanal: false }],
  'discoveries-propuestas': [
    { desde: 'discoveries', hacia: 'propuestas', porCanal: false },
    { desde: 'propuestas', hacia: 'ventas', porCanal: false },
  ],
}

/** La banda de una tasa: un gris muy bajo que la separa de las filas que se teclean. */
const BANDA_TASA = 'bg-[color-mix(in_oklab,var(--foreground)_3.5%,transparent)]'

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
  bloqueo,
  onGuardar,
  onCambiosPendientes,
}: CapturaManualProps) {
  const prefijoId = useId()

  const esMes = periodoActivo.tipo === 'mes'
  const quincenasAMostrar: Quincena[] = esMes
    ? ['q1', 'q2']
    : periodoActivo.quincena === 1
      ? ['q1']
      : ['q2']

  const columnasAMostrar = esMes
    ? ['1ª quincena', '2ª quincena', 'Total mes', 'Plan mes']
    : [periodoActivo.quincena === 1 ? '1ª quincena' : '2ª quincena', 'Total mes', 'Plan mes']

  const claseRejilla = esMes
    ? 'grid grid-cols-[minmax(9rem,1fr)_8rem_8rem_7rem_7rem] items-center gap-x-4'
    : 'grid grid-cols-[minmax(9rem,1fr)_8rem_7rem_7rem] items-center gap-x-4'

  const [guardado, setGuardado] = useState(() => ({
    q1: aBorrador(realesQ1),
    q2: aBorrador(realesQ2),
  }))
  const [borrador, setBorrador] = useState(guardado)

  /**
   * Al cambiar de mes se recarga todo, ajustando el estado durante el render
   * (patrón oficial de React para estado derivado de props): así no se pinta
   * ni un fotograma con las cifras del mes anterior bajo el título del nuevo.
   * El tablero ya preguntó antes si había cambios sin guardar.
   */
  const [mesSincronizado, setMesSincronizado] = useState(mes.id)
  if (mesSincronizado !== mes.id) {
    const nuevo = { q1: aBorrador(realesQ1), q2: aBorrador(realesQ2) }
    setMesSincronizado(mes.id)
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

  /** Las casillas de la pantalla, en orden: las filas de los bloques que existen. */
  const capturables = useMemo(
    () =>
      BLOQUES.flatMap((b) => b.grupos.flatMap((g) => g.filas)).filter((id) => porId.has(id)),
    [porId],
  )

  // Las cifras tecleadas y, con ellas, los totales de cada quincena. Se
  // recalculan en cada pulsación: son pocas sumas, y un total no puede ir un
  // carácter por detrás de sus canales.
  const valores = { q1: aValores(borrador.q1), q2: aValores(borrador.q2) }
  const conTotales = { q1: completarTotales(valores.q1), q2: completarTotales(valores.q2) }

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
      let resultado: ResultadoGuardado
      try {
        resultado = await onGuardar(aValores(enviado.q1), aValores(enviado.q2), clave)
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

  /** Las cifras de una fila: cada quincena, el total del mes y el plan del mes. */
  function delMes(indicador: Indicador) {
    const q1 = conTotales.q1[indicador.id] ?? null
    const q2 = conTotales.q2[indicador.id] ?? null
    const metaQ1 = metaDe.q1.get(indicador.id) ?? null
    const metaQ2 = metaDe.q2.get(indicador.id) ?? null
    // Las metas de las quincenas suman exactamente el mes (lib/plan/quincenas.ts).
    const plan =
      metaQ1 !== null && metaQ2 !== null ? Math.round((metaQ1 + metaQ2) * 100) / 100 : null
    return { q1, q2, total: resumirMes(q1, q2, metaQ1, metaQ2, plan).real, plan }
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

  function fila(bloque: BloqueCaptura, indicador: Indicador) {
    const { total, plan } = delMes(indicador)
    return (
      <div key={indicador.id} className={cn(claseRejilla, 'border-t py-1.5', HAIRLINE)}>
        <span title={indicador.definicion} className="truncate text-sm text-foreground">
          {indicador.nombre}
        </span>
        {quincenasAMostrar.map((q) => (
          <Casilla
            key={q}
            id={`${prefijoId}-${q}-${indicador.id}`}
            // El nombre visible es el del catálogo («Publicidad»); el que se
            // lee en voz alta dice además de qué bloque es.
            etiqueta={`${bloque.titulo}, ${indicador.nombre}, ${q === 'q1' ? '1ª' : '2ª'} quincena`}
            texto={borrador[q][indicador.id] ?? ''}
            unidad={indicador.unidad}
            cambiado={cambiado(q, indicador.id)}
            onEscribir={(texto) => escribir(q, indicador.id, texto)}
          />
        ))}
        <span className="text-right text-sm font-medium text-foreground tabular-nums">
          {cifra(total, indicador.unidad)}
        </span>
        <span className="text-right text-sm text-muted-foreground tabular-nums">
          {cifra(plan, indicador.unidad)}
        </span>
      </div>
    )
  }

  /** La fila del total: raya más marcada encima y cifras en negrita, sin casilla. */
  function filaTotal(totalId: string) {
    const indicador = porId.get(totalId)
    if (!indicador) return null
    const { q1, q2, total, plan } = delMes(indicador)
    return (
      <div
        data-total
        className={cn(claseRejilla, 'border-t py-2.5 text-sm tabular-nums')}
        style={{ borderColor: 'var(--regla)' }}
      >
        <span className="font-semibold text-foreground">Total</span>
        {/* `pr-3`: el mismo relleno que la casilla, para acabar en la misma
            vertical que las cifras tecleadas encima. */}
        {quincenasAMostrar.includes('q1') && (
          <span className="pr-3 text-right font-semibold text-foreground">{cifra(q1, indicador.unidad)}</span>
        )}
        {quincenasAMostrar.includes('q2') && (
          <span className="pr-3 text-right font-semibold text-foreground">{cifra(q2, indicador.unidad)}</span>
        )}
        <span className="text-right font-semibold text-foreground">{cifra(total, indicador.unidad)}</span>
        <span className="text-right font-medium text-muted-foreground">{cifra(plan, indicador.unidad)}</span>
      </div>
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
          {tasasDelGrupo.map((tasa) => (
            <div
              key={tasa.id}
              data-tasa={tasa.id}
              className={cn(claseRejilla, '-mx-3 mb-1 rounded-lg px-3 py-1.5', BANDA_TASA)}
            >
              {celdasTasa(tasa, <NombreTasa texto={tasa.nombre} />)}
            </div>
          ))}
        </div>
      )
    })
  }

  /** Lo real de un indicador en el mes, con la regla de siempre. */
  function realDelMes(id: string) {
    const q1 = conTotales.q1[id] ?? null
    const q2 = conTotales.q2[id] ?? null
    return resumirMes(q1, q2, null, null, null).real
  }

  /**
   * Las celdas de una fila de tasa, en las columnas de la tabla: la tasa real
   * de cada quincena visible, la del mes en «Total mes» y la del plan en
   * «Plan mes».
   */
  function celdasTasa(tasa: TasaDelPlan, nombre: ReactNode) {
    const real = (q: Quincena) =>
      tasaReal(conTotales[q][tasa.desde] ?? null, conTotales[q][tasa.hacia] ?? null)
    return (
      <>
        {nombre}
        {quincenasAMostrar.map((q) => (
          <span key={q} className="pr-3 text-right text-sm text-muted-foreground tabular-nums">
            {porcentaje(real(q))}
          </span>
        ))}
        <span className="text-right text-sm font-medium text-foreground tabular-nums">
          {porcentaje(tasaReal(realDelMes(tasa.desde), realDelMes(tasa.hacia)))}
        </span>
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
    const pasos = TASAS_TRAS_BLOQUE[bloqueId]
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
            className={cn(claseRejilla, '-mx-3 mt-3 rounded-lg px-3 py-2', BANDA_TASA)}
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
              'cursor-pointer list-none rounded-lg px-3 py-2 -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden',
            )}
          >
            {celdasTasa(
              total,
              <NombreTasa texto={total.nombre} fuerte>
                <span className="flex shrink-0 items-center gap-1 text-xs font-normal text-muted-foreground">
                  por canal
                  <CaretDownIcon
                    weight="bold"
                    aria-hidden="true"
                    className="size-3 transition-transform duration-200 group-open/tasa:rotate-180"
                  />
                </span>
              </NombreTasa>,
            )}
          </summary>
          <div className="px-3 pb-1.5">
            {canales.map((tasa) => (
              <div
                key={tasa.id}
                data-tasa={tasa.id}
                className={cn(claseRejilla, 'border-t py-1.5', HAIRLINE)}
              >
                {celdasTasa(
                  tasa,
                  <span className="truncate pl-6 text-sm text-foreground">
                    {tasa.canal ? NOMBRE_CANAL[tasa.canal] : tasa.nombre}
                  </span>,
                )}
              </div>
            ))}
          </div>
        </details>
      )
    })
  }

  return (
    <section className="bandeja aparecer mx-auto max-w-4xl">
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

        {/* ── Bloques ── En pantalla estrecha scrollean dentro de su caja. */}
        <div className="overflow-x-auto pb-4">
          <div className={cn(ANCHO_TABLA, 'px-6')}>
            {BLOQUES.map((bloque) => {
              const idTitulo = `${prefijoId}-bloque-${bloque.id}`

              if (bloque.plegado) {
                // Plegar no descarta nada: sus casillas siguen en el borrador
                // y en el contador de cambios.
                const filas = bloque.grupos.flatMap((g) => g.filas).filter((id) => porId.has(id))
                if (filas.length === 0) return null
                const capturados = filas.filter(
                  (id) => aNumero(borrador.q1[id] ?? '') !== null || aNumero(borrador.q2[id] ?? '') !== null,
                ).length
                return (
                  <details key={bloque.id} className="group/plegado pt-8">
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
                    {filasDe(bloque)}
                  </details>
                )
              }

              const hayFilas = bloque.grupos.some((g) => g.filas.some((id) => porId.has(id)))
              if (!hayFilas) return null
              return (
                <Fragment key={bloque.id}>
                  <div role="group" aria-labelledby={idTitulo} className="pt-8">
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
  )
}

/** El nombre de una fila de tasa: el signo de porcentaje y cómo la llama el Excel. */
function NombreTasa({
  texto,
  fuerte = false,
  children,
}: {
  texto: string
  fuerte?: boolean
  children?: ReactNode
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Percent aria-hidden="true" strokeWidth={2} className="size-3.5 shrink-0 text-muted-foreground" />
      {/* Parte en dos líneas antes que cortarse: en móvil la columna del
          nombre es estrecha y «Tasa…» no dice nada. */}
      <span className={cn('min-w-0 text-sm leading-snug text-foreground', fuerte && 'font-medium')}>
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
      {unidad === 'moneda' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
        >
          $
        </span>
      )}
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
          unidad === 'moneda' && 'pl-6',
          unidad === 'porcentaje' && 'pr-7',
          // Cambiado y aún sin guardar: borde y fondo de marca muy suaves.
          cambiado &&
            'border-[color-mix(in_oklab,var(--brand)_55%,transparent)] bg-[color-mix(in_oklab,var(--brand)_4%,var(--card))]',
          'focus:border-brand focus:ring-3 focus:ring-[color-mix(in_oklab,var(--brand)_18%,transparent)]',
        )}
      />
      {unidad === 'porcentaje' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
        >
          %
        </span>
      )}
    </div>
  )
}

export default CapturaManual
