'use client'

/**
 * Serie: plan contra real, mes a mes, para un indicador elegido.
 *
 * Existe para responder a una sola pregunta, la que se hace cualquiera al ver
 * un semáforo en ámbar: «¿esto es un mal mes o venimos cayendo?». Una tarjeta
 * con la cifra del periodo no puede contestarla; hace falta ver la serie.
 *
 * ── Un área, no dos líneas ──────────────────────────────────────────────
 * El real es un área suave con un velo que se desvanece hacia abajo, en el
 * color de la familia del indicador (carmín para el embudo, verde para el
 * dinero, azul para la captación). El plan es una línea discontinua en gris
 * cálido que va por encima: es la referencia, y una referencia se lee como
 * un contorno, no como una masa. Como el área codifica magnitud desde el
 * suelo, el eje Y empieza en 0: un área que arranca en 150 mil € mentiría sobre
 * cuánto hay. Es la misma forma que llevan las fichas de los otros paneles.
 *
 * ── La cabecera es la lectura ───────────────────────────────────────────
 * Como en las fichas: el juicio (icono, palabra y % del plan), la cifra real
 * en grande y su plan al lado. Al pasar el ratón por el gráfico —o con ← y
 * → desde el teclado— la cabecera lee ese mes, y el trazado lo marca con una
 * guía vertical y un punto en cada serie. Sin tooltip: la cifra grande ya es
 * la lectura, y así nada tapa la curva que se está recorriendo.
 *
 * ── Doce meses, o el plan entero ────────────────────────────────────────
 * El plan tiene 33 meses y el real, unos pocos: con todo a la vista, el dato
 * ocupaba una sexta parte del ancho y la pregunta de arriba no se veía. Por
 * defecto se enseñan doce meses con el elegido cerca del centro —medio año
 * de historia y medio de plan—, con la escala ajustada a lo que se ve. El
 * conmutador abre el plan completo, para ver hacia dónde va.
 *
 * ── El futuro solo tiene plan ───────────────────────────────────────────
 * El área termina donde termina el dato. Los huecos no se interpolan
 * (`connectNulls={false}`): una curva sobre un mes sin dato es una
 * afirmación que nadie capturó. El mes que se lee lleva el único punto del
 * gráfico, con un anillo del color de la tarjeta que lo despega de la línea.
 *
 * ── Ejes que caben ──────────────────────────────────────────────────────
 * El gráfico cabe en el ancho de la tarjeta, sin scroll horizontal. Con 33
 * meses no caben 33 etiquetas, así que el eje X enseña una de cada 2, 3, 4,
 * 6 o 12 —ritmos de calendario— según el sitio que haya, y el eje Y va en
 * cifras compactas (200 mil €) para no comerse el trazado con ceros.
 *
 * ── Color y juicio ──────────────────────────────────────────────────────
 * El color del área es identidad (la familia del indicador), nunca estado.
 * El juicio lo emite la etiqueta de estado, siempre con icono y palabra.
 * Ningún texto lleva el color de la serie.
 *
 * ── Movimiento ──────────────────────────────────────────────────────────
 * Recharts no anima nada (`isAnimationActive={false}` en todo). La entrada
 * la lleva GSAP y se lee como un gráfico dibujado a mano: la rejilla regla
 * el papel, el plan se descubre, la curva real se traza de izquierda a
 * derecha con el área asomando a la par y, al llegar, el punto del mes salta
 * y la cifra termina de contar. Ver `construirEntrada` y `useEntradaGrafico`.
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
import { ChartLineIcon } from '@phosphor-icons/react/ssr'
import { Area, AreaChart, CartesianGrid, Line, ReferenceLine, XAxis, YAxis } from 'recharts'

import { ChartContainer } from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { colorDeFamilia, configPlanReal } from '@/components/graficos/config'
import { indicesSueltos, lecturaDe, type PuntoDeSerie } from '@/components/graficos/fichas'
import { LeyendaPlanReal } from '@/components/graficos/leyenda-plan-real'
import { proyectar } from '@/lib/proyeccion'
import { TarjetaGrafico } from '@/components/graficos/tarjeta-grafico'
import { useAnchoContenedor } from '@/components/graficos/use-ancho-contenedor'
import {
  useEntradaGrafico,
  type HerramientasEntrada,
} from '@/components/graficos/use-entrada-grafico'
import { Semaforo } from '@/components/semaforo'
import { tramoProyectado } from '@/components/graficos/tramo-proyectado'
import { gsap } from '@/lib/animacion'
import {
  ETIQUETAS_ESTADO,
  SIN_DATO,
  formatearCumplimiento,
  formatearValor,
} from '@/lib/comparacion'
import { compararPeriodos, etiquetaConCobertura } from '@/lib/periodos'
import type { Estado, Indicador, Periodo, Unidad } from '@/lib/tipos'
import { cn } from '@/lib/utils'

// ── Props ───────────────────────────────────────────────────────────────

export interface PropsTendencias {
  /** Un elemento por periodo. El orden de entrada da igual: se ordena aquí. */
  serie: PuntoDeSerie[]
  indicadorId: string
  /**
   * El periodo elegido en el tablero: la lectura por defecto y el centro de
   * la ventana. Si la serie no lo tiene (una quincena), el último con real.
   */
  periodoId?: string
  /** Si no se pasa, el selector se sustituye por el nombre del indicador. */
  onCambiarIndicador?: (id: string) => void
  indicadores: Indicador[]
}

