'use client'

/**
 * El tablero.
 *
 * ── La forma ─────────────────────────────────────────────────────────────
 * Arriba, el título y el mes con las cuatro cifras que lo resumen. Debajo,
 * las cuatro secciones de análisis en un carrusel, ocupando el mismo sitio.
 *
 * La cabecera NO se desliza. Es la respuesta a «¿cómo vamos?» y tiene que
 * estar siempre delante; lo que rota es el detalle, que es lo que se
 * consulta de una cosa cada vez.
 *
 * ── El orden del carrusel es un argumento ────────────────────────────────
 * Embudo → Canales → Dinero → Serie. Es la secuencia en que alguien
 * investiga un mes malo: dónde se rompió, por qué, qué costó, y si viene
 * pasando. No es un orden alfabético ni estético.
 */

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ChartLineIcon,
  CoinsIcon,
  FunnelIcon,
  MagnetIcon,
  WarningIcon,
} from '@phosphor-icons/react/ssr'

import type { Indicador, Meta, Periodo, Real, TipoPeriodo } from '@/lib/tipos'
import { compararTodos } from '@/lib/comparacion'
import { compararPeriodos } from '@/lib/periodos'
import { filasDeCanal, canalMasDeteriorado } from '@/lib/canales'

import { Chasis, type Vista } from '@/components/chasis'
import { SelectorPeriodo } from '@/components/selector-periodo'
import { CabeceraMes } from '@/components/cabecera-mes'
import { Carrusel, type Panel } from '@/components/carrusel'
import { Embudo } from '@/components/embudo'
import { Canales } from '@/components/canales'
import { Dinero } from '@/components/dinero'
import { Tendencias } from '@/components/tendencias'
import type { PuntoDeSerie } from '@/components/graficos/fichas'
import { CapturaManual } from '@/components/captura-manual'

export interface DatosPrecargados {
  indicadores: Indicador[]
  periodos: Periodo[]
  metasPorPeriodo: Record<string, Meta[]>
  realesPorPeriodo: Record<string, Real[]>
  /** De dónde salieron las cifras del plan. Del pie solo queda el aviso de filas perdidas. */
  procedencia?: {
    libro: string
    modificadoEn: string
    meses: number
    incidencias: string[]
  } | null
}

/** Indicadores que tiene sentido graficar en la serie temporal. */
const GRAFICABLES = new Set(['embudo', 'dinero', 'captacion'])

