'use client'

/**
 * El dinero del mes, como una moneda y su libro de cuentas.
 *
 * ── La moneda ───────────────────────────────────────────────────────────
 * El ingreso del mes es una moneda. El círculo entero es el plan; el real
 * lo va llenando en un anillo, partida a partida y en el sentido de las
 * agujas, hasta donde llega. Lo que el real no cubre se queda en el surco
 * con el mismo discontinuo con que el tablero dibuja el plan en todas
 * partes, y debajo se dice cuánto falta. En el centro, la cifra del mes y su
 * juicio: la moneda contesta «cuánto» y lo contesta de una vez.
 *
 * El canto acuñado y el guilloché del fondo son los de las monedas y los
 * billetes, finos y en tono bajo: lo justo para que se lea «dinero» sin
 * convertirse en un dibujo.
 *
 * ── El libro de cuentas ─────────────────────────────────────────────────
 * Al lado, las cuentas como en un estado de resultados: dos bloques con su
 * subtotal —lo que ya estaba ganado al empezar el mes y lo que hubo que
 * vender—, cada partida con su real, su plan y su cumplimiento, y el total
 * con la raya simple de la suma y la doble de la contabilidad. La moneda
 * dice cuánto; el libro, de dónde.
 *
 * ── Color ───────────────────────────────────────────────────────────────
 * Una rampa de un solo verde (`--dinero-1` a `--dinero-5`), validada como
 * rampa ordinal en los dos temas: del dinero más seguro (la mensualidad de
 * FLECHA, el tono más marcado) al más variable (otros ingresos). Cada
 * partida lleva su tono en el anillo y en su pastilla del libro. El juicio
 * lo emite la etiqueta de estado, con icono y palabra.
 *
 * ── Movimiento ──────────────────────────────────────────────────────────
 * GSAP (`construirEntrada`): el canto se acuña en un barrido, el anillo se
 * llena en el sentido de las agujas —cada partida con DrawSVG, una tras
 * otra, a velocidad constante—, la cifra del centro cuenta y, al cerrar,
 * aparece lo que falta. En el libro cuentan los importes y crecen las
 * barras de cumplimiento. Al señalar una partida en el anillo o en el libro,
 * las demás se apagan.
 */

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { CalendarCheck, Coins, HandCoins, Repeat, UserPlus, type LucideIcon } from 'lucide-react'
import { CoinsIcon } from '@phosphor-icons/react/ssr'

import {
  HojaVacia,
  cociente,
  lecturaDe,
  puntoCalculado,
  type PuntoDeSerie,
  type PuntoFicha,
} from '@/components/graficos/fichas'
import { CabeceraHoja, Hoja, IconoEnPastilla } from '@/components/graficos/hoja'
import {
  useEntradaGrafico,
  type HerramientasEntrada,
} from '@/components/graficos/use-entrada-grafico'
import { Semaforo } from '@/components/semaforo'
import { gsap } from '@/lib/animacion'
import {
  ETIQUETAS_ESTADO,
  SIN_DATO,
  formatearCumplimiento,
  formatearValor,
} from '@/lib/comparacion'
import { compararPeriodos } from '@/lib/periodos'
import { cn } from '@/lib/utils'

// ── Modelo ──────────────────────────────────────────────────────────────

type Grupo = 'ganado' | 'vendido'

/**
 * Las cinco partidas, del dinero más seguro al más variable: ese es el
 * orden del anillo, del libro y de la rampa de verdes.
 */
const PARTIDAS: Array<{ id: string; grupo: Grupo; Icono: LucideIcon; color: string }> = [
  { id: 'ingreso-flecha-recurrente', grupo: 'ganado', Icono: Repeat, color: 'var(--dinero-1)' },
  { id: 'ingreso-arco-recurrente', grupo: 'ganado', Icono: Repeat, color: 'var(--dinero-2)' },
  { id: 'ingreso-flecha-setup', grupo: 'vendido', Icono: UserPlus, color: 'var(--dinero-3)' },
  { id: 'ingreso-arco-setup', grupo: 'vendido', Icono: UserPlus, color: 'var(--dinero-4)' },
  { id: 'ingreso-otros', grupo: 'vendido', Icono: Coins, color: 'var(--dinero-5)' },
]