// ── Geometría ────────────────────────────────────────────────────────────
// Píxeles CSS reales: Recharts dibuja a 1:1, no dentro de un viewBox que
// escale. Por eso las cifras de aquí son las que se ven en pantalla.

/** Alto del trazado (sin la banda del eje X). */
const ALTO_TRAZADO = 252
const ALTO_TRAZADO_ESTRECHO = 212
/** Banda del eje X: las etiquetas de mes, pequeñas y apagadas. */
const ALTO_EJE_X = 28
/** Aire arriba para que el punto del mes y su anillo no toquen el borde. */
const MARGEN_SUPERIOR = 10
/**
 * Aire mínimo a la derecha. La última etiqueta del eje X se centra en su
 * mes, que cae en el borde del trazado: media etiqueta sobresale, y sin
 * sitio se recortaba («Dic 202»). El margen real se calcula con la etiqueta
 * más ancha, en `margenDerecho`; este es el suelo.
 */
const MARGEN_DERECHO_MINIMO = 20
/** Aire entre el eje Y y su etiqueta, y entre el eje X y la suya. */
const AIRE_ETIQUETA = 8
/** Por debajo de este ancho de tarjeta el trazado baja de altura. */
const ANCHO_ESTRECHO = 520
/** Ancho que se supone hasta medir (es también el que pinta el servidor). */
const ANCHO_SUPUESTO = 900

/** Radio del punto del mes: 8 px de diámetro más un anillo de 2 px. */
const RADIO_PUNTO = 4
const ANILLO_PUNTO = 2
/** El punto del plan, hueco y algo menor: es la referencia. */
const RADIO_PUNTO_PLAN = 3.5
/** Un mes con dato entre dos sin él: sin línea que trazar, solo se ve si lleva punto. */
const RADIO_SUELTO = 2.5

/**
 * Tamaño de letra de los ejes a escala 1. Se multiplica por la escala de la
 * raíz (`escalaTexto` de `useAnchoContenedor`): el HTML de la tarjeta crece
 * con el «todo en rem» de la app en pantallas anchas y el SVG, en px fijos,
 * se quedaría atrás.
 */
const TAMANO_EJE = 11
/**
 * Ancho medio de un carácter de Geist, en em, con holgura. Los ejes de
 * Recharts necesitan su ancho en píxeles ANTES de pintar el texto; se
 * estima por lo alto porque quedarse corto recorta la etiqueta.
 */
const EM_POR_CARACTER = 0.62
/** Aire mínimo entre dos etiquetas vecinas del eje X. */
const AIRE_ENTRE_MESES = 16

/**
 * Ritmos de calendario para el eje X: una etiqueta cada 1, 2, 3, 4, 6 o 12
 * meses. Se elige el primero que deje aire entre etiquetas vecinas, así en
 * la tarjeta ancha se ve un trimestre y en el móvil un año, y las etiquetas
 * caen siempre en el mismo mes del año, que es como se lee un calendario.
 */
const PASOS_EJE_X = [1, 2, 3, 4, 6, 12]

/** Meses que se ven por defecto, y cuántos de ellos van antes del elegido. */
const MESES_VENTANA = 12
const MESES_ANTES = 5

type Rango = 'anio' | 'plan'
const RANGOS: Array<{ id: Rango; etiqueta: string }> = [
  { id: 'anio', etiqueta: '12 meses' },
  { id: 'plan', etiqueta: 'Todo el plan' },
]

/** Recorte de los trazos en la entrada: de nada a entero, de izquierda a derecha.
 *  Los −4 px dejan sitio al grosor del trazo, que sobresale de la caja del path. */
const TRAZO_OCULTO = 'inset(-4px 100% -4px 0%)'
const TRAZO_ENTERO = 'inset(-4px 0% -4px 0%)'

// ── Modelo de la vista ──────────────────────────────────────────────────

/** Una fila del gráfico. `meta` y `real` son las claves de las series. */
interface PuntoGrafico {
  id: string
  periodo: Periodo
  meta: number | null
  real: number | null
  cumplimiento: number | null
  estado: Estado
}

/**
 * Tope y marcas del eje Y, en números redondos (0 · 100k · 200k · 300k).
 *
 * Se prueban pasos de 1, 2, 2,5 y 5 por cada potencia de 10 y gana el que
 * deja el tope MÁS BAJO que aún cubre el máximo, con entre 3 y
 * `maxDivisiones` divisiones; a igualdad de tope, el paso mayor, que deja
 * menos marcas que leer. Así la curva más alta casi toca el techo y la
 * rejilla cae en cifras que se leen solas.
 *
 * `entera`: la unidad se imprime sin decimales (cantidades y dinero), así
 * que un paso fraccionario pintaría etiquetas repetidas. Solo se admiten
 * pasos enteros y, con máximos diminutos, menos de tres divisiones.
 */
