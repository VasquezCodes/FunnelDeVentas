'use client'

/**
 * Fichas: la gramática del Embudo.
 *
 * ── La ficha ─────────────────────────────────────────────────────────────
 * Una métrica contra su plan, leída de arriba abajo: el nombre y el juicio
 * (icono, palabra y % del plan); la cifra real, grande; su plan, en gris y
 * pegado a ella («de 145 del plan»). Ninguna cifra va suelta: la grande
 * lleva siempre su plan al lado, y el plan dice que lo es.
 *
 * Al pie, los meses que rodean al elegido con la misma forma que la Serie:
 * el real es un área de color con velo y el plan, una línea discontinua
 * gris que pasa por encima. Sin eje Y ni rejilla: la magnitud ya la da la
 * cifra, y el gráfico solo tiene que enseñar la forma — si el real se
 * despega del plan, desde cuándo y hacia dónde. Cada ficha tiene su propia
 * escala, desde 0: las métricas de una hoja no se miden en lo mismo.
 *
 * ── Una hoja, no seis tarjetas ───────────────────────────────────────────
 * Las fichas son celdas de una sola hoja (`Hoja`), separadas por filetes de
 * 1 px: el hueco de la rejilla deja ver el color del filete. Es la hoja
 * reglada del resto del tablero; seis tarjetas iguales con su sombra solo
 * trocearían. La leyenda y el mes elegido van una vez, en la cabecera.
 *
 * ── Cada ficha, su mes ───────────────────────────────────────────────────
 * Al pasar el ratón por el gráfico de una ficha —o con ← y → cuando tiene el
 * foco— esa ficha lee el mes señalado: cifra, plan, juicio, una guía
 * vertical y el mes dicho en la frase del plan («de 222 del plan en junio»).
 * Las demás siguen en el mes elegido. Hubo una versión que movía la hoja
 * entera a la vez; el usuario prefirió que cada ficha fuera a lo suyo. Sin
 * tooltips: la propia ficha es la lectura.
 *
 * ── Movimiento ───────────────────────────────────────────────────────────
 * La entrada es de GSAP (`useEntradaGrafico`), en cascada, ficha a ficha:
 * el plan se descubre, la curva real se traza con DrawSVG con el velo
 * asomando a la par, el punto del mes salta y la cifra cuenta. Recharts no
 * anima nada.
 */

import {
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as EventoTecladoReact,
  type PointerEvent as EventoPunteroReact,
} from 'react'
import type { Icon } from '@phosphor-icons/react'
import { ArrowsOutSimpleIcon } from '@phosphor-icons/react/ssr'
import type { LucideIcon } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Line, ReferenceLine, XAxis, YAxis } from 'recharts'

import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { CabeceraHoja, Hoja, IconoEnPastilla } from '@/components/graficos/hoja'
import { LeyendaPlanReal } from '@/components/graficos/leyenda-plan-real'
import { useAnchoContenedor } from '@/components/graficos/use-ancho-contenedor'
import {
  useEntradaGrafico,
  type HerramientasEntrada,
} from '@/components/graficos/use-entrada-grafico'
import { Semaforo } from '@/components/semaforo'
import { tramoEnCurso } from '@/components/graficos/tramo-en-curso'
import { gsap } from '@/lib/animacion'
import { ETIQUETAS_ESTADO, SIN_DATO, calcularEstado } from '@/lib/comparacion'
import {
  MESES_CORTOS,
  MESES_LARGOS,
  capitalizar,
  etiquetaConCobertura,
} from '@/lib/periodos'
import type { Comparativa, Direccion, Estado, Periodo } from '@/lib/tipos'
import { cn } from '@/lib/utils'

// ── Modelo ──────────────────────────────────────────────────────────────

/** Un periodo con todas sus comparativas: la materia prima de las series. */
export interface PuntoDeSerie {
  periodo: Periodo
  comparativas: Comparativa[]
}

/** Un mes de una ficha. */
export interface PuntoFicha {
  plan: number | null
  real: number | null
  /** real / plan. null si falta un lado o el plan es 0. */
  cumplimiento: number | null
  estado: Estado
}

export interface Ficha {
  id: string
  titulo: string
  /** Icono de Lucide de la métrica, en su pastilla del color de la ficha. */
  Icono?: LucideIcon
  /** Token CSS del real: la familia del indicador. */
  color: string
  /** La cifra en su unidad: «103», «64.380 €», «3,9 %». */
  formatear: (valor: number) => string
  /**
   * Cómo se lee el plan junto a la cifra. Un volumen es parte de su plan
   * («de 145 del plan»); una tasa o un coste se comparan con él («frente a
   * 32,19 € del plan»): «58,60 € de 32,19 €» no querría decir nada.
   */
  relacion: 'de' | 'frente'
  /** Un punto por periodo de la ventana, en el mismo orden. */
  puntos: PuntoFicha[]
  /** Las cifras del eje en la ficha grande: «1,2 mil», «40 %». Por defecto, compactas. */
  formatearEje?: (valor: number) => string
  /** Clases de colocación en la rejilla ancha. */
  colocacion?: string
}