const GRUPOS: Record<Grupo, { nombre: string; Icono: LucideIcon; color: string }> = {
  ganado: { nombre: 'Ya ganado al empezar el mes', Icono: CalendarCheck, color: 'var(--dinero-1)' },
  vendido: { nombre: 'Vendido en el mes', Icono: HandCoins, color: 'var(--dinero-3)' },
}

interface Pieza extends PuntoFicha {
  id: string
  /** Posición en la lista de partidas: el asa de la entrada. */
  indice: number
  nombre: string
  grupo: Grupo
  Icono: LucideIcon
  color: string
}

interface Arco {
  pieza: Pieza
  /** Grados desde las doce, en el sentido de las agujas. */
  desde: number
  hasta: number
}

// ── Geometría de la moneda ──────────────────────────────────────────────
// En unidades del viewBox (300 × 300): la moneda escala con su columna.

const C = 150
/** El canto acuñado: muescas entre estos dos radios. */
const R_CANTO_EXTERIOR = 147
const R_CANTO_INTERIOR = 140
const MUESCAS = 120
/** El filo de la moneda, justo dentro del canto. */
const R_FILO = 135
/** El anillo del dato: su línea media y su grosor. */
const R_ANILLO = 116
const GROSOR_ANILLO = 20
/** El borde interior, que enmarca la cara de la moneda. */
const R_CARA = 98
/** Hueco entre partidas del anillo, en grados: el hueco del color de la tarjeta. */
const HUECO_GRADOS = 1.4
/** El guilloché: una roseta de círculos que deja libre el centro. */
const GUILLOCHE_CIRCULOS = 36
const GUILLOCHE_RADIO = 30
const GUILLOCHE_DESPLAZAMIENTO = 58
/** Duración del anillo lleno entero, en la entrada. */
const DURACION_ANILLO = 1.1

const dinero = (n: number) => formatearValor(n, 'moneda')

/** La raya tipográfica no se lee bien en voz alta. */
function enPalabras(texto: string): string {
  return texto === SIN_DATO ? 'sin dato' : texto
}

/** Un punto de la moneda: grados desde las doce, en el sentido de las agujas. */
function polar(radio: number, grados: number): [number, number] {
  const a = ((grados - 90) * Math.PI) / 180
  // A centésimas: el seno y el coseno no dan el mismo último decimal en el
  // servidor que en el navegador, y esa diferencia en un atributo del SVG
  // rompe la hidratación.
  const centesimas = (n: number) => Math.round(n * 100) / 100
  return [centesimas(C + radio * Math.cos(a)), centesimas(C + radio * Math.sin(a))]
}

/** Trazo de arco de `desde` a `hasta` grados (menos de una vuelta). */
function trazoArco(radio: number, desde: number, hasta: number): string {
  const [x0, y0] = polar(radio, desde)
  const [x1, y1] = polar(radio, Math.min(hasta, desde + 359.99))
  const largo = hasta - desde > 180 ? 1 : 0
  const f = (n: number) => n.toFixed(2)
  return `M ${f(x0)} ${f(y0)} A ${radio} ${radio} 0 ${largo} 1 ${f(x1)} ${f(y1)}`
}

/** Suma de un lado; null si no hay ni un dato (no es lo mismo que 0). */
function sumar(valores: Array<number | null>): number | null {
  if (valores.every((v) => v === null)) return null
  return valores.reduce<number>((suma, v) => suma + (v ?? 0), 0)
}

// ── Componente ──────────────────────────────────────────────────────────

export interface DineroProps {
  /** Los periodos del grano elegido, con sus comparativas. */
  serie: PuntoDeSerie[]
  /** El periodo elegido en el tablero. */
  periodoId: string
}

