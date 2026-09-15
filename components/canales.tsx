'use client'

/**
 * Del gasto a los leads: qué se lleva cada canal y qué trae.
 *
 * ── La forma ────────────────────────────────────────────────────────────
 * Dos barras unidas por cintas. Arriba, el gasto del mes repartido por
 * canal; abajo, los leads repartidos igual. Cada canal une su tramo de gasto
 * con su tramo de leads con una cinta de su color: si la cinta se ensancha
 * al bajar, el canal trae más leads de los que paga y el lead le sale
 * barato; si se estrecha, le sale caro. Es un diagrama aluvial de dos
 * etapas, la forma con que se enseña a dónde va el dinero y qué vuelve.
 *
 * ── Qué se compara con qué ──────────────────────────────────────────────
 * Las DOS barras son reales; ninguna es el plan. Hubo una versión con una
 * pista gris y una raya, y se leía como dos barras de plan y real. Ahora:
 *   · cada fila dice qué es («Gasto», «Leads») y su cifra real, al lado;
 *   · el plan de cada barra es una cota, como en un plano: una línea
 *     discontinua con topes que va del inicio hasta donde llega el plan,
 *     por fuera de la barra y rotulada «Plan $7,080»; una caída discontinua
 *     marca ese punto sobre la barra. Si la barra pasa la caída, se gastó
 *     de más; si no llega, faltaron leads.
 * Las dos barras se miden con la misma vara (el 100 % de su plan ocupa lo
 * mismo), así que las cintas convergen cuando se paga más y entra menos.
 *
 * ── Las cifras de cada canal ────────────────────────────────────────────
 * Dentro de cada tramo, si cabe, el icono, el nombre y lo que ese canal
 * gastó o trajo; si no cabe todo, lo que quepa: icono e importe, o solo el
 * icono. Debajo, una celda por canal con su coste por lead —la cifra que
 * manda—, sus leads contra el plan y cómo pasa su peso del gasto a los
 * leads. Hubo un detalle al pasar el ratón con todo junto y el usuario lo
 * quitó: era demasiada información a la vez. Al señalar un canal, los demás
 * solo se apagan.
 *
 * Los totales son los de estos canales, no los de la cabecera del mes: el
 * plan tiene gasto y leads sin canal asignado.
 *
 * ── Color e iconos ──────────────────────────────────────────────────────
 * Cada canal lleva su tono de la rampa de vino (`--canal-N`) en el tramo,
 * la cinta y la celda, y su icono de Lucide. El texto y el icono dentro del
 * tramo van en el color que contrasta con el relleno (`--canal-N-sobre`).
 * El juicio solo lo emiten las etiquetas de estado, con icono y palabra.
 *
 * ── Movimiento ──────────────────────────────────────────────────────────
 * GSAP (`construirEntrada`): las cotas del plan se trazan, el gasto se
 * reparte de izquierda a derecha, las cintas caen como algo que se vierte,
 * los leads se llenan abajo y las cifras cuentan.
 */