function escalaLimpia(maximo: number, maxDivisiones: number, entera: boolean) {
  const redondear = (v: number) => Math.round(v * 1e6) / 1e6
  const minDivisiones = entera ? Math.min(3, Math.ceil(maximo)) : 3
  const desde = Math.floor(Math.log10(maximo / maxDivisiones)) - 1
  const hasta = Math.ceil(Math.log10(maximo))

  let mejor: { tope: number; paso: number } | null = null
  for (let k = desde; k <= hasta; k++) {
    for (const factor of [1, 2, 2.5, 5]) {
      const paso = redondear(factor * 10 ** k)
      if (paso <= 0 || (entera && !Number.isInteger(paso))) continue
      const divisiones = Math.ceil(maximo / paso - 1e-9)
      if (divisiones < minDivisiones || divisiones > maxDivisiones) continue
      const tope = redondear(divisiones * paso)
      if (!mejor || tope < mejor.tope || (tope === mejor.tope && paso > mejor.paso)) {
        mejor = { tope, paso }
      }
    }
  }

  const { tope, paso } = mejor ?? { tope: maximo, paso: maximo }
  const marcas: number[] = []
  for (let v = 0; v <= tope + paso / 2; v += paso) marcas.push(redondear(v))
  return { tope, marcas }
}