const PUNTO_VACIO: PuntoFicha = { plan: null, real: null, cumplimiento: null, estado: 'sin-dato' }

export { LARGO_VENTANA, ventanaDe } from '@/components/graficos/ventana'

const FORMATO_EJE = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 })
const ejeCompacto = (valor: number) => FORMATO_EJE.format(valor)

/** División que no devuelve Infinity, NaN ni un dato ausente. */
export function cociente(a: number | null | undefined, b: number | null | undefined) {
  if (a == null || b == null || b === 0) return null
  const r = a / b
  return Number.isFinite(r) ? r : null
}

/** El punto de una ficha a partir de una comparativa del motor (o de su ausencia). */
export function puntoDeComparativa(c: Comparativa | undefined): PuntoFicha {
  if (!c) return PUNTO_VACIO
  return { plan: c.meta, real: c.real, cumplimiento: c.cumplimiento, estado: c.estado }
}

/** Un punto calculado aquí (tasas, costes): el juicio sale del mismo motor. */
export function puntoCalculado(
  plan: number | null,
  real: number | null,
  direccion: Direccion,
): PuntoFicha {
  const cumplimiento = cociente(real, plan)
  return { plan, real, cumplimiento, estado: calcularEstado(cumplimiento, direccion) }
}

/** «Abr» para un mes; «1ª Abr» para una quincena. */
export function etiquetaMes(periodo: Periodo): string {
  const mes = capitalizar(MESES_CORTOS[periodo.mes - 1] ?? '')
  return periodo.tipo === 'quincena' ? `${periodo.quincena}ª ${mes}` : mes
}

/** «junio» para un mes; «la 1ª quincena de junio» para una quincena. Para dentro de una frase. */
export function mesEnFrase(periodo: Periodo): string {
  const mes = MESES_LARGOS[periodo.mes - 1] ?? ''
  return periodo.tipo === 'quincena' ? `la ${periodo.quincena}ª quincena de ${mes}` : mes
}

/**
 * Los meses con dato cuyos dos vecinos no lo tienen. Con `connectNulls` en
 * falso, Recharts no traza nada para ellos —un tramo de un solo punto no
 * mide nada— y el dato desaparecía. Estos meses llevan punto propio.
 */
export function indicesSueltos(valores: Array<number | null>): Set<number> {
  const sueltos = new Set<number>()
  valores.forEach((valor, i) => {
    if (valor === null) return
    const antes = i > 0 ? valores[i - 1] : null
    const despues = i < valores.length - 1 ? valores[i + 1] : null
    if (antes == null && despues == null) sueltos.add(i)
  })
  return sueltos
}

/** Lo que dice una cifra de un punto: la cifra y su relación con el plan. */
export interface Lectura {
  cifra: string
  /** El número que hay detrás de la cifra (para contarlo), o null. */
  valor: number | null
  /** Sin resultado: la cifra es la del plan y va en gris. */
  apagada: boolean
  relacion: string
}

/**
 * `mes`, si se pasa, entra en la frase («de 222 del plan en junio»): es lo
 * que dice qué mes se lee cuando no es el elegido.
 */
export function lecturaDe(
  formatear: (valor: number) => string,
  relacion: 'de' | 'frente',
  punto: PuntoFicha,
  mes?: string,
): Lectura {
  const { plan, real } = punto
  const enMes = mes ? ` en ${mes}` : ''
  if (real !== null) {
    const frase =
      plan === null
        ? `sin plan ${mes ? `para ${mes}` : 'para este mes'}`
        : relacion === 'de'
          ? `de ${formatear(plan)} del plan${enMes}`
          : `frente a ${formatear(plan)} del plan${enMes}`
    return { cifra: formatear(real), valor: real, apagada: false, relacion: frase }
  }
  // Un mes sin resultado enseña lo previsto, en gris y dicho: una raya
  // gigante sería justo el número suelto que no debe haber.
  if (plan !== null) {
    return {
      cifra: formatear(plan),
      valor: plan,
      apagada: true,
      relacion: mes ? `previsto para ${mes}, sin resultado` : 'previsto en el plan, sin resultado',
    }
  }
  return {
    cifra: SIN_DATO,
    valor: null,
    apagada: true,
    relacion: `sin plan ni resultado${enMes}`,
  }
}

// ── Geometría de la mini serie ──────────────────────────────────────────
// Píxeles CSS reales: Recharts dibuja a 1:1, sin viewBox que escale.