export function Tablero({
  indicadores,
  periodos,
  metasPorPeriodo,
  realesPorPeriodo,
  procedencia = null,
}: DatosPrecargados) {
  const [vista, setVista] = useState<Vista>('tablero')
  const [tipo, setTipo] = useState<TipoPeriodo>('mes')

  const porTipo = useMemo(
    () => periodos.filter((p) => p.tipo === tipo).sort((a, b) => compararPeriodos(b, a)),
    [periodos, tipo],
  )

  /** Periodos con resultado capturado. El selector los marca. */
  const conDato = useMemo(
    () =>
      new Set(
        periodos.filter((p) => (realesPorPeriodo[p.id] ?? []).length > 0).map((p) => p.id),
      ),
    [periodos, realesPorPeriodo],
  )

  /**
   * Se abre en el último periodo CON resultado, no en el último del plan.
   * El plan llega a diciembre de 2028 y solo unos pocos meses están
   * capturados: arrancar en el último sería abrir en una página en blanco.
   */
  const periodoPorDefecto = useMemo(() => {
    const conReal = porTipo.find((p) => conDato.has(p.id))
    return conReal?.id ?? porTipo[0]?.id ?? ''
  }, [porTipo, conDato])

  const [periodoId, setPeriodoId] = useState<string>(periodoPorDefecto)

  /**
   * Al cambiar de grano el periodo elegido deja de existir —'2026-09' no está
   * entre las quincenas— y hay que sustituirlo.
   *
   * El respaldo era «el primero de la lista», y como la lista va de más
   * reciente a más antigua, pulsar «Quincena» mientras mirabas septiembre de
   * 2026 te dejaba en la segunda quincena de diciembre de 2028: el otro
   * extremo del plan, tres años más allá y sin un solo dato.
   *
   * Lo que se espera es quedarse donde estabas, solo que con otro grano. Por
   * eso se busca primero un periodo del MISMO mes; solo si no lo hay se cae
   * al último con resultado, y al primero de la lista como último recurso.
   *
   * Se corrige durante el render y no en un efecto, que es el patrón que
   * documenta React para ajustar estado derivado: así no se llega a pintar un
   * fotograma con el periodo equivocado.
   */
  const anterior = periodos.find((p) => p.id === periodoId)
  const periodo =
    porTipo.find((p) => p.id === periodoId) ??
    (anterior
      ? porTipo.find((p) => p.anio === anterior.anio && p.mes === anterior.mes)
      : undefined) ??
    porTipo.find((p) => conDato.has(p.id)) ??
    porTipo[0]

  if (periodo && periodo.id !== periodoId) setPeriodoId(periodo.id)

  const comparativas = useMemo(() => {
    if (!periodo) return []
    return compararTodos(
      indicadores,
      metasPorPeriodo[periodo.id] ?? [],
      realesPorPeriodo[periodo.id] ?? [],
    )
  }, [indicadores, periodo, metasPorPeriodo, realesPorPeriodo])

  /**
   * Solo los indicadores de cabecera: las etapas del embudo, el ingreso y la
   * captación. El catálogo tiene 52 filas, pero 21 son desgloses por canal y
   * 12 son insumos. Contarlas todas para marcar el raíl asustaría sin
   * informar: la mitad serían los canales que el plan deja sin asignar, que
   * no están fuera de plan — están vacíos.
   */
  const cabeceras = useMemo(
    () =>
      comparativas.filter(
        (c) =>
          c.indicador.etapa !== null ||
          c.indicador.id === 'ingreso-total' ||
          c.indicador.id === 'captacion-total',
      ),
    [comparativas],
  )

  const canales = useMemo(() => filasDeCanal(comparativas), [comparativas])
  const canalCaro = useMemo(() => canalMasDeteriorado(canales), [canales])

  const graficables = useMemo(
    () => indicadores.filter((i) => i.grupo && GRAFICABLES.has(i.grupo) && !i.canal),
    [indicadores],
  )

  const serie: PuntoDeSerie[] = useMemo(
    () =>
      periodos
        .filter((p) => p.tipo === 'mes')
        .sort(compararPeriodos)
        .map((p) => ({
          periodo: p,
          comparativas: compararTodos(
            indicadores,
            metasPorPeriodo[p.id] ?? [],
            realesPorPeriodo[p.id] ?? [],
          ),
        })),
    [periodos, indicadores, metasPorPeriodo, realesPorPeriodo],
  )

  /**
   * La historia de las fichas del Embudo, los Canales y el Dinero: los
   * periodos del grano elegido, en orden, con sus comparativas. En meses es
   * la misma serie de arriba; si algún día el plan trae quincenas, las
   * fichas las recorren de quincena en quincena. La Serie sigue mensual.
   */
  const serieDelTipo: PuntoDeSerie[] = useMemo(
    () =>
      tipo === 'mes'
        ? serie
        : porTipo
            .slice()
            .sort(compararPeriodos)
            .map((p) => ({
              periodo: p,
              comparativas: compararTodos(
                indicadores,
                metasPorPeriodo[p.id] ?? [],
                realesPorPeriodo[p.id] ?? [],
              ),
            })),
    [tipo, serie, porTipo, indicadores, metasPorPeriodo, realesPorPeriodo],
  )

  const [indicadorTendencia, setIndicadorTendencia] = useState<string>(
    () => graficables.find((i) => i.id === 'ingreso-total')?.id ?? graficables[0]?.id ?? '',
  )

  const guardar = useCallback((valores: Real[]) => {
    // Sin persistencia todavía, por decisión: esta fase trae el plan del
    // Excel y rediseña la lectura. Al conectar el almacén, esta función pasa
    // a ser una acción de servidor y nada más de este archivo cambia.
    console.log('[captura] valores del periodo', valores)
    toast.success('Periodo revisado', {
      description: `${valores.length} indicadores. Todavía no se guardan: la persistencia llega en la siguiente fase.`,
    })
  }, [])

  /**
   * ¿El plan trae quincenas?
   *
   * Hoy no: el Excel tiene 33 columnas mensuales y nada más. Y el conmutador
   * Mes/Quincena no era inofensivo — al pulsar «Quincena» la lista quedaba
   * vacía, `periodo` se volvía undefined y la vista entera caía al mensaje
   * de «el plan no trajo ningún periodo». Se pinta solo si hay de los dos.
   *
   * La capacidad no se ha quitado: en cuanto una fuente entregue quincenas,
   * el conmutador reaparece solo.
   */
  const hayVariosTipos = useMemo(
    () => new Set(periodos.map((p) => p.tipo)).size > 1,
    [periodos],
  )

  const controles = periodo ? (
    <SelectorPeriodo
      periodos={porTipo}
      actual={periodo}
      onCambiar={setPeriodoId}
      tipo={tipo}
      onCambiarTipo={setTipo}
      conDato={conDato}
      hayVariosTipos={hayVariosTipos}
    />
  ) : null

  if (!periodo) {
    return (
      <Chasis vista={vista} onCambiarVista={setVista}>
        <p className="text-muted-foreground">
          El plan no trajo ningún periodo. Revisa la conexión con el Excel.
        </p>
      </Chasis>
    )
  }

  if (vista === 'captura') {
    return (
      <Chasis vista={vista} onCambiarVista={setVista} controles={controles}>
        <CapturaManual
          periodo={periodo}
          indicadores={indicadores}
          metas={metasPorPeriodo[periodo.id] ?? []}
          realesIniciales={realesPorPeriodo[periodo.id] ?? []}
          onGuardar={guardar}
        />
      </Chasis>
    )
  }

  /** ¿Alguna etapa del embudo cerró fuera de plan? Marca el raíl. */
  const embudoAvisa = cabeceras.some((c) => c.indicador.etapa !== null && c.estado === 'critico')
  const dineroAvisa =
    comparativas.find((c) => c.indicador.id === 'ingreso-total')?.estado === 'critico'

  /*
   * Cada icono del raíl nombra la pregunta de su sección, no el tipo de
   * gráfico que la contesta: el embudo para dónde se estrecha, un imán para
   * la captación —de dónde vienen los leads—, monedas para el ingreso y una
   * línea en el tiempo para saber si viene pasando.
   */
  const paneles: Panel[] = [
    {
      id: 'embudo',
      clave: 'Embudo',
      icono: FunnelIcon,
      titulo: 'Dónde se estrecha',
      glosa: 'Cada etapa contra su plan, mes a mes.',
      avisa: embudoAvisa,
      contenido: <Embudo serie={serieDelTipo} periodoId={periodo.id} />,
    },
    {
      id: 'canales',
      clave: 'Canales',
      icono: MagnetIcon,
      titulo: 'De dónde viene y qué cuesta',
      glosa: canalCaro
        ? `El coste por lead de ${canalCaro.nombre.toLowerCase()} se ha ido por encima del plan.`
        : 'Lo que cada canal aporta al embudo y lo que hay que pagar por ello.',
      avisa: canalCaro !== null,
      contenido: <Canales serie={serieDelTipo} periodoId={periodo.id} />,
    },
    {
      id: 'dinero',
      clave: 'Dinero',
      icono: CoinsIcon,
      titulo: 'De qué depende el ingreso',
      glosa: 'Cuánto del mes estaba ganado de antemano y cuánto hubo que vender.',
      avisa: dineroAvisa,
      contenido: <Dinero serie={serieDelTipo} periodoId={periodo.id} />,
    },
    {
      id: 'serie',
      clave: 'Serie',
      icono: ChartLineIcon,
      titulo: 'Si es un mal mes o una tendencia',
      glosa:
        'Un semáforo en ámbar no distingue entre un tropiezo y una caída sostenida. Esto sí.',
      contenido: (
        <Tendencias
          serie={serie}
          indicadorId={indicadorTendencia}
          periodoId={periodo.id}
          onCambiarIndicador={setIndicadorTendencia}
          indicadores={graficables}
        />
      ),
    },
  ]

  return (
    <Chasis vista={vista} onCambiarVista={setVista} controles={controles}>
      <div className="flex flex-col gap-8">
        <CabeceraMes periodo={periodo} comparativas={comparativas} />
        <Carrusel paneles={paneles} />
        {procedencia && procedencia.incidencias.length > 0 && (
          <AvisoIncidencias incidencias={procedencia.incidencias} />
        )}
      </div>
    </Chasis>
  )
}

/* ── Incidencias────────────────────────────────────────────────────────── */

/**
 * Filas del catálogo que no aparecieron en el Excel. Es lo único que queda
 * del antiguo pie de procedencia: una fila perdida deja una cifra en blanco
 * sin avisar, y eso sí hay que decirlo. Si no falta ninguna, no se pinta.
 */
function AvisoIncidencias({ incidencias }: { incidencias: string[] }) {
  return (
    <p
      className="flex items-start gap-2 text-xs leading-relaxed"
      style={{ color: 'var(--estado-alerta)' }}
    >
      {/* Ámbar y no carmín: es un aviso, y los avisos llevan su estado. */}
      <WarningIcon weight="duotone" aria-hidden="true" className="mt-[0.1rem] size-4 shrink-0" />
      <span>
        {incidencias.length} filas del catálogo no se encontraron en el Excel (
        {incidencias.slice(0, 4).join(', ')}
        {incidencias.length > 4 ? '…' : ''}). Puede que las hayan renombrado.
      </span>
    </p>
  )
}