export function Dinero({ serie, periodoId }: DineroProps) {
  const refHoja = useRef<HTMLDivElement>(null)
  /**
   * La partida señalada y desde dónde se señaló. Desde la moneda, el libro
   * se queda solo con su fila; desde el libro, las demás filas se apagan.
   */
  const [resalte, setResalte] = useState<{ id: string; desde: 'moneda' | 'libro' } | null>(null)

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

  const piezas = useMemo<Pieza[]>(() => {
    const comparativas = actual?.comparativas ?? []
    const encontradas: Array<Omit<Pieza, 'indice'>> = []
    for (const def of PARTIDAS) {
      const c = comparativas.find((x) => x.indicador.id === def.id)
      if (!c) continue
      encontradas.push({
        id: def.id,
        nombre: c.indicador.nombre,
        grupo: def.grupo,
        Icono: def.Icono,
        color: def.color,
        plan: c.meta,
        real: c.real,
        cumplimiento: c.cumplimiento,
        estado: c.estado,
      })
    }
    return encontradas.map((p, indice) => ({ ...p, indice }))
  }, [actual])

  const realTotal = sumar(piezas.map((p) => p.real))
  const planTotal = sumar(piezas.map((p) => p.plan))
  const total = puntoCalculado(planTotal, realTotal, 'mayor-mejor')

  // El peso de cada bloque se lee del REAL cuando lo hay: es el mes que de
  // verdad ocurrió. Sin real, se enseña el del plan.
  const lado: 'real' | 'plan' = realTotal !== null ? 'real' : 'plan'
  const totalLado = (lado === 'real' ? realTotal : planTotal) ?? 0
  const grupos = (['ganado', 'vendido'] as const)
    .map((grupo) => {
      const suyas = piezas.filter((p) => p.grupo === grupo)
      const real = sumar(suyas.map((p) => p.real))
      const plan = sumar(suyas.map((p) => p.plan))
      return {
        grupo,
        piezas: suyas,
        punto: puntoCalculado(plan, real, 'mayor-mejor'),
        cuota: cociente(lado === 'real' ? real : plan, totalLado),
      }
    })
    .filter((g) => g.piezas.length > 0)

  // ── El anillo: el círculo es el plan; cada partida ocupa su real ─────
  const base = planTotal !== null && planTotal > 0 ? planTotal : (realTotal ?? 0)
  const extensiones = piezas.map((p) => (base > 0 ? ((p.real ?? 0) / base) * 360 : 0))
  const sumaExtensiones = extensiones.reduce((s, e) => s + e, 0)
  // Si el real pasa del plan, el anillo se cierra entero y lo que sobra se
  // dice debajo: un anillo no da más de una vuelta.
  const escala = sumaExtensiones > 360 ? 360 / sumaExtensiones : 1
  const arcos: Arco[] = []
  let angulo = 0
  piezas.forEach((pieza, i) => {
    const extension = extensiones[i] * escala
    arcos.push({ pieza, desde: angulo, hasta: angulo + extension })
    angulo += extension
  })
  const diferencia =
    planTotal !== null && realTotal !== null ? realTotal - planTotal : null

  const firma = `${periodoId}|${piezas.map((p) => `${p.id}:${p.plan ?? '-'}:${p.real ?? '-'}`).join('|')}`

  useEntradaGrafico({
    ambito: refHoja,
    firma,
    datos: actual,
    construir: (raiz, herramientas) => construirEntrada(raiz, herramientas, arcos),
  })

  const hayCifras = piezas.some((p) => (p.plan ?? 0) > 0 || (p.real ?? 0) > 0)
  if (!hayCifras) {
    return (
      <HojaVacia
        Icono={CoinsIcon}
        titulo="Todavía no hay ingreso que contar"
        motivo={
          piezas.length === 0
            ? 'Este periodo no trae ninguna partida de ingreso.'
            : 'Las partidas de ingreso de este periodo están en cero, en el plan y en el real.'
        }
      />
    )
  }

  const lecturaTotal = lecturaDe(dinero, 'de', total)

  return (
    <Hoja ref={refHoja}>
      <CabeceraHoja leyenda={<LeyendaDinero />} mes={actual?.periodo.etiqueta} />

      {/* El velo: lo que la entrada oculta mientras monta su primer
          fotograma. Contenedor de consulta: la moneda va al lado del libro
          cuando la hoja es ancha y encima cuando es estrecha. */}
      <div data-entrada-velo className="@container px-5 pt-6 pb-6">
        <div className="grid grid-cols-1 items-center gap-8 @[56rem]:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] @[56rem]:gap-14">
          <figure className="mx-auto w-full max-w-76">
            <Moneda
              arcos={arcos}
              resaltada={resalte?.id ?? null}
              onResaltar={(id) => setResalte(id === null ? null : { id, desde: 'moneda' })}
              etiqueta={`Ingreso del mes: ${lecturaTotal.cifra}, ${lecturaTotal.relacion}; ${ETIQUETAS_ESTADO[total.estado]}.`}
            >
              <p className="text-[0.6875rem] text-muted-foreground">Ingreso del mes</p>
              <p
                data-cuenta="dinero"
                data-valor={lecturaTotal.valor ?? undefined}
                data-final={lecturaTotal.cifra}
                className={cn(
                  'font-display mt-1.5 text-[2rem] font-normal tracking-[-0.02em] proportional-nums',
                  'leading-none',
                  lecturaTotal.apagada ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {lecturaTotal.cifra}
              </p>
              <p className="mt-2 max-w-40 text-[0.6875rem] leading-snug text-muted-foreground tabular-nums">
                {lecturaTotal.relacion}
              </p>
              <Semaforo
                estado={total.estado}
                etiqueta={ETIQUETAS_ESTADO[total.estado]}
                cumplimiento={total.cumplimiento}
                tamano="sm"
                className="mt-2.5"
              />
            </Moneda>

            {/* Lo que falta (o lo que sobra), con la marca del surco. */}
            {diferencia !== null && diferencia !== 0 && (
              <figcaption data-diferencia className="mt-5 flex items-center justify-center gap-2.5 text-sm">
                <svg aria-hidden="true" width="24" height="8" className="shrink-0">
                  {diferencia < 0 ? (
                    <line
                      x1="0"
                      x2="24"
                      y1="4"
                      y2="4"
                      stroke="var(--serie-plan)"
                      strokeWidth={1.5}
                      strokeDasharray="3 4"
                    />
                  ) : (
                    <line x1="0" x2="24" y1="4" y2="4" stroke="var(--dinero-2)" strokeWidth={3} />
                  )}
                </svg>
                <span className="tabular-nums">
                  <span className="font-semibold text-foreground">{dinero(Math.abs(diferencia))}</span>{' '}
                  <span className="text-muted-foreground">
                    {diferencia < 0 ? 'faltan para el plan' : 'por encima del plan'}
                  </span>
                </span>
              </figcaption>
            )}
          </figure>

          <LibroCuentas
            grupos={grupos}
            total={total}
            realTotal={realTotal}
            planTotal={planTotal}
            lado={lado}
            resaltada={resalte?.id ?? null}
            aislada={resalte?.desde === 'moneda'}
            onResaltar={(id) => setResalte(id === null ? null : { id, desde: 'libro' })}
            mes={actual?.periodo.etiqueta}
          />
        </div>
      </div>
    </Hoja>
  )
}

// ── La moneda ───────────────────────────────────────────────────────────

function Moneda({
  arcos,
  resaltada,
  onResaltar,
  etiqueta,
  children,
}: {
  arcos: Arco[]
  resaltada: string | null
  onResaltar: (id: string | null) => void
  etiqueta: string
  children: ReactNode
}) {
  return (
    <div className="relative aspect-square w-full" role="img" aria-label={etiqueta}>
      <svg viewBox="0 0 300 300" className="block size-full" aria-hidden="true">
        {/* El canto acuñado: muescas finas y regulares, como en el borde de
            una moneda. En el gris de la regla: textura, no dato. */}
        <g>
          {Array.from({ length: MUESCAS }, (_, i) => {
            const grados = (i * 360) / MUESCAS
            const [x1, y1] = polar(R_CANTO_INTERIOR, grados)
            const [x2, y2] = polar(R_CANTO_EXTERIOR, grados)
            return (
              <line
                key={i}
                data-muesca
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--regla)"
                strokeWidth={1}
              />
            )
          })}
        </g>
        <circle cx={C} cy={C} r={R_FILO} fill="none" stroke="var(--regla)" strokeWidth={1} />

        {/* El surco: el plan entero. Una aguada del verde y, por su línea
            media, el discontinuo del plan; donde el real no llega es lo que
            se ve. */}
        <circle
          data-surco
          cx={C}
          cy={C}
          r={R_ANILLO}
          fill="none"
          stroke="color-mix(in oklab, var(--dinero-3) 9%, transparent)"
          strokeWidth={GROSOR_ANILLO}
        />
        <circle
          data-surco
          cx={C}
          cy={C}
          r={R_ANILLO}
          fill="none"
          stroke="var(--serie-plan)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
        />

        {/* La cara: su borde y el guilloché, una roseta en tono muy bajo que
            deja libre el centro para la cifra. */}
        <circle cx={C} cy={C} r={R_CARA} fill="none" stroke="var(--regla-fina)" strokeWidth={1} />
        <g>
          {Array.from({ length: GUILLOCHE_CIRCULOS }, (_, i) => {
            const [cx, cy] = polar(GUILLOCHE_DESPLAZAMIENTO, (i * 360) / GUILLOCHE_CIRCULOS)
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={GUILLOCHE_RADIO}
                fill="none"
                stroke="var(--dinero-3)"
                strokeOpacity={0.16}
                strokeWidth={0.6}
              />
            )
          })}
        </g>

        {/* El real, partida a partida, en el sentido de las agujas. */}
        {arcos.map((arco) =>
          arco.hasta - arco.desde > HUECO_GRADOS ? (
            <path
              key={arco.pieza.id}
              data-segmento={arco.pieza.indice}
              d={trazoArco(R_ANILLO, arco.desde + HUECO_GRADOS / 2, arco.hasta - HUECO_GRADOS / 2)}
              fill="none"
              stroke={arco.pieza.color}
              strokeWidth={GROSOR_ANILLO}
              strokeLinecap="butt"
              className="transition-opacity duration-200"
              style={{
                opacity: resaltada !== null && resaltada !== arco.pieza.id ? 0.25 : undefined,
              }}
              onPointerEnter={() => onResaltar(arco.pieza.id)}
              onPointerLeave={() => onResaltar(null)}
            />
          ) : null,
        )}
      </svg>

      {/* La cara de la moneda: el texto en HTML, con la tipografía de la
          tarjeta. No recibe el puntero, para no tapar el anillo. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  )
}

// ── El libro de cuentas ─────────────────────────────────────────────────

/**
 * Las cuentas del mes como un estado de resultados: bloques con subtotal,
 * partidas sangradas y el total con la raya de la suma y la doble raya de
 * cierre. Cifras tabulares y alineadas a la derecha: se leen en columna.
 *
 * Al señalar un tramo de la moneda, el libro se queda solo con esa partida:
 * todo lo demás se desvanece en su sitio —sin mover nada— y vuelve al
 * soltar. Al señalar una fila del propio libro, las otras solo se apagan: si
 * desaparecieran, no quedaría adónde llevar el ratón.
 *
 * En una hoja estrecha se quedan el real y el plan. La columna de
 * cumplimiento y los iconos no caben —la tabla se salía de la tarjeta— y el
 * cumplimiento del total ya lo dice la moneda.
 */
function LibroCuentas({
  grupos,
  total,
  realTotal,
  planTotal,
  lado,
  resaltada,
  aislada,
  onResaltar,
  mes,
}: {
  grupos: Array<{ grupo: Grupo; piezas: Pieza[]; punto: PuntoFicha; cuota: number | null }>
  total: PuntoFicha
  realTotal: number | null
  planTotal: number | null
  lado: 'real' | 'plan'
  resaltada: string | null
  /** La partida se señaló desde la moneda: el libro se queda solo con ella. */
  aislada: boolean
  onResaltar: (id: string | null) => void
  mes: string | undefined
}) {
  const importe = (valor: number | null) => (valor === null ? SIN_DATO : dinero(valor))
  const aislar = aislada && resaltada !== null
  return (
    <div className="@container min-w-0">
      <table className="w-full border-collapse text-sm tabular-nums">
        <caption className="sr-only">
          Ingreso{mes ? ` de ${mes}` : ''} por partida: real, plan y cumplimiento.
        </caption>
        <thead>
          {/* La raya bajo la cabecera es de la cabecera: se queda cuando el
              libro se aísla en una partida. En bordes colapsados comparte
              línea con la raya del primer bloque, y gana la de arriba. */}
          <tr className="border-b text-xs text-muted-foreground" style={{ borderColor: 'var(--regla)' }}>
            <th scope="col" className="pb-2.5 text-left font-normal">
              <span className="sr-only">Partida</span>
            </th>
            <th scope="col" className="pb-2.5 pl-3 text-right font-normal">
              Real
            </th>
            <th scope="col" className="pb-2.5 pl-3 text-right font-normal">
              Plan
            </th>
            <th scope="col" className="pb-2.5 pl-5 text-right font-normal @max-[26rem]:hidden">
              Cumplimiento
            </th>
          </tr>
        </thead>

        {grupos.map((g) => {
          const definicion = GRUPOS[g.grupo]
          return (
            <tbody key={g.grupo}>
              <tr
                className="border-t transition-[opacity,border-color] duration-200"
                style={{
                  // La raya se apaga aparte: en una tabla de bordes colapsados
                  // no se desvanece con la opacidad de su fila.
                  borderColor: aislar ? 'transparent' : 'var(--regla)',
                  opacity: aislar ? 0 : undefined,
                }}
              >
                <th scope="rowgroup" className="py-3 text-left font-medium text-foreground">
                  <span className="flex items-center gap-2.5">
                    <span className="@max-[26rem]:hidden">
                      <IconoEnPastilla Icono={definicion.Icono} color={definicion.color} tamano="sm" />
                    </span>
                    <span className="min-w-0">
                      <span className="block leading-snug">{definicion.nombre}</span>
                      {g.cuota !== null && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {formatearCumplimiento(g.cuota)} del ingreso
                          {lado === 'plan' ? ' previsto' : ''}
                        </span>
                      )}
                    </span>
                  </span>
                </th>
                <td className="py-3 pl-3 text-right font-semibold text-foreground">
                  <span
                    data-cuenta="dinero"
                    data-valor={g.punto.real ?? undefined}
                    data-final={importe(g.punto.real)}
                  >
                    {importe(g.punto.real)}
                  </span>
                </td>
                <td className="py-3 pl-3 text-right text-muted-foreground">
                  {importe(g.punto.plan)}
                </td>
                <td className="py-3 pl-5 text-right @max-[26rem]:hidden">
                  <Cumplimiento valor={g.punto.cumplimiento} color={definicion.color} />
                </td>
              </tr>
              {g.piezas.map((p) => {
                const otra = resaltada !== null && resaltada !== p.id
                return (
                  <tr
                    key={p.id}
                    tabIndex={0}
                    aria-label={`${p.nombre}: real ${enPalabras(importe(p.real))}, plan ${enPalabras(importe(p.plan))}, ${enPalabras(formatearCumplimiento(p.cumplimiento))} de cumplimiento, ${ETIQUETAS_ESTADO[p.estado]}.`}
                    onPointerEnter={() => onResaltar(p.id)}
                    onPointerLeave={() => onResaltar(null)}
                    onFocus={() => onResaltar(p.id)}
                    onBlur={() => onResaltar(null)}
                    className="transition-opacity duration-200 -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                    style={{ opacity: otra ? (aislar ? 0 : 0.4) : undefined }}
                  >
                    <th scope="row" className="py-2 pl-4 text-left font-normal text-foreground">
                      <span className="flex items-center gap-2.5">
                        <span className="@max-[26rem]:hidden">
                          <IconoEnPastilla Icono={p.Icono} color={p.color} tamano="sm" />
                        </span>
                        <span className="leading-snug">{p.nombre}</span>
                      </span>
                    </th>
                    <td className="py-2 pl-3 text-right text-foreground">
                      <span
                        data-cuenta="dinero"
                        data-valor={p.real ?? undefined}
                        data-final={importe(p.real)}
                      >
                        {importe(p.real)}
                      </span>
                    </td>
                    <td className="py-2 pl-3 text-right text-muted-foreground">
                      {importe(p.plan)}
                    </td>
                    <td className="py-2 pl-5 text-right @max-[26rem]:hidden">
                      <Cumplimiento valor={p.cumplimiento} color={p.color} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          )
        })}

        {/* El total: raya simple de la suma arriba y doble raya de cierre
            abajo, como en un libro de contabilidad. */}
        <tfoot>
          <tr
            className="border-t border-b-[3px] border-double transition-[opacity,border-color] duration-200"
            style={{
              borderColor: aislar
                ? 'transparent'
                : 'color-mix(in oklab, var(--foreground) 55%, transparent)',
              opacity: aislar ? 0 : undefined,
            }}
          >
            <th scope="row" className="py-3 text-left font-semibold text-foreground">
              Ingreso del mes
            </th>
            <td className="py-3 pl-3 text-right">
              <span
                data-cuenta="dinero"
                data-valor={realTotal ?? undefined}
                data-final={importe(realTotal)}
                className="font-display text-[1.25rem] leading-none font-normal tracking-[-0.01em] text-foreground"
              >
                {importe(realTotal)}
              </span>
            </td>
            <td className="py-3 pl-3 text-right text-muted-foreground">{importe(planTotal)}</td>
            <td className="py-3 pl-5 text-right @max-[26rem]:hidden">
              <Cumplimiento valor={total.cumplimiento} color="var(--dinero-1)" fuerte />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/**
 * El cumplimiento de una fila: una barra fina (el real sobre su plan, que es
 * la pista entera) y el porcentaje. En una hoja estrecha no se pinta: se
 * oculta la columna entera. Sin color de semáforo: el juicio lo da la
 * etiqueta de la moneda.
 */
function Cumplimiento({
  valor,
  color,
  fuerte = false,
}: {
  valor: number | null
  color: string
  fuerte?: boolean
}) {
  return (
    <span className="inline-flex items-center justify-end gap-2.5">
      <span
        aria-hidden="true"
        className="relative h-1 w-14 overflow-hidden rounded-full"
        style={{ backgroundColor: 'color-mix(in oklab, var(--serie-plan) 26%, transparent)' }}
      >
        {valor !== null && valor > 0 && (
          <span
            data-barrita
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${Math.min(1, valor) * 100}%`, backgroundColor: color }}
          />
        )}
      </span>
      <span className={cn('w-11 text-right', fuerte ? 'font-semibold text-foreground' : 'text-foreground')}>
        {formatearCumplimiento(valor)}
      </span>
    </span>
  )
}

/**
 * Leyenda propia, con la forma de las marcas: el real es el anillo lleno y
 * el plan, el discontinuo del surco.
 */
function LeyendaDinero() {
  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="flex items-center gap-2 text-foreground">
        <svg aria-hidden="true" width="22" height="8" className="shrink-0">
          <line x1="0" x2="22" y1="4" y2="4" stroke="var(--dinero-2)" strokeWidth={4} />
        </svg>
        Real
      </span>
      <span className="flex items-center gap-2 text-muted-foreground">
        <svg aria-hidden="true" width="22" height="8" className="shrink-0">
          <line
            x1="0"
            x2="22"
            y1="4"
            y2="4"
            stroke="var(--serie-plan)"
            strokeWidth={1.5}
            strokeDasharray="3 4"
          />
        </svg>
        Plan
      </span>
    </div>
  )
}

// ── Entrada ─────────────────────────────────────────────────────────────

/**
 * La timeline del Dinero: una sola, con posiciones, unos 1,8 s.
 *
 *   0,00  El canto se acuña: las muescas aparecen en un barrido de una
 *         vuelta, como un dial que se enciende.
 *   0,10  El surco del plan aparece.
 *   0,35  El anillo se llena en el sentido de las agujas: cada partida con
 *         DrawSVG, una tras otra, a velocidad constante, así que el anillo
 *         entero se lee como un solo gesto. La cifra del centro cuenta a la
 *         vez.
 *   0,30  En el libro cuentan los importes y crecen las barras.
 *   fin   Aparece lo que falta para el plan.
 *
 * Al final, `clearProps`: el DOM final es el estático.
 */
function construirEntrada(
  raiz: HTMLElement,
  { contar }: HerramientasEntrada,
  arcos: Arco[],
): gsap.core.Timeline | null {
  const todos = (selector: string) => Array.from(raiz.querySelectorAll<HTMLElement>(selector))
  const muescas = Array.from(raiz.querySelectorAll('[data-muesca]'))
  const surcos = Array.from(raiz.querySelectorAll('[data-surco]'))
  const segmentos = Array.from(raiz.querySelectorAll('[data-segmento]'))
  const barritas = todos('[data-barrita]')
  const diferencia = raiz.querySelector('[data-diferencia]')
  if (surcos.length === 0) return null

  const linea = gsap.timeline({ defaults: { ease: 'power2.out' } })

  if (muescas.length) {
    linea.fromTo(
      muescas,
      { opacity: 0 },
      { opacity: 1, duration: 0.25, ease: 'none', stagger: 0.55 / muescas.length },
      0,
    )
  }
  linea.fromTo(surcos, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'none' }, 0.1)

  // El anillo, partida a partida, a velocidad constante: la duración de
  // cada tramo es proporcional a los grados que ocupa.
  const inicioAnillo = 0.35
  let t = inicioAnillo
  segmentos.forEach((segmento) => {
    const arco = arcos.find((a) => String(a.pieza.indice) === segmento.getAttribute('data-segmento'))
    const grados = arco ? arco.hasta - arco.desde : 0
    const duracion = Math.max(0.05, (grados / 360) * DURACION_ANILLO)
    linea.fromTo(
      segmento,
      { drawSVG: '0% 0%' },
      { drawSVG: '0% 100%', duration: duracion, ease: 'none' },
      t,
    )
    t += duracion
  })
  const finAnillo = t

  // Las cifras: la del centro con el anillo, las del libro escalonadas.
  todos('[data-cuenta]').forEach((nodo, i) => {
    const valor = Number(nodo.dataset.valor)
    if (!nodo.dataset.valor || !Number.isFinite(valor)) return
    const esCentro = i === 0
    const cuenta = contar(nodo, valor, dinero, esCentro ? finAnillo - inicioAnillo : 0.9)
    if (cuenta) linea.add(cuenta, esCentro ? inicioAnillo : 0.3 + i * 0.05)
  })

  if (barritas.length) {
    linea.fromTo(
      barritas,
      { clipPath: 'inset(0% 100% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, stagger: 0.05, ease: 'power3.out' },
      0.45,
    )
  }
  if (diferencia) {
    linea.fromTo(diferencia, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'none' }, finAnillo)
  }

  // Estado final = estado estático: fuera todo lo que se puso en línea.
  const fin = linea.duration()
  const limpiar = (objetivos: Element[], propiedades: string) => {
    if (objetivos.length) linea.set(objetivos, { clearProps: propiedades }, fin)
  }
  limpiar([...muescas, ...surcos, ...(diferencia ? [diferencia] : [])], 'opacity')
  limpiar(segmentos, 'strokeDasharray,strokeDashoffset')
  limpiar(barritas, 'clipPath')

  return linea
}
