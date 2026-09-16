/**
 * Motor de periodos.
 *
 * Regla de oro de este archivo: **ninguna fecha se construye ni se lee con la
 * zona horaria local**. Todo se calcula con `Date.UTC` y se serializa a mano a
 * 'YYYY-MM-DD'. Si se usara `new Date(2026, 2, 1)` en Miami (UTC−5), el
 * `toISOString()` devolvería '2026-02-28T…' y el primer día de marzo se
 * convertiría en el último de febrero. Ese desplazamiento silencioso es el bug
 * clásico de un motor de periodos: no rompe nada, solo deja los datos mal
 * atribuidos un día al mes anterior.
 *
 * Las funciones son puras: mismos argumentos, mismo resultado, sin depender de
 * "hoy" salvo donde se pasa explícitamente.
 */

import type { Periodo, TipoPeriodo } from '@/lib/tipos'

// ── Nombres de mes ──────────────────────────────────────────────────────

/** Índice 0 = enero. En minúscula: la capitalización se aplica al componer. */
export const MESES_LARGOS: readonly string[] = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** Abreviaturas de tres letras, sin punto: caben en un eje de gráfica. */
export const MESES_CORTOS: readonly string[] = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

/** Guion largo tipográfico para los rangos: '1–15', no '1-15'. */
const GUION_RANGO = '–'

// ── Utilidades internas ─────────────────────────────────────────────────

/** Mayúscula inicial. Los meses se guardan en minúscula y se capitalizan al mostrarlos. */
export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function esEnteroFinito(n: number): boolean {
  return Number.isInteger(n)
}

function validarAnioMes(anio: number, mes: number): void {
  if (!esEnteroFinito(anio) || anio < 1000 || anio > 9999) {
    throw new RangeError(`Año fuera de rango: ${anio}`)
  }
  if (!esEnteroFinito(mes) || mes < 1 || mes > 12) {
    throw new RangeError(`Mes fuera de rango (1–12): ${mes}`)
  }
}

/**
 * Último día del mes. El día 0 del mes siguiente es el último del actual, y
 * `Date.UTC` normaliza mes 12 (índice 12) al enero del año siguiente, así que
 * diciembre no necesita un caso especial.
 *
 * Cubre bisiestos por construcción: febrero de 2024 → 29, de 2026 → 28.
 */
