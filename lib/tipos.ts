/**
 * Contrato de dominio. Todo lo demás se construye contra estos tipos.
 *
 * Regla de arquitectura: la interfaz `FuenteDatos` es la única puerta por
 * la que entran los datos. Hoy la implementa la captura manual; mañana la
 * implementará la sincronización con el CRM. Cambiar de una a otra no debe
 * tocar ni un componente ni el motor de comparación.
 */

// ── Periodos ────────────────────────────────────────────────────────────

export type TipoPeriodo = 'mes' | 'quincena'

export interface Periodo {
  /** '2026-03' para mes, '2026-03-Q1' para quincena. */
  id: string
  tipo: TipoPeriodo
  anio: number
  /** 1–12 */
  mes: number
  /** 1 = días 1–15 · 2 = día 16 al fin de mes. Ausente si tipo es 'mes'. */
  quincena?: 1 | 2
  /** ISO 'YYYY-MM-DD', inclusivo. */
  inicio: string
  /** ISO 'YYYY-MM-DD', inclusivo. */
  fin: string
  /** 'Marzo 2026' · '1–15 mar 2026' */
  etiqueta: string
  /** 'mar 2026' · '1ª quinc. mar' — para ejes de gráficas. */
  etiquetaCorta: string
  /**
   * Solo en un mes a medias: qué quincena tiene datos. 'q1' ⇒ el mes se lee
   * «hasta el 15». Lo pone la fuente de datos al leer los reales.
   */
  cobertura?: 'q1' | 'q2'
}

// ── Indicadores ─────────────────────────────────────────────────────────

export type Unidad = 'cantidad' | 'moneda' | 'porcentaje'

/**
 * Hacia dónde es bueno moverse. Casi todo es 'mayor-mejor', pero un
 * indicador como "coste por lead" o "tiempo de respuesta" se invierte, y
 * si no se modela, el semáforo se pinta al revés.
 */
export type Direccion = 'mayor-mejor' | 'menor-mejor'

/**
 * Canales de captación del plan.
 *
 * Son siete en el Excel, pero hoy solo tres llevan cifras: el plan reserva
 * los otros cuatro sin asignarles nada en los 33 meses. Se modelan todos
 * igualmente —el plan los contempla— y es la interfaz quien decide no
 * dibujar los vacíos. Borrarlos aquí obligaría a tocar código el día que
 * alguien les ponga un número.
 */
export type Canal =
  | 'publicidad'
  | 'prospeccion'
  | 'referidos'
  | 'afiliados'
  | 'contenido'
  | 'newsletter'
  | 'interno'

/**
 * Los siete canales, en el orden del Excel — que es también el de volumen.
 *
 * Es el orden canónico: fija en qué orden se dibujan y, sobre todo, qué
 * color le toca a cada uno. El color sigue al canal y nunca a su posición en
 * una lista filtrada; si dependiera de la posición, dejar de pintar un canal
 * vacío repintaría a todos los demás y el mismo tono significaría hoy
 * «Referidos» y mañana «Contenido».
 */
export const CANALES: Canal[] = [
  'publicidad',
  'prospeccion',
  'referidos',
  'afiliados',
  'contenido',
  'newsletter',
  'interno',
]

/**
 * Canales con cifras en el plan vigente, en orden de volumen.
 *
 * Es una lista escrita a mano, y por eso ya no la usa el gráfico de Canales:
 * allí los canales salen de quién tiene leads en el periodo (`canalesConLeads`),
 * que es la pregunta de verdad. Queda para lo que todavía la necesita.
 */
export const CANALES_ACTIVOS: Canal[] = ['publicidad', 'prospeccion', 'referidos']

/** El tono de un canal en la rampa de siete. Por canal, no por posición. */
export function colorDeCanal(canal: Canal): string {
  return `var(--canal-${CANALES.indexOf(canal) + 1})`
}

export const NOMBRE_CANAL: Record<Canal, string> = {
  publicidad: 'Publicidad',
  prospeccion: 'Prospección',
  referidos: 'Referidos',
  afiliados: 'Afiliados',
  contenido: 'Contenido',
  newsletter: 'Newsletter',
  interno: 'Interno',
}

/** Línea de producto. El embudo comercial es de FLECHA; ARCO entra por otra vía. */
export type Linea = 'flecha' | 'arco' | 'otros'

/**
 * Familia a la que pertenece un indicador. Ordena el tablero sin que cada
 * componente tenga que reconocer ids a mano.
 *
 *   embudo    — las cinco etapas, de lead a cierre
 *   dinero    — ingreso cerrado por línea
 *   captacion — lo que cuesta traer ese volumen
 *   insumo    — la materia prima de cada canal (clics, contactos, envíos)
 */
export type Grupo = 'embudo' | 'dinero' | 'captacion' | 'insumo'

export interface Indicador {
  id: string
  nombre: string
  unidad: Unidad
  direccion: Direccion
  /** Posición en el embudo (1 = boca). null si no es una etapa. */
  etapa: number | null
  /**
   * Si este indicador es el desglose por canal de una etapa, el id de la
   * etapa madre.
   *
   * Los desgloses llevan `etapa: null` a propósito, aunque conceptualmente
   * pertenezcan a una. `calcularConversiones` empareja por `etapa`, y si los
   * siete canales de «leads» también la declararan, la serie se ordenaría
   * con siete indicadores en la posición 1 y las conversiones saldrían del
   * canal a otro canal en vez de etapa a etapa.
   */
  desglosaA?: string
  canal?: Canal
  linea?: Linea
  grupo?: Grupo
  /** Clave original en la hoja «Plan de Ventas». La trazabilidad al Excel. */
  clave?: string
  /** Texto de ayuda: cómo se calcula. Se muestra en el tooltip. */
  definicion?: string
}