const FORMATO_COMPACTO = new Intl.NumberFormat('es-ES', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/**
 * Cifra compacta para el eje Y: 200 mil €, 1,5 M €, 40 %. Las marcas de la
 * escala son múltiplos redondos, así que un decimal basta y solo aparece
 * cuando hace falta (250 mil no lleva; 1,5 M sí). El signo menos es el
 * tipográfico, como en el resto del tablero.
 */
function formatearCompacto(valor: number, unidad: Unidad): string {
  if (unidad === 'porcentaje') {
    return Number.isInteger(valor) ? `${valor} %` : formatearValor(valor, unidad)
  }
  if (Math.abs(valor) < 1000) return formatearValor(valor, unidad)

  const cifra = FORMATO_COMPACTO.format(valor).replace(/-/g, '−')
  return unidad === 'moneda' ? `${cifra} €` : cifra
}

/**
 * Qué meses rotula el eje X. Con `n` puntos repartidos en `anchoTrazado`,
 * el primer ritmo de calendario cuyas etiquetas no se pisan; si ni cada
 * doce meses cabe, se abre el paso hasta que quepa.
 */
function idsDelEjeX(puntos: PuntoGrafico[], anchoTrazado: number, anchoEtiqueta: number) {
  const n = puntos.length
  if (n <= 1) return puntos.map((p) => p.id)
  const porPunto = anchoTrazado / (n - 1)
  const paso =
    PASOS_EJE_X.find((p) => p * porPunto >= anchoEtiqueta) ??
    Math.max(12, Math.ceil(anchoEtiqueta / porPunto))
  const ids: string[] = []
  for (let i = 0; i < n; i += paso) ids.push(puntos[i].id)
  return ids
}

function anchoEstimado(caracteres: number, tamano: number): number {
  return Math.ceil(caracteres * tamano * EM_POR_CARACTER)
}

/** La raya tipográfica no se lee bien en voz alta. */
function enPalabras(texto: string): string {
  return texto === SIN_DATO ? 'sin dato' : texto
}

// ── Componente ──────────────────────────────────────────────────────────

export function Tendencias({
  serie,
  indicadorId,
  periodoId,
  onCambiarIndicador,
  indicadores,
}: PropsTendencias) {
  const refTarjeta = useRef<HTMLDivElement>(null)
  const [refCuerpo, ancho, escalaTexto] = useAnchoContenedor<HTMLDivElement>()
  // El degradado vive en <defs> con un id: si hubiera dos series en la
  // página, sin esto compartirían —y pisarían— el mismo velo.
  const idDegradado = `serie-velo-${useId().replace(/:/g, '')}`
  const [rango, setRango] = useState<Rango>('anio')

  const indicador = useMemo(
    () => indicadores.find((i) => i.id === indicadorId) ?? null,
    [indicadores, indicadorId],
  )
  const unidad: Unidad = indicador?.unidad ?? 'cantidad'
  const color = colorDeFamilia(indicador)
  const config = useMemo(() => configPlanReal(indicador), [indicador])

  /** Serie ordenada cronológicamente y reducida al indicador elegido. */
  const datos = useMemo<PuntoGrafico[]>(
    () =>
      serie
        .slice()
        .sort((a, b) => compararPeriodos(a.periodo, b.periodo))
        .map(({ periodo, comparativas }) => {
          const c = comparativas.find((x) => x.indicador.id === indicadorId)
          return {
            id: periodo.id,
            periodo,
            meta: c?.meta ?? null,
            real: c?.real ?? null,
            cumplimiento: c?.cumplimiento ?? null,
            estado: c?.estado ?? 'sin-dato',
          }
        }),
    [serie, indicadorId],
  )

  /** El mes que se lee por defecto: el elegido; si no está, el último con resultado. */
  const indiceElegido = useMemo(() => {
    const i = periodoId ? datos.findIndex((p) => p.id === periodoId) : -1
    if (i >= 0) return i
    for (let j = datos.length - 1; j >= 0; j--) if (datos[j].real !== null) return j
    return datos.length - 1
  }, [datos, periodoId])

  // Lo que se ve: doce meses con el elegido cerca del centro, o el plan entero.
  const inicio =
    rango === 'plan'
      ? 0
      : Math.max(0, Math.min(indiceElegido - MESES_ANTES, datos.length - MESES_VENTANA))
  const visibles = useMemo(
    () => (rango === 'plan' ? datos : datos.slice(inicio, inicio + MESES_VENTANA)),
    [datos, rango, inicio],
  )
  // El mes a medias va en la línea sólida: es un real, aunque sea parcial.
  // Lo único que se dibuja aparte es la proyección del mes que aún no tiene
  // resultado, calculada como en las fichas (lib/proyeccion.ts).
  const enCurso = visibles.findIndex((p) => p.periodo.cobertura !== undefined)
  const proyeccion = useMemo(
    () => proyectar(visibles.map((p) => ({ plan: p.meta, real: p.real })), { enCurso }),
    [visibles, enCurso],
  )
  const dibujo = useMemo(() => tramoProyectado(visibles, proyeccion), [visibles, proyeccion])
  const elegido = Math.max(0, indiceElegido - inicio)
  // Los meses con dato entre dos sin él: sin punto propio no se verían.
  const sueltos = useMemo(
    () => ({
      real: indicesSueltos(dibujo.map((p) => p.real)),
      plan: indicesSueltos(dibujo.map((p) => p.meta)),
    }),
    [dibujo],
  )

  // El mes señalado se guarda con la vista a la que pertenece: al cambiar de
  // indicador, de rango o de periodo, la clave ya no coincide y la lectura
  // vuelve sola al mes elegido.
  const clave = `${indicadorId}|${rango}|${visibles[0]?.id ?? ''}|${elegido}`
  const [senalado, setSenalado] = useState<{ clave: string; indice: number } | null>(null)
  const activo = senalado?.clave === clave ? senalado.indice : null
  const mostrado = activo ?? elegido
  const puntoMostrado = visibles[mostrado] ?? null

  const formatear = (n: number) => formatearValor(n, unidad)
  const relacion = unidad === 'porcentaje' ? 'frente' : 'de'
  const lectura = lecturaDe(formatear, relacion, {
    plan: puntoMostrado?.meta ?? null,
    real: puntoMostrado?.real ?? null,
    cumplimiento: puntoMostrado?.cumplimiento ?? null,
    estado: puntoMostrado?.estado ?? 'sin-dato',
  })
  const puntoElegido = visibles[elegido] ?? null
  const valorElegido = puntoElegido ? (puntoElegido.real ?? puntoElegido.meta) : null

  /** Máximo global, para saber si hay algo que dibujar; el de la vista, para la escala. */
  const maximoTotal = datos.reduce((mayor, p) => Math.max(mayor, p.meta ?? 0, p.real ?? 0), 0)
  const maximo = visibles.reduce((mayor, p) => Math.max(mayor, p.meta ?? 0, p.real ?? 0), 0)
  const estrecho = ancho !== null && ancho < ANCHO_ESTRECHO
  const tamanoEje = TAMANO_EJE * escalaTexto

  const escala = useMemo(
    () => escalaLimpia(maximo > 0 ? maximo : 1, estrecho ? 4 : 5, unidad !== 'porcentaje'),
    [maximo, estrecho, unidad],
  )
  const etiquetasY = useMemo(
    () => new Map(escala.marcas.map((m) => [m, formatearCompacto(m, unidad)])),
    [escala, unidad],
  )
  // El eje Y reserva sitio para su etiqueta más larga, estimada por lo alto.
  const anchoEjeY =
    anchoEstimado(Math.max(1, ...Array.from(etiquetasY.values(), (e) => e.length)), tamanoEje) +
    AIRE_ETIQUETA +
    2

  const anchoEtiquetaX =
    anchoEstimado(Math.max(1, ...visibles.map((p) => p.periodo.etiquetaCorta.length)), tamanoEje) +
    AIRE_ENTRE_MESES
  // Media etiqueta más un pelo: lo que asoma la última marca del eje X.
  const margenDerecho = Math.max(
    MARGEN_DERECHO_MINIMO,
    Math.ceil((anchoEtiquetaX - AIRE_ENTRE_MESES) / 2) + 4,
  )
  const anchoTrazado = (ancho ?? ANCHO_SUPUESTO) - anchoEjeY - margenDerecho
  const idsEjeX = useMemo(
    () => idsDelEjeX(visibles, anchoTrazado, anchoEtiquetaX),
    [visibles, anchoTrazado, anchoEtiquetaX],
  )

  const senalar = (indice: number) =>
    setSenalado((previo) =>
      previo?.clave === clave && previo.indice === indice ? previo : { clave, indice },
    )
  const soltar = () => setSenalado(null)

  /**
   * El puntero, traducido al mes más cercano. El trazado va del borde del
   * eje Y al margen derecho, con los meses repartidos a partes iguales: se
   * apunta a una fecha, no a una línea de 2 px.
   */
  const senalarDesde = (evento: EventoPunteroReact<HTMLDivElement>) => {
    const n = visibles.length
    const caja = evento.currentTarget.getBoundingClientRect()
    const util = caja.width - anchoEjeY - margenDerecho
    if (n <= 1 || util <= 0) return
    const indice = Math.round((evento.clientX - caja.left - anchoEjeY) / (util / (n - 1)))
    senalar(Math.min(n - 1, Math.max(0, indice)))
  }

  /** ← y → recorren los meses; Inicio y Fin van a los extremos; Escape vuelve. */
  const alTeclear = (evento: EventoTecladoReact<HTMLDivElement>) => {
    const ultimo = visibles.length - 1
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
    if (destino === null) return
    evento.preventDefault()
    senalar(destino)
  }

  // La firma son los datos de la vista, no la identidad del array: un
  // re-render del tablero con los mismos números no repite la entrada, y
  // pasar el ratón tampoco. Cambiar de indicador, de rango o de periodo sí.
  const firma = `${indicadorId}|${rango}|${elegido}|${visibles
    .map((p) => `${p.id}:${p.meta ?? '-'}:${p.real ?? '-'}`)
    .join('|')}`

  useEntradaGrafico({
    ambito: refTarjeta,
    firma,
    datos: serie,
    construir: (raiz, herramientas) =>
      construirEntrada(raiz, herramientas, valorElegido, formatear),
  })

  // ── Selector ──────────────────────────────────────────────────────────
  const selector = onCambiarIndicador ? (
    <Select
      value={indicadorId}
      onValueChange={(valor: string | null) => {
        if (typeof valor === 'string') onCambiarIndicador(valor)
      }}
      items={indicadores.map((i) => ({ label: i.nombre, value: i.id }))}
    >
      <SelectTrigger
        size="sm"
        aria-label="Indicador que se grafica"
        className="max-w-64 min-w-44 transicion-fluida"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {indicadores.map((i) => (
          <SelectItem key={i.id} value={i.id}>
            {i.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <p className="text-sm font-medium text-foreground">{indicador?.nombre ?? indicadorId}</p>
  )

  // ── Estado vacío: menos de dos periodos, o ningún dato ────────────────
  // No es un caso de laboratorio: el sistema arranca sin histórico y la
  // primera vez que alguien abre el tablero esto es lo que ve.
  if (datos.length < 2 || maximoTotal <= 0) {
    const pocos = datos.length < 2
    return (
      <TarjetaGrafico ref={refTarjeta}>
        <div data-cabecera-grafico className="flex flex-wrap items-center justify-between gap-3">
          {selector}
          <Semaforo estado="sin-dato" tamano="md" />
        </div>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 px-2 py-10 text-center">
          <ChartLineIcon
            weight="duotone"
            className="size-7 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">
            {pocos ? 'Todavía no hay serie que dibujar' : 'Sin datos para este indicador'}
          </p>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            {pocos
              ? `Hay ${datos.length === 1 ? 'un periodo cerrado' : 'cero periodos cerrados'} y hacen falta dos para dibujar una línea.`
              : 'Ni el plan ni el resultado tienen cifras en los periodos mostrados.'}
          </p>
        </div>
      </TarjetaGrafico>
    )
  }

  const altoTrazado = estrecho ? ALTO_TRAZADO_ESTRECHO : ALTO_TRAZADO
  const nombreIndicador = indicador?.nombre ?? 'el indicador'
  const realMostrado = puntoMostrado?.real ?? null
  // El punto del plan sale al señalar un mes, o cuando el mes no tiene real
  // y es el plan lo que se lee.
  const verPuntoPlan = activo !== null || realMostrado === null

  return (
    <TarjetaGrafico
      ref={refTarjeta}
      // Hasta que hidrata, el CSS global oculta el velo de una tarjeta con
      // este atributo: el HTML del servidor trae el gráfico terminado y, sin
      // esto, se vería un instante antes de borrarse para dibujarse.
      // `useEntradaGrafico` lo quita al tomar el mando.
      data-entrada-pendiente=""
    >
      {/* ── Cabecera: qué se mira, cómo va y la cifra ──────────────────── */}
      {/* El estado se queda arriba a la derecha también en móvil: son los
          controles los que se parten en dos líneas, no la cabecera. */}
      <div data-cabecera-grafico className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {selector}
          <ConmutadorRango rango={rango} onCambiar={setRango} />
        </div>
        <Semaforo
          estado={puntoMostrado?.estado ?? 'sin-dato'}          cumplimiento={puntoMostrado?.cumplimiento ?? null}
          tamano="md"
          className="mt-1"
        />
      </div>

      {/* La cifra, en la serif del mes de la cabecera del tablero. La `key`
          separa el nodo que cuenta en la entrada del que lee un mes
          señalado: una cuenta a medias no puede escribir encima de otro mes. */}
      <div className="mt-5">
        <p
          className={cn(
            'font-display text-[2.75rem] leading-none font-normal tracking-[-0.02em] proportional-nums',
            lectura.apagada ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {activo === null ? (
            <span key="elegido" data-cifra-clave data-final={lectura.cifra}>
              {lectura.cifra}
            </span>
          ) : (
            <span key="senalado">{lectura.cifra}</span>
          )}
        </p>
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">{lectura.relacion}</p>
      </div>

      {/* Leyenda y mes que se lee. `--serie-real` se redefine aquí para que
          la muestra «Real» lleve el color de la familia, igual que el área. */}
      <div
        className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
        style={{ '--serie-real': color } as CSSProperties}
      >
        <LeyendaPlanReal forma="lineas" proyeccion={proyeccion !== null} />
        <p className="text-xs font-medium text-foreground tabular-nums">
          {puntoMostrado ? etiquetaConCobertura(puntoMostrado.periodo) : null}
        </p>
      </div>

      <div
        ref={refCuerpo}
        // El velo: lo que la entrada oculta mientras monta su primer
        // fotograma. El foco vive aquí y no en el SVG: el gráfico entero es
        // un control de mes, y quien navega con teclado tiene que verlo.
        data-entrada-velo
        role="group"
        tabIndex={0}
        aria-label={`Evolución de ${nombreIndicador}. Las flechas izquierda y derecha recorren los meses.`}
        onKeyDown={alTeclear}
        onBlur={soltar}
        onPointerLeave={soltar}
        className="mt-3 -mx-1 rounded-[10px] px-1 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div onPointerMove={senalarDesde} onPointerDown={senalarDesde} className="touch-pan-y">
          <ChartContainer
            config={config}
            // Altura explícita: el carrusel pliega los paneles ocultos y un
            // `h-full` mediría cero. `crispEdges` en la rejilla: una línea de
            // 1 px en coordenada entera se reparte entre dos píxeles a media
            // intensidad y las líneas salían con grosores distintos.
            className="aspect-auto w-full tabular-nums [&_.recharts-cartesian-grid_line]:[shape-rendering:crispEdges]"
            style={{ height: altoTrazado + ALTO_EJE_X + MARGEN_SUPERIOR }}
          >
            <AreaChart
              data={dibujo}
              margin={{ top: MARGEN_SUPERIOR, right: margenDerecho, bottom: 0, left: 0 }}
              // El teclado lo lleva el contenedor, que recorre los meses.
              accessibilityLayer={false}
              title={`Evolución de ${nombreIndicador}: plan contra real en ${visibles.length} periodos.`}
              desc="Las cifras de cada periodo (plan, real, cumplimiento y estado) están también en la tabla que sigue al gráfico."
            >
              <defs>
                {/* El velo del área: del 28 % arriba a nada abajo. Es una
                    aguada del color de la serie, no un bloque. */}
                <linearGradient id={idDegradado} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-real)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-real)" stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* Rejilla horizontal sólida de 1 px, una línea por marca del
                  eje Y. Sin rejilla vertical: los meses ya los dice el eje. */}
              <CartesianGrid vertical={false} stroke="var(--grid-line)" strokeWidth={1} />

              <XAxis
                dataKey="id"
                type="category"
                ticks={idsEjeX}
                interval={0}
                tickLine={false}
                axisLine={false}
                tickMargin={AIRE_ETIQUETA}
                height={ALTO_EJE_X}
                tick={({ x, y, payload, index }) => (
                  <MarcaEjeX
                    x={Number(x)}
                    y={Number(y)}
                    texto={visibles.find((p) => p.id === String(payload.value))?.periodo.etiquetaCorta ?? ''}
                    destacada={String(payload.value) === puntoMostrado?.id}
                    tamano={tamanoEje}
                    clave={index}
                  />
                )}
              />

              <YAxis
                type="number"
                domain={[0, escala.tope]}
                ticks={escala.marcas}
                allowDataOverflow={false}
                width={anchoEjeY}
                tickLine={false}
                axisLine={false}
                tickMargin={AIRE_ETIQUETA}
                tick={({ x, y, payload }) => (
                  <MarcaEjeY
                    x={Number(x)}
                    y={Number(y)}
                    texto={etiquetasY.get(Number(payload.value)) ?? ''}
                    tamano={tamanoEje}
                  />
                )}
              />

              {/* La guía del mes señalado, por debajo de las series. */}
              {activo !== null && visibles[activo] && (
                <ReferenceLine
                  x={visibles[activo].id}
                  stroke="var(--regla)"
                  strokeWidth={1}
                  zIndex={-90}
                />
              )}

              {/* La proyección: punteada y con el punto de anillo, como en las
                  fichas. Va DEBAJO del área: arrastra un par de puntos reales
                  para poder curvar y el trazo sólido los tapa. */}
              {proyeccion && (
                <Line
                  type="monotone"
                  dataKey="proyectado"
                  stroke="var(--color-real)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray="0.1 5"
                  connectNulls={false}
                  isAnimationActive={false}
                  activeDot={false}
                  dot={({ cx, cy, index }) =>
                    proyeccion.puntos.some((x) => x.indice === index) && cx != null && cy != null ? (
                      <circle
                        key={`punto-proyeccion-${index}`}
                        data-punto-suelto
                        cx={Number(cx)}
                        cy={Number(cy)}
                        r={index === mostrado ? RADIO_PUNTO : RADIO_SUELTO + 1}
                        fill="var(--card)"
                        stroke="var(--color-real)"
                        strokeWidth={2}
                        strokeDasharray="1.6 1.6"
                      />
                    ) : (
                      <g key={`sin-punto-${index}`} />
                    )
                  }
                />
              )}

              {/* El real: trazo de 2 px y velo degradado. `fillOpacity` a 1
                  porque la opacidad ya la lleva el degradado (Recharts pone
                  0,6 por defecto y apagaría el velo). */}
              <Area
                type="monotone"
                dataKey="real"
                name="Real"
                stroke="var(--color-real)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={`url(#${idDegradado})`}
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

              {/* El plan: discontinuo, fino y sin puntos salvo el del mes que
                  se lee. Va después del área para pasar por encima del velo. */}
              <Line
                type="monotone"
                dataKey="meta"
                name="Plan"
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
      </div>

      {/* Quien recorre los meses con el teclado oye a qué mes llega. */}
      <p aria-live="polite" className="sr-only">
        {activo !== null
          ? `${puntoMostrado?.periodo.etiqueta}: ${lectura.cifra}, ${lectura.relacion}.`
          : ''}
      </p>

      <TablaLectores datos={datos} unidad={unidad} nombre={nombreIndicador} />
    </TarjetaGrafico>
  )
}

// ── Conmutador de rango ─────────────────────────────────────────────────

/**
 * Doce meses o el plan entero. Mismo dibujo que el conmutador Mes/Quincena
 * de la barra —bandeja y píldoras—, a la escala del selector que lo
 * acompaña. El activo va en papel, no en carmín: es una vista, no un dato.
 */
function ConmutadorRango({ rango, onCambiar }: { rango: Rango; onCambiar: (r: Rango) => void }) {
  return (
    <div
      role="group"
      aria-label="Meses que se ven"
      className="flex items-center gap-0.5 rounded-full p-0.5"
      style={{ background: 'color-mix(in oklab, var(--foreground) 5%, transparent)' }}
    >
      {RANGOS.map((r) => {
        const activo = r.id === rango
        return (
          <button
            key={r.id}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(r.id)}
            className={cn(
              'h-7 rounded-full px-3 text-xs font-medium whitespace-nowrap',
              'transition-[background-color,color,box-shadow] duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              activo
                ? 'bg-card text-foreground shadow-(--sombra-tray)'
                : 'text-muted-foreground hover:text-foreground',
            )}
            style={{ transitionTimingFunction: 'var(--ease-fluid)' }}
          >
            {r.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

// ── Entrada ─────────────────────────────────────────────────────────────

/**
 * La timeline de la Serie: unos 1,3 s, una sola timeline con posiciones.
 *
 *   0,00  La rejilla se traza línea a línea, de izquierda a derecha, como
 *         quien regla el papel antes de dibujar.
 *   0,10  Las marcas de los ejes aparecen.
 *   0,15  El plan se descubre de izquierda a derecha con un recorte: es una
 *         línea discontinua y DrawSVG no sirve para trazos discontinuos
 *         (necesita el `stroke-dasharray` para sí).
 *   0,30  La curva real se traza con DrawSVG de izquierda a derecha y el
 *         área asoma a la par, con un recorte de la misma duración y curva.
 *         El recorte va sobre el propio path del área: su caja de
 *         referencia es la del trazo, así que «100 %» es justo donde
 *         termina el dato, no el borde del gráfico.
 *   1,00  El punto del mes salta (crece con rebote) al llegar la línea.
 *   0,35  La cifra cuenta hasta la del mes elegido.
 *
 * Al final, un solo `set` con `clearProps` por grupo devuelve el DOM
 * estático, sin nada en línea. DrawSVG deja el `stroke-dasharray` puesto
 * si se limpia en su propio tween, así que se limpia al acabar todo.
 *
 * El punto crece por su atributo `r` y no por `scale`: GSAP mueve los
 * elementos SVG por su atributo `transform` y deja `data-svg-origin`
 * sembrado aunque se limpie. El `r` final es el estático, así que no hay
 * nada que limpiar; solo la opacidad con la que se esconde hasta llegar.
 */
function construirEntrada(
  raiz: HTMLElement,
  { contar }: HerramientasEntrada,
  valorClave: number | null,
  formatear: (n: number) => string,
): gsap.core.Timeline | null {
  const todos = (selector: string) => Array.from(raiz.querySelectorAll(selector))
  const uno = (selector: string) => raiz.querySelector(selector)

  const rejilla = todos('.recharts-cartesian-grid-horizontal line')
  const marcasEje = todos('[data-marca-eje]')
  const plan = todos('.recharts-line-curve')
  const curvaReal = todos('.recharts-area-curve')
  const areaReal = todos('.recharts-area-area')
  const punto = uno('[data-punto-elegido]')
  const sueltos = todos('[data-punto-suelto]')
  const cifraClave = uno('[data-cifra-clave]')
  if (plan.length === 0 && curvaReal.length === 0) return null

  const linea = gsap.timeline({ defaults: { ease: 'power2.inOut', duration: 0.5 } })

  if (rejilla.length) {
    linea.fromTo(
      rejilla,
      { drawSVG: '0% 0%' },
      { drawSVG: '0% 100%', duration: 0.5, stagger: 0.05 },
      0,
    )
  }

  if (marcasEje.length) {
    linea.fromTo(
      marcasEje,
      { opacity: 0 },
      { opacity: 1, duration: 0.35, stagger: 0.025, ease: 'none' },
      0.1,
    )
  }

  if (plan.length) {
    linea.fromTo(plan, { clipPath: TRAZO_OCULTO }, { clipPath: TRAZO_ENTERO, duration: 0.9 }, 0.15)
  }

  const inicioReal = 0.3
  const duracionReal = 0.75
  if (curvaReal.length) {
    linea.fromTo(
      curvaReal,
      { drawSVG: '0% 0%' },
      { drawSVG: '0% 100%', duration: duracionReal },
      inicioReal,
    )
  }
  if (areaReal.length) {
    linea.fromTo(
      areaReal,
      { clipPath: TRAZO_OCULTO },
      { clipPath: TRAZO_ENTERO, duration: duracionReal },
      inicioReal,
    )
  }

  if (punto) {
    const radio = Number(punto.getAttribute('r')) || RADIO_PUNTO
    linea.fromTo(
      punto,
      { attr: { r: 0 }, opacity: 0 },
      { attr: { r: radio }, opacity: 1, duration: 0.4, ease: 'back.out(2.5)' },
      inicioReal + duracionReal - 0.05,
    )
  }
  // Los puntos sueltos no tienen trazo que los traiga: aparecen al terminar.
  if (sueltos.length) {
    linea.fromTo(
      sueltos,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: 'none' },
      inicioReal + duracionReal,
    )
  }

  if (valorClave !== null && cifraClave) {
    const cuenta = contar(cifraClave, valorClave, formatear, 0.9)
    if (cuenta) {
      linea.fromTo(cifraClave, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, 0.35)
      linea.add(cuenta, 0.35)
    }
  }

  // Estado final = estado estático: fuera todo lo que se puso en línea.
  const fin = linea.duration()
  const limpiar = (objetivos: Element[], propiedades: string) => {
    if (objetivos.length) linea.set(objetivos, { clearProps: propiedades }, fin)
  }
  limpiar([...rejilla, ...curvaReal], 'strokeDasharray,strokeDashoffset')
  limpiar([...plan, ...areaReal], 'clipPath')
  limpiar(
    [
      ...marcasEje,
      ...sueltos,
      ...(punto ? [punto] : []),
      ...(cifraClave ? [cifraClave] : []),
    ],
    'opacity',
  )

  return linea
}

// ── Piezas del gráfico ──────────────────────────────────────────────────

/**
 * Marca del eje X: el mes, pequeño, apagado y centrado en su punto; el que
 * se está leyendo, en tinta. Propia en vez de la de Recharts para tener un
 * asa estable (`data-marca-eje`): Recharts 3 lleva las marcas a su capa de
 * z-index, fuera del grupo del eje, y un selector por clase no las encuentra.
 */
function MarcaEjeX({
  x,
  y,
  texto,
  destacada,
  tamano,
  clave,
}: {
  x: number
  y: number
  texto: string
  destacada: boolean
  tamano: number
  clave: number
}) {
  return (
    <text
      key={clave}
      data-marca-eje
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

/** Marca del eje Y: la cifra compacta, alineada a la derecha contra el eje. */
function MarcaEjeY({
  x,
  y,
  texto,
  tamano,
}: {
  x: number
  y: number
  texto: string
  tamano: number
}) {
  return (
    <text
      data-marca-eje
      x={x}
      y={y}
      dy="0.32em"
      textAnchor="end"
      fontSize={tamano}
      style={{ fill: 'var(--muted-foreground)' }}
    >
      {texto}
    </text>
  )
}

/**
 * Tabla para lectores de pantalla: el gemelo accesible del gráfico. Lleva
 * los 33 meses aunque el gráfico enseñe doce. Va en un `div.sr-only` que la
 * envuelve, NUNCA con `sr-only` en la propia tabla: una tabla ignora
 * `height: 1px` y alarga la página con un hueco invisible.
 */
function TablaLectores({
  datos,
  unidad,
  nombre,
}: {
  datos: PuntoGrafico[]
  unidad: Unidad
  nombre: string
}) {
  return (
    <div className="sr-only">
      <table>
        <caption>Evolución de {nombre}: plan contra real por periodo.</caption>
        <thead>
          <tr>
            <th scope="col">Periodo</th>
            <th scope="col">Plan</th>
            <th scope="col">Real</th>
            <th scope="col">Cumplimiento</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((punto) => (
            <tr key={punto.id}>
              <th scope="row">{punto.periodo.etiqueta}</th>
              <td>{enPalabras(formatearValor(punto.meta, unidad))}</td>
              <td>{enPalabras(formatearValor(punto.real, unidad))}</td>
              <td>{enPalabras(formatearCumplimiento(punto.cumplimiento))}</td>
              <td>{ETIQUETAS_ESTADO[punto.estado]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Tendencias