import { useId, useMemo, useRef, useState } from 'react'
import {
  Handshake,
  Megaphone,
  MoveRight,
  Radar,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { MagnetIcon } from '@phosphor-icons/react/ssr'

import {
  HojaVacia,
  cociente,
  lecturaDe,
  puntoCalculado,
  type PuntoDeSerie,
  type PuntoFicha,
} from '@/components/graficos/fichas'
import { CabeceraHoja, Hoja, IconoEnPastilla } from '@/components/graficos/hoja'
import { useAnchoContenedor } from '@/components/graficos/use-ancho-contenedor'
import {
  useEntradaGrafico,
  type HerramientasEntrada,
} from '@/components/graficos/use-entrada-grafico'
import { Semaforo } from '@/components/semaforo'
import { gsap } from '@/lib/animacion'
import { filasDeCanal, type FilaCanal } from '@/lib/canales'
import {
  ETIQUETAS_ESTADO,
  SIN_DATO,
  formatearCumplimiento,
  formatearValor,
} from '@/lib/comparacion'
import { compararPeriodos } from '@/lib/periodos'
import type { Canal } from '@/lib/tipos'
import { cn } from '@/lib/utils'

// ── Canales e iconos ────────────────────────────────────────────────────

/**
 * Un icono por canal, elegido por cómo llega el lead: la publicidad se
 * anuncia, la prospección rastrea, el referido llega de un apretón de manos.
 */
const ICONO_CANAL: Partial<Record<Canal, LucideIcon>> = {
  publicidad: Megaphone,
  prospeccion: Radar,
  referidos: Handshake,
}

// ── Geometría ───────────────────────────────────────────────────────────
// Píxeles CSS reales: el SVG se dibuja a 1:1 con el ancho medido.

const ALTO_BARRA = 34
/** Alto de las cintas: lo que tarda el dinero en «caer» hasta los leads. */
const ALTO_CINTA = 150
const ALTO_CINTA_ESTRECHO = 104
/** Aire arriba y abajo del SVG para la cota del plan y su rótulo. */
const MARGEN_V = 34
/** Distancia entre la barra y su cota. */
const SEPARACION_COTA = 10
/** Medio alto de los topes de la cota. */
const TOPE_COTA = 4
/** Radio de los extremos de cada barra (no de cada tramo). */
const RADIO_BARRA = 8
/** Hueco del color de la tarjeta entre tramos, y entre barra y cinta. */
const HUECO = 2
const LADO_ICONO = 16
const SANGRIA = 11
/** Aire entre el icono y el texto, y entre el nombre y el importe. */
const AIRE_ICONO = 7
const AIRE_IMPORTE = 10
/** Sitio a la derecha para el halo de la caída del plan cuando cae en el borde. */
const RESERVA_DERECHA = 6
/** Ancho que se supone hasta medir (también el que pinta el servidor). */
const ANCHO_SUPUESTO = 1000
const ANCHO_ESTRECHO = 560
/** Desde este ancho, qué es cada barra y su cifra real van a sus lados. */
const ANCHO_COLUMNAS = 720
const COL_ETIQUETA = 88
const COL_VALOR = 176
const HUECO_COLUMNA = 16
/** Tamaños de letra a escala 1 (se multiplican por la escala de la raíz). */
const TAMANO_TRAMO = 12
const TAMANO_COTA = 11
/** Ancho medio de un carácter de Geist, en em, con holgura. */
const EM_POR_CARACTER = 0.58
/** Un canal que no se señala se apaga hasta aquí; en las celdas, menos, que llevan texto. */
const APAGADO_GRAFICO = 0.2
const APAGADO_CELDA = 0.45

// ── Formatos ────────────────────────────────────────────────────────────

/** Dinero con céntimos: un coste por lead de $20.41 no es $20. */
const FORMATO_COSTE = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function coste(valor: number): string {
  if (!Number.isFinite(valor)) return SIN_DATO
  return FORMATO_COSTE.format(valor).replace(/-/g, '−')
}

const dinero = (n: number) => formatearValor(n, 'moneda')
const cantidad = (n: number) => formatearValor(n, 'cantidad')
/** «24 leads», «1 lead»: dentro de la barra de leads la cifra lleva su unidad. */
const leads = (n: number) => `${cantidad(n)} ${Math.round(n) === 1 ? 'lead' : 'leads'}`

/** La raya tipográfica no se lee bien en voz alta. */
function enPalabras(texto: string): string {
  return texto === SIN_DATO ? 'sin dato' : texto
}

// ── Cuentas ─────────────────────────────────────────────────────────────

/** Suma de un lado; null si no hay ni un dato (no es lo mismo que 0). */
function sumar(valores: Array<number | null>): number | null {
  if (valores.every((v) => v === null)) return null
  return valores.reduce<number>((suma, v) => suma + (v ?? 0), 0)
}

/** Largo de una barra en «planes»: 1 es su plan entero. Sin plan, mide lo que el real. */
function razon(real: number | null, plan: number | null): number {
  if (real === null || real <= 0) return 0
  return plan !== null && plan > 0 ? real / plan : 1
}

interface Tramo {
  x0: number
  x1: number
}

/**
 * Reparte `largo` px entre los valores, en orden, y deja el hueco del color
 * de la tarjeta entre un tramo y el siguiente que tenga ancho.
 */
function repartir(valores: number[], largo: number): Tramo[] {
  const total = valores.reduce((suma, v) => suma + v, 0)
  let x = 0
  const tramos = valores.map((v) => {
    const ancho = total > 0 ? (v / total) * largo : 0
    const tramo = { x0: x, x1: x + ancho }
    x += ancho
    return tramo
  })
  return tramos.map((t, i) => {
    const hayDespues = tramos.slice(i + 1).some((s) => s.x1 - s.x0 > 0)
    return hayDespues && t.x1 > t.x0 ? { x0: t.x0, x1: Math.max(t.x0, t.x1 - HUECO) } : t
  })
}

/** La cinta: dos curvas en S que unen el tramo de gasto con el de leads. */
function trazoCinta(arriba: Tramo, abajo: Tramo, y1: number, y2: number): string {
  const ym = (y1 + y2) / 2
  const f = (n: number) => n.toFixed(2)
  return [
    `M${f(arriba.x0)},${f(y1)}`,
    `C${f(arriba.x0)},${f(ym)} ${f(abajo.x0)},${f(ym)} ${f(abajo.x0)},${f(y2)}`,
    `L${f(abajo.x1)},${f(y2)}`,
    `C${f(abajo.x1)},${f(ym)} ${f(arriba.x1)},${f(ym)} ${f(arriba.x1)},${f(y1)}`,
    'Z',
  ].join(' ')
}

function anchoTexto(texto: string, tamano: number): number {
  return Math.ceil(texto.length * tamano * EM_POR_CARACTER)
}

/** ¿Tuvo el canal algo que contar este mes? Sin gasto ni leads, ni plan ni real, no. */
function sinActividad(f: FilaCanal): boolean {
  return [f.gastoReal, f.gastoPlan, f.leadsReal, f.leadsPlan].every((v) => (v ?? 0) === 0)
}

// ── Componente ──────────────────────────────────────────────────────────

export interface CanalesProps {
  /** Los periodos del grano elegido, con sus comparativas. */
  serie: PuntoDeSerie[]
  /** El periodo elegido en el tablero. */
  periodoId: string
}

export function Canales({ serie, periodoId }: CanalesProps) {
  const refHoja = useRef<HTMLDivElement>(null)
  const [refDiagrama, ancho, escalaTexto] = useAnchoContenedor<HTMLDivElement>()
  // Los degradados y recortes viven en <defs> con id: uno propio por hoja.
  const idBase = `canales-${useId().replace(/:/g, '')}`
  const [resaltado, setResaltado] = useState<Canal | null>(null)

  const actual = useMemo(
    () =>
      serie.find((p) => p.periodo.id === periodoId) ??
      serie
        .slice()
        .sort((a, b) => compararPeriodos(a.periodo, b.periodo))
        .at(-1) ??
      null,
    [serie, periodoId],
  )
  const filas = useMemo(() => (actual ? filasDeCanal(actual.comparativas) : []), [actual])

  const gastoReal = sumar(filas.map((f) => f.gastoReal))
  const gastoPlan = sumar(filas.map((f) => f.gastoPlan))
  const leadsReal = sumar(filas.map((f) => f.leadsReal))
  const leadsPlan = sumar(filas.map((f) => f.leadsPlan))

  // El gasto se juzga al revés: pasarse del plan es lo malo.
  const puntoGasto = puntoCalculado(gastoPlan, gastoReal, 'menor-mejor')
  const puntoLeads = puntoCalculado(leadsPlan, leadsReal, 'mayor-mejor')
  const puntosCoste = filas.map((f) => puntoCalculado(f.costePlan, f.costeReal, 'menor-mejor'))
  const cuotas = filas.map((f) => ({
    gasto: gastoReal ? cociente(Math.max(0, f.gastoReal ?? 0), gastoReal) : null,
    leads: leadsReal ? cociente(Math.max(0, f.leadsReal ?? 0), leadsReal) : null,
  }))

  // ── Geometría: el 100 % del plan mide `unidad` en las dos barras ─────
  const anchoTotal = Math.max(240, ancho ?? ANCHO_SUPUESTO)
  const enColumnas = anchoTotal >= ANCHO_COLUMNAS
  const anchoSvg = enColumnas
    ? anchoTotal - COL_ETIQUETA - COL_VALOR - 2 * HUECO_COLUMNA
    : anchoTotal
  const estrecho = anchoTotal < ANCHO_ESTRECHO
  const altoCinta = estrecho ? ALTO_CINTA_ESTRECHO : ALTO_CINTA
  const razonGasto = razon(gastoReal, gastoPlan)
  const razonLeads = razon(leadsReal, leadsPlan)
  const unidad = (anchoSvg - RESERVA_DERECHA) / Math.max(1, razonGasto, razonLeads)
  const yGasto = MARGEN_V
  const yLeads = MARGEN_V + ALTO_BARRA + altoCinta
  const altoSvg = yLeads + ALTO_BARRA + MARGEN_V
  const largoGasto = razonGasto * unidad
  const largoLeads = razonLeads * unidad
  const tramosGasto = repartir(filas.map((f) => Math.max(0, f.gastoReal ?? 0)), largoGasto)
  const tramosLeads = repartir(filas.map((f) => Math.max(0, f.leadsReal ?? 0)), largoLeads)
  // Sin gasto o sin leads no hay de dónde a dónde: no se dibujan cintas.
  const hayCintas = largoGasto > 0 && largoLeads > 0
  const tamanoTramo = TAMANO_TRAMO * escalaTexto
  const tamanoCota = TAMANO_COTA * escalaTexto

  // La firma son los números, no la identidad de los arrays: un re-render
  // con las mismas cifras no repite la entrada. `datos` añade el periodo.
  const firma = `${periodoId}|${filas
    .map(
      (f) =>
        `${f.canal}:${f.gastoPlan ?? '-'}:${f.gastoReal ?? '-'}:${f.leadsPlan ?? '-'}:${f.leadsReal ?? '-'}`,
    )
    .join('|')}`

  useEntradaGrafico({
    ambito: refHoja,
    firma,
    datos: actual,
    construir: (raiz, herramientas) =>
      construirEntrada(raiz, herramientas, {
        gasto: lecturaDe(dinero, 'de', puntoGasto).valor,
        leads: lecturaDe(cantidad, 'de', puntoLeads).valor,
        precios: puntosCoste.map((p) => lecturaDe(coste, 'frente', p).valor),
      }),
  })

  const hayCifras = filas.some((f) => !sinActividad(f))
  if (!hayCifras) {
    return (
      <HojaVacia
        Icono={MagnetIcon}
        titulo="Todavía no hay canales que dibujar"
        motivo="Ningún canal tiene leads ni gasto capturados en este periodo."
      />
    )
  }

  /** Opacidad de lo que no es el canal señalado; sin señalado, nada se apaga. */
  const apagar = (canal: Canal, hasta: number) =>
    resaltado !== null && resaltado !== canal ? hasta : undefined

  const yCota = (tipo: 'gasto' | 'leads') =>
    tipo === 'gasto' ? yGasto - SEPARACION_COTA : yLeads + ALTO_BARRA + SEPARACION_COTA

  return (
    <Hoja ref={refHoja}>
      <CabeceraHoja
        leyenda={<LeyendaCanales colores={filas.map((f) => f.color)} />}
        mes={actual?.periodo.etiqueta}
      />

      {/* El velo: lo que la entrada oculta mientras monta su primer
          fotograma. Contenedor de consulta: las celdas pasan a tres columnas
          cuando la hoja es ancha, no cuando lo es la ventana. */}
      <div data-entrada-velo className="@container">
        <div className="px-5 pt-3 pb-4">
          {!enColumnas && (
            <CabeceraBarra titulo="Gasto por canal" dato="gasto" punto={puntoGasto} formatear={dinero} />
          )}

          <div ref={refDiagrama} className="flex min-w-0" style={{ gap: HUECO_COLUMNA }}>
            {/* Qué es cada barra, a su izquierda. */}
            {enColumnas && (
              <div className="relative shrink-0" style={{ width: COL_ETIQUETA, height: altoSvg }}>
                <EtiquetaBarra y={yGasto + ALTO_BARRA / 2} Icono={Wallet} texto="Gasto" />
                <EtiquetaBarra y={yLeads + ALTO_BARRA / 2} Icono={Users} texto="Leads" />
              </div>
            )}

            <div className="relative min-w-0 flex-1">
              <svg
                width={anchoSvg}
                height={altoSvg}
                aria-hidden="true"
                className="block max-w-full overflow-visible"
                // Sobre el fondo del diagrama —ni tramo ni cinta— no hay
                // canal que señalar: sin esto, el último se quedaba resaltado.
                onPointerMove={(evento) => {
                  if (evento.target === evento.currentTarget) setResaltado(null)
                }}
                onPointerLeave={() => setResaltado(null)}
              >
                <defs>
                  {/* Cada cinta, del color de su canal: más densa donde sale
                      del gasto y más aguada donde llega a los leads. */}
                  {filas.map((f, i) => (
                    <linearGradient
                      key={f.canal}
                      id={`${idBase}-cinta-${i}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={f.color} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={f.color} stopOpacity={0.22} />
                    </linearGradient>
                  ))}
                  {/* El recorte redondea los extremos de la barra entera, no
                      de cada tramo: por dentro, los tramos se tocan a escuadra. */}
                  <clipPath id={`${idBase}-gasto`}>
                    <rect
                      x={0}
                      y={yGasto}
                      width={Math.max(0.01, largoGasto)}
                      height={ALTO_BARRA}
                      rx={RADIO_BARRA}
                    />
                  </clipPath>
                  <clipPath id={`${idBase}-leads`}>
                    <rect
                      x={0}
                      y={yLeads}
                      width={Math.max(0.01, largoLeads)}
                      height={ALTO_BARRA}
                      rx={RADIO_BARRA}
                    />
                  </clipPath>
                </defs>

                {/* Las cintas, por debajo de las barras y separadas de ellas
                    por el mismo hueco que separa los tramos. */}
                {hayCintas &&
                  filas.map((f, i) => {
                    const arriba = tramosGasto[i]
                    const abajo = tramosLeads[i]
                    if (arriba.x1 <= arriba.x0 && abajo.x1 <= abajo.x0) return null
                    return (
                      <path
                        key={f.canal}
                        data-cinta={i}
                        d={trazoCinta(arriba, abajo, yGasto + ALTO_BARRA + HUECO, yLeads - HUECO)}
                        fill={`url(#${idBase}-cinta-${i})`}
                        className="transition-opacity duration-200"
                        style={{ opacity: apagar(f.canal, APAGADO_GRAFICO) }}
                        onPointerEnter={() => setResaltado(f.canal)}
                      />
                    )
                  })}

                <g clipPath={`url(#${idBase}-gasto)`}>
                  {filas.map((f, i) => (
                    <TramoBarra
                      key={f.canal}
                      tipo="gasto"
                      indice={i}
                      tramo={tramosGasto[i]}
                      y={yGasto}
                      fila={f}
                      importe={f.gastoReal !== null ? dinero(f.gastoReal) : ''}
                      tamano={tamanoTramo}
                      opacidad={apagar(f.canal, APAGADO_GRAFICO)}
                      onResaltar={setResaltado}
                    />
                  ))}
                </g>
                <g clipPath={`url(#${idBase}-leads)`}>
                  {filas.map((f, i) => (
                    <TramoBarra
                      key={f.canal}
                      tipo="leads"
                      indice={i}
                      tramo={tramosLeads[i]}
                      y={yLeads}
                      fila={f}
                      importe={f.leadsReal !== null ? leads(f.leadsReal) : ''}
                      tamano={tamanoTramo}
                      opacidad={apagar(f.canal, APAGADO_GRAFICO)}
                      onResaltar={setResaltado}
                    />
                  ))}
                </g>

                {/* El plan de cada barra: su cota por fuera y la caída que
                    marca en la barra dónde llega. */}
                {(gastoPlan ?? 0) > 0 && gastoPlan !== null && (
                  <>
                    <CotaPlan
                      x={unidad}
                      y={yCota('gasto')}
                      texto={`Plan ${dinero(gastoPlan)}`}
                      arriba
                      tamano={tamanoCota}
                    />
                    <CaidaPlan x={unidad} y1={yCota('gasto')} y2={yGasto + ALTO_BARRA} />
                  </>
                )}
                {(leadsPlan ?? 0) > 0 && leadsPlan !== null && (
                  <>
                    <CotaPlan
                      x={unidad}
                      y={yCota('leads')}
                      texto={`Plan ${leads(leadsPlan)}`}
                      arriba={false}
                      tamano={tamanoCota}
                    />
                    <CaidaPlan x={unidad} y1={yLeads} y2={yCota('leads')} />
                  </>
                )}
              </svg>
            </div>

            {/* La cifra real de cada barra, a su derecha. */}
            {enColumnas && (
              <div className="relative shrink-0" style={{ width: COL_VALOR, height: altoSvg }}>
                <ValorBarra
                  y={yGasto + ALTO_BARRA / 2}
                  dato="gasto"
                  punto={puntoGasto}
                  formatear={dinero}
                />
                <ValorBarra
                  y={yLeads + ALTO_BARRA / 2}
                  dato="leads"
                  punto={puntoLeads}
                  formatear={cantidad}
                />
              </div>
            )}
          </div>

          {!enColumnas && (
            <CabeceraBarra
              titulo="Leads por canal"
              dato="leads"
              punto={puntoLeads}
              formatear={cantidad}
            />
          )}
        </div>

        {/* El precio de cada canal: una celda por canal, con filetes. */}
        <div
          className="grid grid-cols-1 gap-px border-t @[40rem]:grid-cols-3"
          style={{ backgroundColor: 'var(--regla-fina)', borderColor: 'var(--regla-fina)' }}
        >
          {filas.map((f, i) => (
            <CeldaCanal
              key={f.canal}
              fila={f}
              indice={i}
              punto={puntosCoste[i]}
              cuota={cuotas[i]}
              Icono={ICONO_CANAL[f.canal]}
              opacidad={apagar(f.canal, APAGADO_CELDA)}
              onResaltar={setResaltado}
            />
          ))}
        </div>
      </div>

      <TablaLectores filas={filas} cuotas={cuotas} mes={actual?.periodo.etiqueta} />
    </Hoja>
  )
}

// ── Piezas del diagrama ─────────────────────────────────────────────────

/** Qué es la barra, a su izquierda: icono en pastilla y nombre. */
function EtiquetaBarra({ y, Icono, texto }: { y: number; Icono: LucideIcon; texto: string }) {
  return (
    <p
      className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2 text-[0.8125rem] font-medium text-foreground"
      style={{ top: y }}
    >
      <IconoEnPastilla Icono={Icono} color="var(--muted-foreground)" tamano="sm" />
      {texto}
    </p>
  )
}

/**
 * La cifra real de la barra, a su derecha, dicha como real («$8,071 real»)
 * para que no quepa duda de que la barra es el real, y su juicio contra el
 * plan. Cuenta en la entrada (`data-total`).
 */
function ValorBarra({
  y,
  dato,
  punto,
  formatear,
}: {
  y: number
  dato: 'gasto' | 'leads'
  punto: PuntoFicha
  formatear: (n: number) => string
}) {
  const lectura = lecturaDe(formatear, 'de', punto)
  return (
    <div className="absolute inset-x-0 -translate-y-1/2" style={{ top: y }}>
      <p className="flex items-baseline gap-1.5">
        <span
          data-total={dato}
          data-final={lectura.cifra}
          className={cn(
            'font-display text-[1.625rem] leading-none font-normal tracking-[-0.02em] proportional-nums',
            lectura.apagada ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {lectura.cifra}
        </span>
        <span className="text-xs text-muted-foreground">
          {lectura.apagada ? 'previsto' : 'real'}
        </span>
      </p>
      <Semaforo
        estado={punto.estado}
        etiqueta={ETIQUETAS_ESTADO[punto.estado]}
        cumplimiento={punto.cumplimiento}
        tamano="sm"
        className="mt-2"
      />
    </div>
  )
}

/**
 * En una hoja estrecha no hay sitio a los lados: qué es la barra, su total,
 * su plan y su juicio van encima (gasto) o debajo (leads).
 */
function CabeceraBarra({
  titulo,
  dato,
  punto,
  formatear,
}: {
  titulo: string
  dato: 'gasto' | 'leads'
  punto: PuntoFicha
  formatear: (n: number) => string
}) {
  const lectura = lecturaDe(formatear, 'de', punto)
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 py-2">
      <p className="text-[0.8125rem] font-medium text-foreground">{titulo}</p>
      <p
        data-total={dato}
        data-final={lectura.cifra}
        className={cn(
          'font-display text-[1.75rem] leading-none font-normal tracking-[-0.02em] proportional-nums',
          lectura.apagada ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {lectura.cifra}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {lectura.apagada ? lectura.relacion : 'real'}
      </p>
      <Semaforo
        estado={punto.estado}
        etiqueta={ETIQUETAS_ESTADO[punto.estado]}
        cumplimiento={punto.cumplimiento}
        tamano="sm"
        className="self-center"
      />
    </div>
  )
}

/**
 * Un tramo de una barra: el rectángulo del canal y, dentro, lo que quepa de
 * su rótulo —icono, nombre e importe; icono e importe; o solo el icono— en
 * el color que contrasta con el relleno. El recorte de la entrada se aplica
 * al grupo, así el rótulo aparece con su tramo.
 */
function TramoBarra({
  tipo,
  indice,
  tramo,
  y,
  fila,
  importe,
  tamano,
  opacidad,
  onResaltar,
}: {
  tipo: 'gasto' | 'leads'
  indice: number
  tramo: Tramo
  y: number
  fila: FilaCanal
  importe: string
  tamano: number
  opacidad: number | undefined
  onResaltar: (canal: Canal | null) => void
}) {
  const ancho = tramo.x1 - tramo.x0
  if (ancho <= 0) return null
  const Icono = ICONO_CANAL[fila.canal]
  const sobre = `var(--canal-${Math.min(indice + 1, 3)}-sobre)`
  const anchoImporte = anchoTexto(importe, tamano)
  const anchoNombre = anchoTexto(fila.nombre, tamano)
  const inicioTexto = SANGRIA + LADO_ICONO + AIRE_ICONO
  const cabeTodo = importe !== '' && ancho >= inicioTexto + anchoNombre + AIRE_IMPORTE + anchoImporte + SANGRIA
  const cabeImporte = importe !== '' && ancho >= inicioTexto + anchoImporte + SANGRIA
  const cabeIcono = ancho >= LADO_ICONO + SANGRIA * 2
  const centro = y + ALTO_BARRA / 2
  return (
    <g
      data-tramo={tipo}
      data-canal={indice}
      className="transition-opacity duration-200"
      style={{ opacity: opacidad }}
      onPointerEnter={() => onResaltar(fila.canal)}
    >
      <rect x={tramo.x0} y={y} width={ancho} height={ALTO_BARRA} style={{ fill: fila.color }} />
      {Icono && cabeIcono && (
        <Icono
          x={tramo.x0 + SANGRIA}
          y={centro - LADO_ICONO / 2}
          size={LADO_ICONO}
          strokeWidth={1.75}
          color={sobre}
          aria-hidden="true"
        />
      )}
      {(cabeTodo || cabeImporte) && (
        <text
          x={tramo.x0 + inicioTexto}
          y={centro + tamano * 0.35}
          fontSize={tamano}
          style={{ fill: sobre, fontVariantNumeric: 'tabular-nums' }}
        >
          {cabeTodo && <tspan fontWeight={500}>{fila.nombre}</tspan>}
          <tspan dx={cabeTodo ? AIRE_IMPORTE : 0} fontWeight={600}>
            {importe}
          </tspan>
        </text>
      )}
    </g>
  )
}

/**
 * La cota del plan: una línea discontinua con topes que va del inicio de la
 * barra hasta donde llega su plan, por fuera de la barra, como la cota de un
 * plano, rotulada al final con su valor.
 */
function CotaPlan({
  x,
  y,
  texto,
  arriba,
  tamano,
}: {
  x: number
  y: number
  texto: string
  arriba: boolean
  tamano: number
}) {
  const trazo = { stroke: 'var(--serie-plan)', strokeWidth: 1.25 }
  const anchoRotulo = anchoTexto(texto, tamano)
  return (
    <g data-cota pointerEvents="none">
      <line x1={0} x2={x} y1={y} y2={y} {...trazo} strokeDasharray="3 3" />
      <line x1={0.6} x2={0.6} y1={y - TOPE_COTA} y2={y + TOPE_COTA} {...trazo} />
      <line x1={x} x2={x} y1={y - TOPE_COTA} y2={y + TOPE_COTA} {...trazo} />
      <text
        x={Math.max(anchoRotulo, x)}
        y={arriba ? y - 7 : y + 7 + tamano * 0.75}
        textAnchor="end"
        fontSize={tamano}
        style={{ fill: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}
      >
        {texto}
      </text>
    </g>
  )
}

/**
 * La caída del plan: baja de la cota a la barra y marca sobre ella dónde
 * llega el plan. Con halo del color de la tarjeta para leerse también
 * encima de una barra que lo pasa.
 */
function CaidaPlan({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return (
    <g data-caida pointerEvents="none">
      <line x1={x} x2={x} y1={y1} y2={y2} stroke="var(--card)" strokeWidth={4} />
      <line
        x1={x}
        x2={x}
        y1={y1}
        y2={y2}
        stroke="var(--serie-plan)"
        strokeWidth={1.25}
        strokeDasharray="3 3"
      />
    </g>
  )
}

/**
 * El precio de un canal: su coste por lead en grande, su plan, su juicio,
 * sus leads contra el plan y cómo cambia su peso del gasto a los leads. Señalarla (ratón o foco)
 * resalta su canal en el diagrama. Un canal sin actividad en el mes lo dice
 * con palabras, sin una raya ni ceros sueltos.
 */
function CeldaCanal({
  fila,
  indice,
  punto,
  cuota,
  Icono,
  opacidad,
  onResaltar,
}: {
  fila: FilaCanal
  indice: number
  punto: PuntoFicha
  cuota: { gasto: number | null; leads: number | null }
  Icono: LucideIcon | undefined
  opacidad: number | undefined
  onResaltar: (canal: Canal | null) => void
}) {
  const titulo = (
    <h3 className="flex min-w-0 items-center gap-2.5 text-[0.8125rem] leading-5 font-medium text-foreground">
      {Icono && <IconoEnPastilla Icono={Icono} color={fila.color} />}
      <span className="truncate">{fila.nombre}</span>
    </h3>
  )

  if (sinActividad(fila)) {
    return (
      <section className="bg-card p-5" aria-label={`${fila.nombre}: sin actividad en este mes.`}>
        <div style={{ opacity: opacidad }}>
          {titulo}
          <p className="mt-4 text-sm text-muted-foreground">Sin actividad en este mes</p>
        </div>
      </section>
    )
  }

  const lectura = lecturaDe(coste, 'frente', punto)
  const gasto = formatearCumplimiento(cuota.gasto)
  const leadsTexto = formatearCumplimiento(cuota.leads)
  return (
    <section
      data-celda={indice}
      tabIndex={0}
      aria-label={`${fila.nombre}: ${lectura.cifra} por lead, ${lectura.relacion}; ${ETIQUETAS_ESTADO[punto.estado]}. ${enPalabras(gasto)} del gasto y ${enPalabras(leadsTexto)} de los leads.`}
      onPointerEnter={() => onResaltar(fila.canal)}
      onPointerLeave={() => onResaltar(null)}
      onFocus={() => onResaltar(fila.canal)}
      onBlur={() => onResaltar(null)}
      className="bg-card p-5 -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {/* Se apaga el contenido y no la celda: con la celda entera, el gris
          del filete de la rejilla se transparentaba y la teñía. */}
      <div className="transition-opacity duration-200" style={{ opacity: opacidad }}>
        <div className="flex items-center justify-between gap-3">
          {titulo}
          <Semaforo
            estado={punto.estado}
            etiqueta={ETIQUETAS_ESTADO[punto.estado]}
            cumplimiento={punto.cumplimiento}
            tamano="sm"
          />
        </div>

        <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
          <span
            data-precio={indice}
            data-final={lectura.cifra}
            className={cn(
              'font-display text-[2.25rem] leading-none font-normal tracking-[-0.02em] proportional-nums',
              lectura.apagada ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {lectura.cifra}
          </span>
          <span className="text-xs text-muted-foreground">por lead</span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">{lectura.relacion}</p>

        {/* Lo que trajo el canal, contra su plan: el otro lado del precio. */}
        {(fila.leadsReal !== null || fila.leadsPlan !== null) && (
          <p className="mt-4 text-sm text-muted-foreground tabular-nums">
            {fila.leadsReal !== null ? (
              <>
                <span className="font-semibold text-foreground">{leads(fila.leadsReal)}</span>
                {fila.leadsPlan !== null && ` de ${cantidad(fila.leadsPlan)} del plan`}
              </>
            ) : (
              `${leads(fila.leadsPlan ?? 0)} previstos, sin resultado`
            )}
          </p>
        )}

        {/* El cambio de peso, que es lo que dibuja la cinta de este canal. */}
        {(cuota.gasto || cuota.leads) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <span>
              <span className="font-semibold text-foreground">{gasto}</span> del gasto
            </span>
            <MoveRight aria-hidden="true" size={14} strokeWidth={1.75} />
            <span>
              <span className="font-semibold text-foreground">{leadsTexto}</span> de los leads
            </span>
          </p>
        )}
      </div>
    </section>
  )
}

/**
 * Leyenda propia, con la forma de las marcas: el real es la barra (con los
 * tres tonos, porque el color es del canal) y el plan, la cota discontinua
 * con topes. El texto va en tokens de texto.
 */
function LeyendaCanales({ colores }: { colores: string[] }) {
  const trazo = { stroke: 'var(--serie-plan)', strokeWidth: 1.25 }
  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="flex items-center gap-2 text-foreground">
        <span aria-hidden="true" className="flex h-2.5 w-7 gap-px overflow-hidden rounded-[3px]">
          {colores.map((color, i) => (
            <span key={i} className="flex-1" style={{ backgroundColor: color }} />
          ))}
        </span>
        Real
      </span>
      <span className="flex items-center gap-2 text-muted-foreground">
        <svg aria-hidden="true" width="24" height="10" className="shrink-0">
          <line x1="1" x2="23" y1="5" y2="5" {...trazo} strokeDasharray="3 3" />
          <line x1="1" x2="1" y1="1" y2="9" {...trazo} />
          <line x1="23" x2="23" y1="1" y2="9" {...trazo} />
        </svg>
        Plan
      </span>
    </div>
  )
}

// ── Entrada ─────────────────────────────────────────────────────────────

/**
 * La timeline de los Canales: una sola, con posiciones, unos 1,7 s.
 *
 *   0,00  Las cotas del plan se trazan de izquierda a derecha: la regla.
 *   0,05  El gasto se reparte de izquierda a derecha, canal a canal, con un
 *         recorte y no con `scaleX` (que aplastaría el extremo redondo), y
 *         su total cuenta.
 *   0,45  Las cintas caen una tras otra con un recorte de arriba abajo: el
 *         dinero que se vierte hacia los leads.
 *   0,55  Los precios de las celdas cuentan.
 *   1,05  Los leads se llenan abajo y su total cuenta.
 *   1,20  Las caídas del plan marcan su punto sobre las barras.
 *
 * Al final, `clearProps`: el DOM final es el estático.
 */
function construirEntrada(
  raiz: HTMLElement,
  { contar }: HerramientasEntrada,
  valores: { gasto: number | null; leads: number | null; precios: Array<number | null> },
): gsap.core.Timeline | null {
  const todos = (selector: string) => Array.from(raiz.querySelectorAll(selector))
  const cotas = todos('[data-cota]')
  const caidas = todos('[data-caida]')
  const tramosGasto = todos('[data-tramo="gasto"]')
  const tramosLeads = todos('[data-tramo="leads"]')
  const cintas = todos('[data-cinta]')
  if (tramosGasto.length === 0 && tramosLeads.length === 0) return null

  const DESDE_IZQUIERDA = 'inset(-20% 100% -20% 0%)'
  const DESDE_ARRIBA = 'inset(0% 0% 100% 0%)'
  const ENTERO = 'inset(-20% 0% -20% 0%)'

  const linea = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.6 } })

  if (cotas.length) {
    linea.fromTo(
      cotas,
      { clipPath: DESDE_IZQUIERDA },
      { clipPath: ENTERO, duration: 0.7, ease: 'power2.inOut' },
      0,
    )
  }
  if (tramosGasto.length) {
    linea.fromTo(tramosGasto, { clipPath: DESDE_IZQUIERDA }, { clipPath: ENTERO, stagger: 0.1 }, 0.05)
  }
  if (cintas.length) {
    linea.fromTo(
      cintas,
      { clipPath: DESDE_ARRIBA },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'power2.inOut', stagger: 0.12 },
      0.45,
    )
  }
  if (tramosLeads.length) {
    linea.fromTo(tramosLeads, { clipPath: DESDE_IZQUIERDA }, { clipPath: ENTERO, stagger: 0.1 }, 1.05)
  }
  if (caidas.length) {
    linea.fromTo(caidas, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'none' }, 1.2)
  }

  const cuenta = (
    nodo: Element | null,
    valor: number | null,
    formatear: (n: number) => string,
    duracion: number,
    posicion: number,
  ) => {
    if (!nodo || valor === null) return
    const tween = contar(nodo, valor, formatear, duracion)
    if (tween) linea.add(tween, posicion)
  }
  cuenta(raiz.querySelector('[data-total="gasto"]'), valores.gasto, dinero, 0.9, 0.05)
  cuenta(raiz.querySelector('[data-total="leads"]'), valores.leads, cantidad, 0.7, 1.05)
  valores.precios.forEach((valor, i) =>
    cuenta(raiz.querySelector(`[data-precio="${i}"]`), valor, coste, 0.9, 0.55 + i * 0.1),
  )

  // Estado final = estado estático: fuera todo lo que se puso en línea.
  const fin = linea.duration()
  const limpiar = (objetivos: Element[], propiedades: string) => {
    if (objetivos.length) linea.set(objetivos, { clearProps: propiedades }, fin)
  }
  limpiar(caidas, 'opacity')
  limpiar([...cotas, ...tramosGasto, ...tramosLeads, ...cintas], 'clipPath')

  return linea
}

// ── Tabla para lectores ─────────────────────────────────────────────────

/**
 * El gemelo accesible del diagrama y las celdas, en un `div.sr-only` que la
 * envuelve (nunca `sr-only` sobre la propia tabla: una tabla ignora
 * `height: 1px` y alarga la página).
 */
function TablaLectores({
  filas,
  cuotas,
  mes,
}: {
  filas: FilaCanal[]
  cuotas: Array<{ gasto: number | null; leads: number | null }>
  mes: string | undefined
}) {
  const precio = (valor: number | null) => (valor === null ? SIN_DATO : coste(valor))
  return (
    <div className="sr-only">
      <table>
        <caption>
          Del gasto a los leads{mes ? ` en ${mes}` : ''}: gasto, leads y coste por lead de cada
          canal, real y plan.
        </caption>
        <thead>
          <tr>
            <th scope="col">Canal</th>
            <th scope="col">Gasto real</th>
            <th scope="col">Gasto plan</th>
            <th scope="col">Parte del gasto</th>
            <th scope="col">Leads real</th>
            <th scope="col">Leads plan</th>
            <th scope="col">Parte de los leads</th>
            <th scope="col">Coste por lead real</th>
            <th scope="col">Coste por lead plan</th>
            <th scope="col">Estado del coste</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={f.canal}>
              <th scope="row">{f.nombre}</th>
              <td>{enPalabras(formatearValor(f.gastoReal, 'moneda'))}</td>
              <td>{enPalabras(formatearValor(f.gastoPlan, 'moneda'))}</td>
              <td>{enPalabras(formatearCumplimiento(cuotas[i]?.gasto ?? null))}</td>
              <td>{enPalabras(formatearValor(f.leadsReal, 'cantidad'))}</td>
              <td>{enPalabras(formatearValor(f.leadsPlan, 'cantidad'))}</td>
              <td>{enPalabras(formatearCumplimiento(cuotas[i]?.leads ?? null))}</td>
              <td>{enPalabras(precio(f.costeReal))}</td>
              <td>{enPalabras(precio(f.costePlan))}</td>
              <td>{ETIQUETAS_ESTADO[f.estadoCoste]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