/** Alto del trazado, sin la banda de los meses. */
const ALTO_TRAZADO = 76
/** En la ficha abierta en grande: alto para leer la forma y un eje con cifras. */
const ALTO_TRAZADO_GRANDE = 260
const ANCHO_EJE_Y = 44
/** Banda de los meses. */
const ALTO_EJE = 22
/**
 * Aire a los lados del trazado. Los meses de los extremos se centran en su
 * punto, que cae en el borde: sin este margen, media etiqueta se saldría.
 * También es la cuenta con la que el puntero se traduce a un mes.
 */
const MARGEN_X = 14
/** Aire arriba para que el punto del mes y su anillo no toquen el borde. */
const MARGEN_SUPERIOR = 8
/** El punto del mes: 8 px de diámetro con un anillo de 2 px del color de la ficha. */
const RADIO_PUNTO = 4
const ANILLO_PUNTO = 2
/** El punto del plan, hueco y algo menor: es la referencia. */
const RADIO_PUNTO_PLAN = 3.5
/** Un mes con dato entre dos sin él: sin línea que trazar, solo se ve si lleva punto. */
const RADIO_SUELTO = 2.5
/** Tamaño de los meses a escala 1 (se multiplica por la escala de la raíz). */
const TAMANO_EJE = 11
/** Por debajo de este hueco entre meses, solo se rotulan los extremos y el mes mostrado. */
const HUECO_MINIMO_MES = 30
/** Desfase de la cascada de entrada entre una ficha y la siguiente. */
const PASO_CASCADA = 0.07

/** Recorte de los trazos en la entrada: de nada a entero, de izquierda a derecha.
 *  Los −4 px dejan sitio al grosor del trazo, que sobresale de su caja. */
const TRAZO_OCULTO = 'inset(-4px 100% -4px 0%)'
const TRAZO_ENTERO = 'inset(-4px 0% -4px 0%)'

// ── La hoja ─────────────────────────────────────────────────────────────

export interface RejillaFichasProps {
  /** Los periodos de la ventana, en orden cronológico. */
  ventana: Periodo[]
  /** Posición del periodo elegido dentro de la ventana. */
  elegido: number
  fichas: Ficha[]
  /** Qué se mira, para el lector de pantalla: «Embudo de ventas por etapa». */
  descripcion: string
  /** Cabecera de la primera columna de la tabla accesible: «Etapa»… */
  nombreFila: string
  /** Color de la muestra «Real» de la leyenda. Sin él, tinta. */
  colorLeyenda?: string
  /** Identidad de la carga: al cambiar de periodo la entrada se repite. */
  datos: unknown
  /** Pulsar una ficha la abre en grande. Sin esto, las fichas no se pulsan. */
  onAbrir?: (indiceFicha: number) => void
}

export function RejillaFichas({
  ventana,
  elegido,
  fichas,
  descripcion,
  nombreFila,
  colorLeyenda,
  datos,
  onAbrir,
}: RejillaFichasProps) {
  const refHoja = useRef<HTMLDivElement>(null)

  // Identidad de la vista: el mes que cada ficha señale se guarda con ella,
  // así que al cambiar de periodo todas vuelven solas al mes elegido.
  const clave = `${ventana.map((p) => p.id).join('|')}#${elegido}`

  // La firma son los números, no la identidad de los arrays: un re-render
  // con las mismas cifras no repite la entrada. Pasar el ratón no la toca.
  const firma = `${clave}|${fichas
    .map((f) => `${f.id}:${f.puntos.map((p) => `${p.plan ?? '-'}/${p.real ?? '-'}`).join(',')}`)
    .join('|')}`

  useEntradaGrafico({
    ambito: refHoja,
    firma,
    datos,
    construir: (raiz, herramientas) => construirEntrada(raiz, herramientas, fichas, elegido),
  })

  return (
    <Hoja ref={refHoja}>
      <CabeceraHoja
        leyenda={<LeyendaPlanReal forma="lineas" />}
        mes={ventana[elegido] ? etiquetaConCobertura(ventana[elegido]) : undefined}
        style={colorLeyenda ? ({ '--serie-real': colorLeyenda } as CSSProperties) : undefined}
      />

      {/* Contenedor de consulta: las columnas dependen del sitio que deja el
          carrusel, no de la ventana. Tres en ancho, dos en medio, una en móvil. */}
      <div className="@container">
        <div
          // El velo: lo que la entrada oculta mientras monta su primer fotograma.
          data-entrada-velo
          className="grid grid-cols-1 gap-px @[34rem]:grid-cols-2 @[60rem]:grid-cols-3"
          style={{ backgroundColor: 'var(--regla-fina)' }}
        >
          {fichas.map((ficha, i) => (
            <CeldaFicha
              key={ficha.id}
              ficha={ficha}
              indiceFicha={i}
              ventana={ventana}
              elegido={elegido}
              clave={clave}
              onAbrir={onAbrir ? () => onAbrir(i) : undefined}
            />
          ))}
        </div>
      </div>

      <TablaLectores
        ventana={ventana}
        fichas={fichas}
        descripcion={descripcion}
        nombreFila={nombreFila}
      />
    </Hoja>
  )
}