// ── Valores ─────────────────────────────────────────────────────────────

/** Meta del plan de negocio para un periodo. */
export interface Meta {
  periodoId: string
  indicadorId: string
  valor: number
}

/** Resultado real. `origen` distingue captura manual de sincronización. */
export interface Real {
  periodoId: string
  indicadorId: string
  valor: number
  origen: 'manual' | 'crm'
  capturadoPor?: string
  capturadoEn?: string
}

// ── Comparación ─────────────────────────────────────────────────────────

/**
 * Cómo va un indicador contra su plan. Cuatro tramos y la ausencia de dato.
 *
 * Los nombres dicen lo que se lee en pantalla, no un juicio de calidad: en
 * este tablero todo se mide contra el plan, y «fuera de plan» es un hecho.
 * Antes eran 'ok' | 'alerta' | 'critico', que sonaban a incidencia de
 * sistema y además se quedaban cortos: cualquier cosa por encima del 95 %
 * era lo mismo, y cerrar al 96 % no es cerrar al 140 %.
 */
export type Estado = 'mejor' | 'en-plan' | 'cerca' | 'fuera' | 'sin-dato'

/**
 * Los cortes entre tramos, sobre una base de 100 % del plan:
 *
 *     ── 'mejor'    más de un 5 % por encima
 *     1,05
 *     ── 'en-plan'  el 5 % de arriba y de abajo
 *     0,95
 *     ── 'cerca'    entre un 5 % y un 20 % por debajo
 *     0,80
 *     ── 'fuera'    más de un 20 % por debajo
 *
 * En un indicador 'menor-mejor' —el gasto— la escala es la misma pero por
 * el otro lado: gastar más de un 20 % de lo previsto es estar fuera de
 * plan, y gastar más de un 5 % por debajo es mejor que el plan. De eso se
 * encarga `calcularEstado`, que refleja el cumplimiento antes de medirlo.
 */
export interface Umbrales {
  /** Por encima de este valor, mejor que el plan. Ej. 1.05 */
  mejor: number
  /** Desde este valor y hasta `mejor`, en plan. Ej. 0.95 */
  enPlan: number
  /** Desde este valor y hasta `enPlan`, cerca del plan. Por debajo, fuera. Ej. 0.8 */
  cerca: number
}

export interface Comparativa {
  indicador: Indicador
  meta: number | null
  real: number | null
  /** real − meta. Negativo = por debajo del plan. null si falta un lado. */
  desviacion: number | null
  /** real / meta. 0.78 = 78 %. null si falta un lado o la meta es 0. */
  cumplimiento: number | null
  estado: Estado
}

/** Conversión de una etapa del embudo a la siguiente. */
export interface Conversion {
  desde: Indicador
  hacia: Indicador
  tasaPlan: number | null
  tasaReal: number | null
}

/**
 * Una tasa del plan: qué fracción de `desde` se espera que llegue a `hacia`.
 *
 * Sale de la hoja «Variables» del libro, que es donde el plan fija sus
 * hipótesis (la conversión a llamada, el CTR, la CVR de cada canal). Es una
 * constante del plan, no una cifra por mes. La tasa real de un periodo es
 * `real(hacia) / real(desde)` de ese periodo (`lib/tasas.ts`).
 */
export interface TasaDelPlan {
  /** 'eleads>llamadas', 'publicidad-clicks>eleads.publicidad'… */
  id: string
  /** Como la llama el Excel: «Tasa de cierre», «Link CTR», «CVR Publicidad». */
  nombre: string
  /** Id del indicador de origen. */
  desde: string
  /** Id del indicador de destino. */
  hacia: string
  /** Fracción (0.6 = 60 %) o multiplicador (30), según `forma`. null si el libro no trae el dato. */
  plan: number | null
  /**
   * Cómo se lee la cifra. Casi todas las tasas del plan son una fracción de
   * lo que pasa a la etapa siguiente, pero tres no: de una reactivación
   * salen 30 contactos, y de un contenido largo, 500 visitas. Son
   * multiplicadores, y escribirlos en porcentaje daría «3.000 %».
   */
  forma?: 'fraccion' | 'multiplicador'
  /** El canal, si la tasa es de un canal. */
  canal?: Canal
}

// ── Fuente de datos ─────────────────────────────────────────────────────

/**
 * La costura del sistema. Implementaciones actuales y futuras:
 *   · FuenteMock    — datos de ejemplo (hoy)
 *   · FuenteManual  — captura desde la interfaz (fase 1)
 *   · FuenteCrm     — sincronización con HighLevel (fase 2)
 *
 * Los componentes consumen `Comparativa[]`, nunca una fuente directamente.
 */
export interface FuenteDatos {
  indicadores(): Promise<Indicador[]>
  /** Periodos con datos, del más reciente al más antiguo. */
  periodos(): Promise<Periodo[]>
  /** Metas del plan. En un mes en curso, las de lo que ya pasó (ver lib/reales/mes.ts). */
  metas(periodoId: string): Promise<Meta[]>
  reales(periodoId: string): Promise<Real[]>
  /** Las tasas del plan: las hipótesis de conversión, iguales para todos los periodos. */
  tasas(): Promise<TasaDelPlan[]>
}

export const UMBRALES_POR_DEFECTO: Umbrales = { mejor: 1.05, enPlan: 0.95, cerca: 0.8 }