export function ultimoDiaDelMes(anio: number, mes: number): number {
  validarAnioMes(anio, mes)
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

/** 'YYYY-MM-DD' sin pasar por la zona horaria local. */
export function aIso(anio: number, mes: number, dia: number): string {
  return `${String(anio).padStart(4, '0')}-${pad2(mes)}-${pad2(dia)}`
}

// ── Constructores ───────────────────────────────────────────────────────

/**
 * Periodo mensual completo.
 * `construirPeriodoMes(2026, 3)` → id '2026-03', del 01 al 31 de marzo.
 */
export function construirPeriodoMes(anio: number, mes: number): Periodo {
  validarAnioMes(anio, mes)

  const indice = mes - 1
  const ultimo = ultimoDiaDelMes(anio, mes)

  return {
    id: `${anio}-${pad2(mes)}`,
    tipo: 'mes',
    anio,
    mes,
    inicio: aIso(anio, mes, 1),
    fin: aIso(anio, mes, ultimo),
    etiqueta: `${capitalizar(MESES_LARGOS[indice])} ${anio}`,
    etiquetaCorta: `${capitalizar(MESES_CORTOS[indice])} ${anio}`,
  }
}

/**
 * Periodo quincenal.
 * Q1 = días 1–15 (siempre 15 días). Q2 = día 16 al fin de mes (13, 14, 15 o 16
 * días según el mes). Las quincenas no son iguales de largas y eso importa al
 * repartir metas: ver `metaDelPeriodo`.
 *
 * `construirPeriodoQuincena(2026, 3, 2)` → '2026-03-Q2', 16–31 mar 2026.
 */
export function construirPeriodoQuincena(
  anio: number,
  mes: number,
  quincena: 1 | 2,
): Periodo {
  validarAnioMes(anio, mes)
  if (quincena !== 1 && quincena !== 2) {
    throw new RangeError(`Quincena inválida (1 o 2): ${String(quincena)}`)
  }

  const indice = mes - 1
  const diaInicio = quincena === 1 ? 1 : 16
  const diaFin = quincena === 1 ? 15 : ultimoDiaDelMes(anio, mes)

  return {
    id: `${anio}-${pad2(mes)}-Q${quincena}`,
    tipo: 'quincena',
    anio,
    mes,
    quincena,
    inicio: aIso(anio, mes, diaInicio),
    fin: aIso(anio, mes, diaFin),
    etiqueta: `${diaInicio}${GUION_RANGO}${diaFin} ${capitalizar(MESES_CORTOS[indice])} ${anio}`,
    etiquetaCorta: `${quincena}ª quinc. ${capitalizar(MESES_CORTOS[indice])}`,
  }
}

// ── Series ──────────────────────────────────────────────────────────────

/**
 * Todos los periodos de un año, en orden cronológico ascendente.
 * 12 elementos si es 'mes', 24 si es 'quincena'.
 *
 * El orden ascendente es el de una gráfica; quien necesite el orden de un
 * selector ("lo más reciente primero") que invierta la copia.
 */
export function periodosDelAnio(anio: number, tipo: TipoPeriodo): Periodo[] {
  const periodos: Periodo[] = []

  for (let mes = 1; mes <= 12; mes++) {
    if (tipo === 'mes') {
      periodos.push(construirPeriodoMes(anio, mes))
    } else {
      periodos.push(construirPeriodoQuincena(anio, mes, 1))
      periodos.push(construirPeriodoQuincena(anio, mes, 2))
    }
  }

  return periodos
}

// ── Reparto de metas ────────────────────────────────────────────────────

/**
 * Meta que le corresponde a un periodo a partir de la meta mensual del plan.
 *
 * Mes → la meta íntegra. Quincena → la mitad exacta.
 *
 * SUPUESTO DISCUTIBLE, tal como lo pide el documento del cliente: partir la
 * meta por la mitad asume que la venta se reparte de forma uniforme dentro del
 * mes. En una agencia rara vez es así — el cierre se carga a la segunda
 * quincena, cuando el comercial persigue su número — de modo que la primera
 * quincena tenderá a verse en rojo y la segunda a compensar. Si el equipo
 * quiere reflejarlo, aquí es donde se cambia: un reparto 40/60, o un peso por
 * días naturales (Q1 son 15 días de 31 en marzo, no la mitad). Se deja el 50/50
 * porque es lo acordado y porque es la única regla que no hay que explicar.
 */
export function metaDelPeriodo(metaMensual: number, periodo: Periodo): number {
  return periodo.tipo === 'quincena' ? metaMensual / 2 : metaMensual
}

// ── Serialización ───────────────────────────────────────────────────────

/** '2026-03' o '2026-03-Q1'. El grupo de quincena es opcional. */
const PATRON_ID = /^(\d{4})-(\d{2})(?:-Q([12]))?$/

/**
 * Reconstruye un periodo desde su id. Devuelve `null` en vez de lanzar porque
 * la entrada típica es un parámetro de URL o de query string: valor ajeno, no
 * confiable, y el llamador quiere un fallback, no un error 500.
 */
export function parsePeriodoId(id: string): Periodo | null {
  const coincidencia = PATRON_ID.exec(id.trim())
  if (!coincidencia) return null

  const anio = Number(coincidencia[1])
  const mes = Number(coincidencia[2])
  if (mes < 1 || mes > 12) return null

  const textoQuincena = coincidencia[3]
  if (textoQuincena === undefined) {
    return construirPeriodoMes(anio, mes)
  }

  // El patrón ya restringe a '1' o '2'; el aserto solo reconcilia el tipo.
  const quincena = Number(textoQuincena) as 1 | 2
  return construirPeriodoQuincena(anio, mes, quincena)
}

// ── Navegación ──────────────────────────────────────────────────────────

/**
 * Periodo inmediatamente anterior, del mismo tipo.
 *
 * Mensual:  '2026-01' → '2025-12'  (cruza el año).
 * Quincenal: Q2 → Q1 del mismo mes; Q1 → Q2 del mes anterior, que es el caso
 * que se olvida y hace que enero-Q1 salte a un mes 0 inexistente.
 */
export function periodoAnterior(p: Periodo): Periodo {
  if (p.tipo === 'quincena') {
    if (p.quincena === 2) {
      return construirPeriodoQuincena(p.anio, p.mes, 1)
    }
    const { anio, mes } = mesAnterior(p.anio, p.mes)
    return construirPeriodoQuincena(anio, mes, 2)
  }

  const { anio, mes } = mesAnterior(p.anio, p.mes)
  return construirPeriodoMes(anio, mes)
}

/** Simétrico de `periodoAnterior`. Útil para el selector y para proyecciones. */
export function periodoSiguiente(p: Periodo): Periodo {
  if (p.tipo === 'quincena') {
    if (p.quincena === 1) {
      return construirPeriodoQuincena(p.anio, p.mes, 2)
    }
    const { anio, mes } = mesSiguiente(p.anio, p.mes)
    return construirPeriodoQuincena(anio, mes, 1)
  }

  const { anio, mes } = mesSiguiente(p.anio, p.mes)
  return construirPeriodoMes(anio, mes)
}

interface AnioMes {
  anio: number
  mes: number
}

function mesAnterior(anio: number, mes: number): AnioMes {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }
}

