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

/** Canales con cifras en el plan vigente, en orden de volumen. */
export const CANALES_ACTIVOS: Canal[] = ['publicidad', 'prospeccion', 'referidos']

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

export type Estado = 'ok' | 'alerta' | 'critico' | 'sin-dato'

export interface Umbrales {
  /** Cumplimiento >= este valor ⇒ 'ok'. Ej. 0.95 */
  ok: number
  /** Cumplimiento >= este valor ⇒ 'alerta'. Por debajo ⇒ 'critico'. Ej. 0.8 */
  alerta: number
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
  metas(periodoId: string): Promise<Meta[]>
  reales(periodoId: string): Promise<Real[]>
}

export const UMBRALES_POR_DEFECTO: Umbrales = { ok: 0.95, alerta: 0.8 }