// ── La ficha ────────────────────────────────────────────────────────────

export interface CeldaFichaProps {
  ficha: Ficha
  indiceFicha: number
  ventana: Periodo[]
  elegido: number
  /** Identidad de la vista: si cambia, la ficha vuelve al mes elegido. */
  clave: string
  /** Abre la ficha en grande. Pulsar la ficha, o Intro con el foco en ella. */
  onAbrir?: () => void
  /** La ficha abierta en grande: trazado alto, eje con cifras y rejilla. */
  grande?: boolean
}

export function CeldaFicha({
  ficha,
  indiceFicha,
  ventana,
  elegido,
  clave,
  onAbrir,
  grande = false,
}: CeldaFichaProps) {
  const [refTrazado, ancho, escalaTexto] = useAnchoContenedor<HTMLDivElement>()
  // El velo del área vive en <defs> con un id: sin uno propio por ficha,
  // las seis compartirían —y pisarían— el mismo degradado.
  const idVelo = `ficha-velo-${useId().replace(/:/g, '')}`

  // El mes señalado se guarda con la vista a la que pertenece: si cambia
  // el periodo, la clave ya no coincide y la ficha vuelve sola al elegido,
  // sin un efecto que lo resetee un fotograma tarde.
  const [senalado, setSenalado] = useState<{ clave: string; indice: number } | null>(null)
  const activo = senalado?.clave === clave ? senalado.indice : null
  const mostrado = activo ?? elegido
  const periodoMostrado = ventana[mostrado]
  const punto = ficha.puntos[mostrado] ?? PUNTO_VACIO
  const lectura = lecturaDe(
    ficha.formatear,
    ficha.relacion,
    punto,
    activo !== null && periodoMostrado ? mesEnFrase(periodoMostrado) : undefined,
  )
  const { Icono } = ficha

  const senalar = (indice: number) =>
    setSenalado((previo) =>
      previo?.clave === clave && previo.indice === indice ? previo : { clave, indice },
    )
  const soltar = () => setSenalado(null)

  /** ← y → recorren los meses; Inicio y Fin van a los extremos; Escape vuelve. */
  const alTeclear = (evento: EventoTecladoReact<HTMLElement>) => {
    const ultimo = ventana.length - 1
    const desde = activo ?? elegido
    const destino =
      evento.key === 'ArrowLeft'
        ? Math.max(0, desde - 1)
        : evento.key === 'ArrowRight'
          ? Math.min(ultimo, desde + 1)
          : evento.key === 'Home'
            ? 0
            : evento.key === 'End'
              ? ultimo
              : null
    if (evento.key === 'Escape') soltar()
    if (onAbrir && (evento.key === 'Enter' || evento.key === ' ')) {
      evento.preventDefault()
      onAbrir()
      return
    }
    if (destino === null) return
    evento.preventDefault()
    senalar(destino)
  }

  const config = useMemo(
    () =>
      ({
        plan: { label: 'Plan', color: 'var(--serie-plan)' },
        real: { label: 'Real', color: ficha.color },
      }) satisfies ChartConfig,
    [ficha.color],
  )

  // Un mes a medias (solo en meses, nunca en quincenas) va punteado: su real
  // es «a la fecha» y, sin marca, la curva parecería hundirse.
  const enCurso = ventana.findIndex((p) => p.cobertura !== undefined)
  const datos = useMemo(
    () =>
      tramoEnCurso(
        ventana.map((periodo, i) => ({
          id: periodo.id,
          mes: etiquetaMes(periodo),
          plan: ficha.puntos[i]?.plan ?? null,
          real: ficha.puntos[i]?.real ?? null,
        })),
        enCurso,
      ),
    [ventana, ficha.puntos, enCurso],
  )
  const n = datos.length
  const tope =
    Math.max(0, ...datos.flatMap((d) => [d.plan ?? 0, d.real ?? 0, d.realEnCurso ?? 0])) || 1
  const sueltos = useMemo(
    () => ({
      real: indicesSueltos(datos.map((d) => d.real)),
      plan: indicesSueltos(datos.map((d) => d.plan)),
    }),
    [datos],
  )

  // En grande, el eje de cifras ocupa su sitio a la izquierda del trazado.
  const ejeY = grande ? ANCHO_EJE_Y : 0
  const altoTrazado = grande ? ALTO_TRAZADO_GRANDE : ALTO_TRAZADO

  // Con sitio, todos los meses; si no, los extremos, el elegido y el mostrado.
  const hueco = ancho === null ? Infinity : (ancho - 2 * MARGEN_X - ejeY) / Math.max(1, n - 1)
  const rotulados =
    hueco >= HUECO_MINIMO_MES ? null : new Set([0, n - 1, elegido, mostrado])
  const tamanoEje = TAMANO_EJE * escalaTexto

  /** El puntero, traducido al mes más cercano: se apunta a una fecha, no a una línea de 2 px. */
  const senalarDesde = (evento: EventoPunteroReact<HTMLDivElement>) => {
    const caja = evento.currentTarget.getBoundingClientRect()
    const util = caja.width - 2 * MARGEN_X - ejeY
    if (n <= 1 || util <= 0) {
      senalar(0)
      return
    }
    const indice = Math.round((evento.clientX - caja.left - MARGEN_X - ejeY) / (util / (n - 1)))
    senalar(Math.min(n - 1, Math.max(0, indice)))
  }

  const realMostrado = datos[mostrado]?.real ?? null
  // El punto del plan sale al señalar un mes, o cuando el mes no tiene real
  // y es el plan lo que se lee.
  const verPuntoPlan = activo !== null || realMostrado === null

  return (
    <section
      data-ficha={indiceFicha}
      // Cada ficha es su propio control de mes: el foco, las flechas y el
      // anillo son suyos, igual que el ratón.
      role="group"
      tabIndex={0}
      aria-label={`${ficha.titulo}. Las flechas izquierda y derecha recorren los meses.${onAbrir ? ' Intro la abre en grande.' : ''}`}
      onKeyDown={alTeclear}
      onBlur={soltar}
      onPointerLeave={soltar}
      onClick={onAbrir}
      className={cn(
        'group/ficha flex min-w-0 flex-col bg-card -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring',
        grande ? 'px-6 pt-5 pb-4' : 'px-5 pt-5 pb-3',
        onAbrir &&
          'cursor-pointer transition-colors duration-200 hover:bg-[color-mix(in_oklab,var(--foreground)_2.5%,var(--card))]',
        ficha.colocacion,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          className={cn(
            'flex min-w-0 items-center gap-2.5 font-medium text-foreground',
            grande ? 'text-base leading-6' : 'text-[0.8125rem] leading-5',
          )}
        >
          {Icono && <IconoEnPastilla Icono={Icono} color={ficha.color} tamano={grande ? 'md' : 'sm'} />}
          <span className="truncate">{ficha.titulo}</span>
          {/* Que se puede abrir se dice al pasar: fija, la flecha sería
              ruido repetido en seis fichas. */}
          {onAbrir && (
            <ArrowsOutSimpleIcon
              weight="bold"
              aria-hidden="true"
              className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover/ficha:opacity-100 group-focus-visible/ficha:opacity-100"
            />
          )}
        </h3>
        <Semaforo
          estado={punto.estado}          cumplimiento={punto.cumplimiento}
          tamano="sm"
        />
      </div>

      {/* La cifra, en la serif del mes de la cabecera: la misma voz para
          todo lo que es «el número». Cifras proporcionales: a este tamaño,
          las tabulares dejan el «1» nadando. La `key` separa el nodo que
          cuenta en la entrada del que enseña un mes señalado: si fueran el
          mismo, una cuenta a medias escribiría encima del mes señalado. */}
      <p
        className={cn(
          'font-display mt-4 leading-none font-normal tracking-[-0.02em] proportional-nums',
          grande ? 'text-[3.25rem]' : 'text-[2.5rem]',
          lectura.apagada ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {activo === null ? (
          <span key="elegido" data-cifra data-final={lectura.cifra}>
            {lectura.cifra}
          </span>
        ) : (
          <span key="senalado">{lectura.cifra}</span>
        )}
      </p>
      <p className="mt-2 text-xs text-muted-foreground tabular-nums">{lectura.relacion}</p>

      {/* La mini serie. Recibe el puntero en todo su ancho, meses incluidos.
          `aria-hidden`: lo que dice ya está en la cabecera de la ficha y en
          la tabla para lectores de pantalla. */}
      <div
        ref={refTrazado}
        aria-hidden="true"
        onPointerMove={senalarDesde}
        onPointerDown={senalarDesde}
        className="mt-4 touch-pan-y"
      >
        <ChartContainer
          config={config}
          // Altura explícita: el carrusel pliega los paneles ocultos y un
          // `h-full` mediría cero.
          className="aspect-auto w-full"
          style={{ height: MARGEN_SUPERIOR + altoTrazado + ALTO_EJE }}
        >
          <AreaChart
            data={datos}
            margin={{ top: MARGEN_SUPERIOR, right: MARGEN_X, bottom: 0, left: MARGEN_X }}
            // El teclado lo lleva la ficha, no el gráfico.
            accessibilityLayer={false}
          >
            {/* En grande, la rejilla regla el papel para leer las cifras del eje. */}
            {grande && <CartesianGrid vertical={false} stroke="var(--grid-line)" />}
            <defs>
              {/* El velo: una aguada del color de la serie que se desvanece
                  hacia abajo, no un bloque. */}
              <linearGradient id={idVelo} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-real)" stopOpacity={0.26} />
                <stop offset="100%" stopColor="var(--color-real)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="id"
              type="category"
              interval={0}
              tickLine={false}
              axisLine={false}
              height={ALTO_EJE}
              tickMargin={6}
              tick={({ x, y, index }) =>
                rotulados === null || rotulados.has(index) ? (
                  <MarcaMes
                    x={Number(x)}
                    y={Number(y)}
                    texto={datos[index]?.mes ?? ''}
                    destacada={index === mostrado}
                    tamano={tamanoEje}
                  />
                ) : (
                  <g />
                )
              }
            />
            {grande ? (
              <YAxis
                type="number"
                domain={[0, 'auto']}
                width={ANCHO_EJE_Y}
                tickLine={false}
                axisLine={false}
                tickCount={5}
                tickFormatter={ficha.formatearEje ?? ejeCompacto}
                tick={{ fontSize: tamanoEje, fill: 'var(--muted-foreground)' }}
              />
            ) : (
              <YAxis hide type="number" domain={[0, tope]} allowDataOverflow={false} />
            )}

            {/* La guía del mes señalado, por debajo de las series. */}
            {activo !== null && datos[activo] && (
              <ReferenceLine
                x={datos[activo].id}
                stroke="var(--regla)"
                strokeWidth={1}
                zIndex={-90}
              />
            )}

            {/* El real: trazo de 2 px y velo. `fillOpacity` a 1 porque la
                opacidad ya la lleva el degradado. */}
            <Area
              type="monotone"
              dataKey="real"
              stroke="var(--color-real)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#${idVelo})`}
              fillOpacity={1}
              baseValue={0}
              connectNulls={false}
              isAnimationActive={false}
              activeDot={false}
              dot={({ cx, cy, index }) => {
                if (cx == null || cy == null) return <g key={`sin-punto-${index}`} />
                if (index === mostrado && realMostrado !== null) {
                  return (
                    <circle
                      key="punto-real"
                      data-punto-elegido={activo === null ? '' : undefined}
                      cx={Number(cx)}
                      cy={Number(cy)}
                      r={RADIO_PUNTO}
                      fill="var(--color-real)"
                      stroke="var(--card)"
                      strokeWidth={ANILLO_PUNTO}
                    />
                  )
                }
                return sueltos.real.has(index) ? (
                  <circle
                    key={`suelto-${index}`}
                    data-punto-suelto
                    cx={Number(cx)}
                    cy={Number(cy)}
                    r={RADIO_SUELTO}
                    fill="var(--color-real)"
                  />
                ) : (
                  <g key={`sin-punto-${index}`} />
                )
              }}
            />

            {/* El tramo del mes en curso: punteado y con el punto hueco. El
                punto lleva data-punto-suelto para aparecer al final de la
                entrada, con los demás sueltos. */}
            {enCurso >= 0 && (
              <Line
                type="monotone"
                dataKey="realEnCurso"
                stroke="var(--color-real)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray="0.1 5"
                connectNulls={false}
                isAnimationActive={false}
                activeDot={false}
                dot={({ cx, cy, index }) =>
                  index === enCurso && cx != null && cy != null ? (
                    <circle
                      key="punto-en-curso"
                      data-punto-suelto
                      cx={Number(cx)}
                      cy={Number(cy)}
                      r={index === mostrado ? RADIO_PUNTO : RADIO_SUELTO + 1}
                      fill="var(--card)"
                      stroke="var(--color-real)"
                      strokeWidth={2}
                    />
                  ) : (
                    <g key={`sin-punto-${index}`} />
                  )
                }
              />
            )}

            {/* El plan: discontinuo y fino. Va después del área para pasar
                por encima del velo. */}
            <Line
              type="monotone"
              dataKey="plan"
              stroke="var(--color-plan)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              connectNulls={false}
              isAnimationActive={false}
              activeDot={false}
              dot={({ cx, cy, index }) => {
                if (cx == null || cy == null) return <g key={`sin-punto-${index}`} />
                if (verPuntoPlan && index === mostrado) {
                  return (
                    <circle
                      key="punto-plan"
                      data-punto-elegido={
                        activo === null && realMostrado === null ? '' : undefined
                      }
                      cx={Number(cx)}
                      cy={Number(cy)}
                      r={RADIO_PUNTO_PLAN}
                      fill="var(--card)"
                      stroke="var(--color-plan)"
                      strokeWidth={1.5}
                    />
                  )
                }
                // Lo que viene: un periodo después del elegido sin resultado
                // solo tiene plan, y su punto hueco dice «previsto».
                if (index > elegido && datos[index]?.real == null) {
                  return (
                    <circle
                      key={`previsto-${index}`}
                      data-punto-suelto
                      cx={Number(cx)}
                      cy={Number(cy)}
                      r={RADIO_PUNTO_PLAN}
                      fill="var(--card)"
                      stroke="var(--color-plan)"
                      strokeWidth={1.5}
                    />
                  )
                }
                return sueltos.plan.has(index) ? (
                  <circle
                    key={`suelto-${index}`}
                    data-punto-suelto
                    cx={Number(cx)}
                    cy={Number(cy)}
                    r={RADIO_SUELTO}
                    fill="var(--color-plan)"
                  />
                ) : (
                  <g key={`sin-punto-${index}`} />
                )
              }}
            />
          </AreaChart>
        </ChartContainer>
      </div>

      {/* Quien recorre los meses con el teclado oye a qué mes llega. */}
      <p aria-live="polite" className="sr-only">
        {activo !== null && periodoMostrado
          ? `${periodoMostrado.etiqueta}: ${lectura.cifra}, ${lectura.relacion}.`
          : ''}
      </p>
    </section>
  )
}

/**
 * Un mes del eje: pequeño y apagado; el que se está leyendo, en tinta.
 * Propia y no la de Recharts para tener un asa estable (`data-marca-mes`)
 * con la que la entrada los encuentra.
 */
function MarcaMes({
  x,
  y,
  texto,
  destacada,
  tamano,
}: {
  x: number
  y: number
  texto: string
  destacada: boolean
  tamano: number
}) {
  return (
    <text
      data-marca-mes
      x={x}
      y={y}
      dy="0.71em"
      textAnchor="middle"
      fontSize={tamano}
      fontWeight={destacada ? 500 : 400}
      style={{ fill: destacada ? 'var(--foreground)' : 'var(--muted-foreground)' }}
    >
      {texto}
    </text>
  )
}

// ── Entrada ─────────────────────────────────────────────────────────────

/**
 * La timeline de la hoja: una sola, con posiciones, unos 1,4 s. Cada ficha
 * entra 0,07 s después de la anterior, en el orden del DOM (que es el de
 * lectura):
 *
 *   +0,00  Los meses del eje aparecen.
 *   +0,05  El plan se descubre de izquierda a derecha con un recorte: es
 *          discontinuo y DrawSVG necesita el `stroke-dasharray` para sí.
 *   +0,15  La curva real se traza con DrawSVG y el velo asoma a la par, con
 *          un recorte de la misma duración y curva.
 *   +0,10  La cifra cuenta hasta el valor del mes elegido.
 *   +0,90  El punto del mes salta al llegar la curva.
 *
 * Al final, un `set` con `clearProps` por grupo devuelve el DOM estático.
 * El punto crece por su atributo `r` y no por `scale`: GSAP mueve el SVG
 * por su atributo `transform` y deja `data-svg-origin` sembrado aunque se
 * limpie. El `r` final es el estático, así que no hay nada que limpiar.
 */
function construirEntrada(
  raiz: HTMLElement,
  { contar }: HerramientasEntrada,
  fichas: Ficha[],
  elegido: number,
): gsap.core.Timeline | null {
  const celdas = Array.from(raiz.querySelectorAll<HTMLElement>('[data-ficha]'))
  if (celdas.length === 0) return null

  const linea = gsap.timeline({ defaults: { ease: 'power2.inOut', duration: 0.8 } })
  const trazos: Element[] = []
  const recortes: Element[] = []
  const opacidades: Element[] = []

  celdas.forEach((celda, orden) => {
    const ficha = fichas[Number(celda.dataset.ficha)]
    const t = orden * PASO_CASCADA
    const todos = (selector: string) => Array.from(celda.querySelectorAll(selector))

    const marcas = todos('[data-marca-mes]')
    const plan = todos('.recharts-line-curve')
    const curva = todos('.recharts-area-curve')
    const area = todos('.recharts-area-area')
    const punto = celda.querySelector('[data-punto-elegido]')
    const sueltos = todos('[data-punto-suelto]')
    const cifra = celda.querySelector('[data-cifra]')

    if (marcas.length) {
      linea.fromTo(
        marcas,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, stagger: 0.03, ease: 'none' },
        t,
      )
      opacidades.push(...marcas)
    }
    if (plan.length) {
      linea.fromTo(plan, { clipPath: TRAZO_OCULTO }, { clipPath: TRAZO_ENTERO }, t + 0.05)
      recortes.push(...plan)
    }
    if (curva.length) {
      linea.fromTo(curva, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.85 }, t + 0.15)
      trazos.push(...curva)
    }
    if (area.length) {
      linea.fromTo(
        area,
        { clipPath: TRAZO_OCULTO },
        { clipPath: TRAZO_ENTERO, duration: 0.85 },
        t + 0.15,
      )
      recortes.push(...area)
    }
    if (punto) {
      const radio = Number(punto.getAttribute('r')) || RADIO_PUNTO
      linea.fromTo(
        punto,
        { attr: { r: 0 }, opacity: 0 },
        { attr: { r: radio }, opacity: 1, duration: 0.4, ease: 'back.out(2.5)' },
        t + 0.9,
      )
      opacidades.push(punto)
    }
    // Los puntos sueltos no tienen trazo que los traiga: aparecen cuando
    // termina de dibujarse lo demás, no antes, que se leerían como el dato.
    if (sueltos.length) {
      linea.fromTo(sueltos, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'none' }, t + 0.8)
      opacidades.push(...sueltos)
    }

    const lectura = ficha
      ? lecturaDe(ficha.formatear, ficha.relacion, ficha.puntos[elegido] ?? PUNTO_VACIO)
      : null
    if (cifra && ficha && lectura?.valor != null) {
      const cuenta = contar(cifra, lectura.valor, ficha.formatear, 0.9)
      if (cuenta) linea.add(cuenta, t + 0.1)
    }
  })

  // Estado final = estado estático: fuera todo lo que se puso en línea.
  // DrawSVG deja el `stroke-dasharray` puesto si se limpia en su propio
  // tween, así que se limpia al acabar todo.
  const fin = linea.duration()
  if (trazos.length) linea.set(trazos, { clearProps: 'strokeDasharray,strokeDashoffset' }, fin)
  if (recortes.length) linea.set(recortes, { clearProps: 'clipPath' }, fin)
  if (opacidades.length) linea.set(opacidades, { clearProps: 'opacity' }, fin)

  return linea
}