function mesSiguiente(anio: number, mes: number): AnioMes {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
}

// ── Consultas ───────────────────────────────────────────────────────────

/**
 * Periodo del tipo pedido que contiene una fecha ISO 'YYYY-MM-DD'.
 * Se parsea la cadena a mano, sin `new Date`, por la misma razón de siempre.
 * Devuelve `null` si la cadena no es una fecha ISO válida.
 */
export function periodoDeFecha(iso: string, tipo: TipoPeriodo): Periodo | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!coincidencia) return null

  const anio = Number(coincidencia[1])
  const mes = Number(coincidencia[2])
  const dia = Number(coincidencia[3])
  if (mes < 1 || mes > 12) return null
  if (dia < 1 || dia > ultimoDiaDelMes(anio, mes)) return null

  if (tipo === 'mes') return construirPeriodoMes(anio, mes)
  return construirPeriodoQuincena(anio, mes, dia <= 15 ? 1 : 2)
}

/** Días naturales que cubre el periodo, extremos incluidos. */
export function diasDelPeriodo(p: Periodo): number {
  const ultimo = ultimoDiaDelMes(p.anio, p.mes)
  if (p.tipo === 'mes') return ultimo
  return p.quincena === 1 ? 15 : ultimo - 15
}

/**
 * Orden cronológico para `sort`. Los ids son comparables como texto
 * ('2026-03' < '2026-03-Q1' < '2026-04'), pero comparar por campos es
 * explícito y no depende de la forma del id.
 */
export function compararPeriodos(a: Periodo, b: Periodo): number {
  if (a.anio !== b.anio) return a.anio - b.anio
  if (a.mes !== b.mes) return a.mes - b.mes
  return (a.quincena ?? 0) - (b.quincena ?? 0)
}

/** Igualdad por identidad de periodo, no por referencia de objeto. */
export function mismoPeriodo(a: Periodo, b: Periodo): boolean {
  return a.id === b.id
}

// ── Mes en curso ────────────────────────────────────────────────────────

/** «hasta el 15» o «desde el 16» si el mes está a medias; null si no. */
export function marcaCobertura(p: Periodo): string | null {
  if (p.cobertura === 'q1') return 'hasta el 15'
  if (p.cobertura === 'q2') return 'desde el 16'
  return null
}

/** La etiqueta con su marca: «Septiembre 2026 · hasta el 15». */
export function etiquetaConCobertura(p: Periodo): string {
  const marca = marcaCobertura(p)
  return marca ? `${p.etiqueta} · ${marca}` : p.etiqueta
}