// ── Accesibilidad ───────────────────────────────────────────────────────

/** La raya tipográfica no se lee bien en voz alta. */
function enPalabras(texto: string): string {
  return texto === SIN_DATO ? 'sin dato' : texto
}

function textoCelda(ficha: Ficha, punto: PuntoFicha): string {
  const { plan, real, estado } = punto
  const planTexto = plan === null ? 'sin plan' : `plan ${ficha.formatear(plan)}`
  if (real === null) return plan === null ? 'sin dato' : `sin resultado, ${planTexto}`
  return `${enPalabras(ficha.formatear(real))}, ${planTexto}, ${ETIQUETAS_ESTADO[estado].toLowerCase()}`
}

/**
 * El gemelo accesible de la hoja: una fila por ficha y una columna por mes.
 * En un `div.sr-only` que la envuelve, NUNCA con `sr-only` en la propia
 * tabla: una tabla ignora `height: 1px` y alarga la página con un hueco.
 */
function TablaLectores({
  ventana,
  fichas,
  descripcion,
  nombreFila,
}: {
  ventana: Periodo[]
  fichas: Ficha[]
  descripcion: string
  nombreFila: string
}) {
  const primero = ventana[0]
  const ultimo = ventana[ventana.length - 1]
  return (
    <div className="sr-only">
      <table>
        <caption>
          {descripcion}: real y plan
          {primero && ultimo ? ` de ${primero.etiqueta} a ${ultimo.etiqueta}` : ''}.
        </caption>
        <thead>
          <tr>
            <th scope="col">{nombreFila}</th>
            {ventana.map((p) => (
              <th key={p.id} scope="col">
                {p.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fichas.map((ficha) => (
            <tr key={ficha.id}>
              <th scope="row">{ficha.titulo}</th>
              {ventana.map((p, i) => (
                <td key={p.id}>{textoCelda(ficha, ficha.puntos[i] ?? PUNTO_VACIO)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Vacío ───────────────────────────────────────────────────────────────

/**
 * Hoja sin nada que dibujar. Dice por qué con exactitud: el sistema arranca
 * sin histórico y la primera vez que alguien abre el tablero esto es lo que
 * ve.
 */
export function HojaVacia({
  Icono,
  titulo,
  motivo,
}: {
  Icono: Icon
  titulo: string
  motivo: string
}) {
  return (
    <div
      data-slot="tarjeta-grafico"
      className="relative flex flex-col items-center justify-center gap-2 rounded-[14px] border border-border bg-card px-4 py-12 text-center text-card-foreground"
    >
      <Icono weight="duotone" className="size-7 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">{titulo}</p>
      <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{motivo}</p>
    </div>
  )
}
