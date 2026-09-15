/**
 * Datos de ejemplo del tablero «Plan de Negocio vs. Resultado Real».
 *
 * Reproducen el funnel comercial de Bastida & Farina tal y como se mide hoy
 * en HighLevel: cinco etapas de embudo más dos indicadores de negocio
 * (ingreso cerrado y coste por lead).
 *
 * La historia que cuentan los números, de abril a septiembre de 2026:
 *   · Abril y mayo cierran por encima del plan.
 *   · En junio el coste por lead es el primer aviso: sube mientras el volumen
 *     todavía aguanta.
 *   · De julio a septiembre la BOCA del embudo se desploma (leads muy por
 *     debajo del plan) pero las conversiones de abajo no solo aguantan, sino
 *     que mejoran: en septiembre se cierra el 30 % de las propuestas, el mejor
 *     dato de la serie. El problema está arriba (medios), no en el equipo
 *     comercial.
 *
 * Todos los valores están cuadrados: cada etapa es siempre menor que la
 * anterior, y las dos quincenas de agosto y septiembre suman exactamente el
 * mes correspondiente (el coste por lead, por ser un ratio, se pondera por
 * leads en lugar de sumarse).
 */

import type { Indicador, Meta, Periodo, Real } from '@/lib/tipos'

// ── Indicadores ─────────────────────────────────────────────────────────

export const INDICADORES: Indicador[] = [
  {
    id: 'leads-generados',
    nombre: 'Leads generados',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    etapa: 1,
    definicion:
      'Contactos nuevos creados en HighLevel durante el periodo a partir de campañas propias, descontando duplicados y bajas inmediatas.',
  },
  {
    id: 'llamadas-agendadas',
    nombre: 'Llamadas agendadas',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    etapa: 2,
    definicion:
      'Citas creadas en el calendario de HighLevel durante el periodo, se celebren o no dentro de él.',
  },
  {
    id: 'llamadas-realizadas',
    nombre: 'Llamadas realizadas',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    etapa: 3,
    definicion:
      'Citas marcadas como celebradas en HighLevel; no cuentan las canceladas ni los no-show.',
  },
  {
    id: 'propuestas-enviadas',
    nombre: 'Propuestas enviadas',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    etapa: 4,
    definicion:
      'Oportunidades que entran en la etapa «Propuesta enviada» del pipeline, contadas una sola vez por cuenta.',
  },
  {
    id: 'cierres',
    nombre: 'Cierres',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    etapa: 5,
    definicion:
      'Oportunidades marcadas como ganadas en el pipeline, con contrato firmado dentro del periodo.',
  },
  {
    id: 'ingreso-cerrado',
    nombre: 'Ingreso cerrado',
    unidad: 'moneda',
    direccion: 'mayor-mejor',
    etapa: null,
    definicion:
      'Suma del valor contratado de las oportunidades ganadas en el periodo, sin impuestos: cuota de alta más los doce primeros meses de retainer.',
  },
  {
    id: 'coste-por-lead',
    nombre: 'Coste por lead',
    unidad: 'moneda',
    direccion: 'menor-mejor',
    etapa: null,
    definicion:
      'Inversión total en medios del periodo dividida entre los leads generados. Cuanto más bajo, mejor.',
  },
]

// ── Construcción de periodos ────────────────────────────────────────────
// Cuando exista `lib/periodos.ts`, estas dos funciones se sustituyen por las
// suyas sin tocar el resto del archivo: la forma del objeto `Periodo` es la
// misma.

const MESES_LARGOS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

const MESES_CORTOS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const

/** Dos dígitos con cero delante: 4 → '04'. */
function dosDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

/** Último día del mes (mes en base 1). */
function ultimoDia(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

function periodoMes(anio: number, mes: number): Periodo {
  const mm = dosDigitos(mes)
  return {
    id: `${anio}-${mm}`,
    tipo: 'mes',
    anio,
    mes,
    inicio: `${anio}-${mm}-01`,
    fin: `${anio}-${mm}-${dosDigitos(ultimoDia(anio, mes))}`,
    etiqueta: `${MESES_LARGOS[mes - 1]} ${anio}`,
    etiquetaCorta: `${MESES_CORTOS[mes - 1]} ${anio}`,
  }
}

function periodoQuincena(anio: number, mes: number, quincena: 1 | 2): Periodo {
  const mm = dosDigitos(mes)
  const diaInicio = quincena === 1 ? 1 : 16
  const diaFin = quincena === 1 ? 15 : ultimoDia(anio, mes)
  return {
    id: `${anio}-${mm}-Q${quincena}`,
    tipo: 'quincena',
    anio,
    mes,
    quincena,
    inicio: `${anio}-${mm}-${dosDigitos(diaInicio)}`,
    fin: `${anio}-${mm}-${dosDigitos(diaFin)}`,
    etiqueta: `${diaInicio}–${diaFin} ${MESES_CORTOS[mes - 1]} ${anio}`,
    etiquetaCorta: `${quincena}ª quinc. ${MESES_CORTOS[mes - 1]}`,
  }
}

// ── Periodos ────────────────────────────────────────────────────────────
// Seis meses consecutivos (abril–septiembre de 2026) más las dos quincenas de
// los dos últimos meses. Orden: del más reciente al más antiguo, que es el que
// espera `FuenteDatos.periodos()`.

export const PERIODOS_MOCK: Periodo[] = [
  periodoMes(2026, 9),
  periodoQuincena(2026, 9, 2),
  periodoQuincena(2026, 9, 1),
  periodoMes(2026, 8),
  periodoQuincena(2026, 8, 2),
  periodoQuincena(2026, 8, 1),
  periodoMes(2026, 7),
  periodoMes(2026, 6),
  periodoMes(2026, 5),
  periodoMes(2026, 4),
]

// ── Tablas de valores ───────────────────────────────────────────────────

/** Un valor por indicador. Las claves son los `id` de INDICADORES. */
interface Valores {
  'leads-generados': number
  'llamadas-agendadas': number
  'llamadas-realizadas': number
  'propuestas-enviadas': number
  cierres: number
  'ingreso-cerrado': number
  'coste-por-lead': number
}

/**
 * El plan de negocio: crecimiento sostenido mes a mes, con un coste por lead
 * que el plan asume decreciente (economías de escala en medios).
 * Conversiones planificadas: leads→agendadas 45 %, realizadas→propuestas 30 %,
 * propuestas→cierres 25 %.
 */
const PLAN: Record<string, Valores> = {
  '2026-04': {
    'leads-generados': 320,
    'llamadas-agendadas': 144,
    'llamadas-realizadas': 112,
    'propuestas-enviadas': 34,
    cierres: 9,
    'ingreso-cerrado': 68_000,
    'coste-por-lead': 38,
  },
  '2026-05': {
    'leads-generados': 340,
    'llamadas-agendadas': 153,
    'llamadas-realizadas': 119,
    'propuestas-enviadas': 36,
    cierres: 9,
    'ingreso-cerrado': 70_000,
    'coste-por-lead': 37,
  },
  '2026-06': {
    'leads-generados': 360,
    'llamadas-agendadas': 162,
    'llamadas-realizadas': 126,
    'propuestas-enviadas': 38,
    cierres: 10,
    'ingreso-cerrado': 74_000,
    'coste-por-lead': 36,
  },
  '2026-07': {
    'leads-generados': 380,
    'llamadas-agendadas': 171,
    'llamadas-realizadas': 133,
    'propuestas-enviadas': 40,
    cierres: 10,
    'ingreso-cerrado': 78_000,
    'coste-por-lead': 35,
  },
  '2026-08': {
    'leads-generados': 400,
    'llamadas-agendadas': 180,
    'llamadas-realizadas': 140,
    'propuestas-enviadas': 42,
    cierres: 11,
    'ingreso-cerrado': 82_000,
    'coste-por-lead': 34,
  },
  '2026-08-Q1': {
    'leads-generados': 200,
    'llamadas-agendadas': 90,
    'llamadas-realizadas': 70,
    'propuestas-enviadas': 21,
    cierres: 5,
    'ingreso-cerrado': 40_000,
    'coste-por-lead': 34,
  },
  '2026-08-Q2': {
    'leads-generados': 200,
    'llamadas-agendadas': 90,
    'llamadas-realizadas': 70,
    'propuestas-enviadas': 21,
    cierres: 6,
    'ingreso-cerrado': 42_000,
    'coste-por-lead': 34,
  },
  '2026-09': {
    'leads-generados': 420,
    'llamadas-agendadas': 189,
    'llamadas-realizadas': 147,
    'propuestas-enviadas': 44,
    cierres: 11,
    'ingreso-cerrado': 86_000,
    'coste-por-lead': 33,
  },
  '2026-09-Q1': {
    'leads-generados': 210,
    'llamadas-agendadas': 94,
    'llamadas-realizadas': 73,
    'propuestas-enviadas': 22,
    cierres: 5,
    'ingreso-cerrado': 42_000,
    'coste-por-lead': 33,
  },
  '2026-09-Q2': {
    'leads-generados': 210,
    'llamadas-agendadas': 95,
    'llamadas-realizadas': 74,
    'propuestas-enviadas': 22,
    cierres: 6,
    'ingreso-cerrado': 44_000,
    'coste-por-lead': 33,
  },
}

/**
 * El resultado real.
 *
 * Cumplimiento (real / meta) mes a mes, para que el semáforo cuente algo:
 *   abr  todo verde   ·  may  todo verde
 *   jun  verde, salvo el coste por lead, que ya se va a ámbar (0,93)
 *   jul  ámbar arriba del embudo, verde abajo
 *   ago  leads en rojo (0,80) y coste por lead en rojo (0,71)
 *   sep  leads 0,69 y coste por lead 0,60 en ROJO,
 *        propuestas 0,82 e ingreso 0,92 en ÁMBAR,
 *        cierres 11/11 = 1,00 en VERDE.
 *
 * Es decir: se cierra todo lo que el plan pedía sobre la mitad de materia
 * prima, a costa de un ticket medio algo menor.
 */
const REAL: Record<string, Valores> = {
  '2026-04': {
    'leads-generados': 331,
    'llamadas-agendadas': 151,
    'llamadas-realizadas': 118,
    'propuestas-enviadas': 36,
    cierres: 10,
    'ingreso-cerrado': 71_200,
    'coste-por-lead': 36.4,
  },
  '2026-05': {
    'leads-generados': 348,
    'llamadas-agendadas': 158,
    'llamadas-realizadas': 124,
    'propuestas-enviadas': 38,
    cierres: 10,
    'ingreso-cerrado': 72_800,
    'coste-por-lead': 36.1,
  },
  '2026-06': {
    'leads-generados': 351,
    'llamadas-agendadas': 158,
    'llamadas-realizadas': 123,
    'propuestas-enviadas': 37,
    cierres: 10,
    'ingreso-cerrado': 73_100,
    'coste-por-lead': 38.9,
  },
  '2026-07': {
    'leads-generados': 342,
    'llamadas-agendadas': 156,
    'llamadas-realizadas': 124,
    'propuestas-enviadas': 39,
    cierres: 10,
    'ingreso-cerrado': 76_400,
    'coste-por-lead': 42.2,
  },
  '2026-08': {
    'leads-generados': 318,
    'llamadas-agendadas': 148,
    'llamadas-realizadas': 119,
    'propuestas-enviadas': 38,
    cierres: 10,
    'ingreso-cerrado': 75_800,
    'coste-por-lead': 47.81,
  },
  '2026-08-Q1': {
    'leads-generados': 172,
    'llamadas-agendadas': 80,
    'llamadas-realizadas': 64,
    'propuestas-enviadas': 21,
    cierres: 6,
    'ingreso-cerrado': 41_300,
    'coste-por-lead': 44.5,
  },
  '2026-08-Q2': {
    'leads-generados': 146,
    'llamadas-agendadas': 68,
    'llamadas-realizadas': 55,
    'propuestas-enviadas': 17,
    cierres: 4,
    'ingreso-cerrado': 34_500,
    'coste-por-lead': 51.7,
  },
  '2026-09': {
    'leads-generados': 289,
    'llamadas-agendadas': 137,
    'llamadas-realizadas': 111,
    'propuestas-enviadas': 36,
    cierres: 11,
    'ingreso-cerrado': 79_500,
    'coste-por-lead': 54.61,
  },
  '2026-09-Q1': {
    'leads-generados': 152,
    'llamadas-agendadas': 73,
    'llamadas-realizadas': 59,
    'propuestas-enviadas': 19,
    cierres: 6,
    'ingreso-cerrado': 43_200,
    'coste-por-lead': 52.1,
  },
  '2026-09-Q2': {
    'leads-generados': 137,
    'llamadas-agendadas': 64,
    'llamadas-realizadas': 52,
    'propuestas-enviadas': 17,
    cierres: 5,
    'ingreso-cerrado': 36_300,
    'coste-por-lead': 57.4,
  },
}

/** Quién y cuándo cerró la captura de cada periodo (zona horaria de Miami). */
const CAPTURA: Record<string, { capturadoPor: string; capturadoEn: string }> = {
  '2026-04': { capturadoPor: 'Lucía Farina', capturadoEn: '2026-05-04T09:20:00-04:00' },
  '2026-05': { capturadoPor: 'Lucía Farina', capturadoEn: '2026-06-03T10:05:00-04:00' },
  '2026-06': { capturadoPor: 'Lucía Farina', capturadoEn: '2026-07-02T09:48:00-04:00' },
  '2026-07': { capturadoPor: 'Diego Bastida', capturadoEn: '2026-08-04T11:30:00-04:00' },
  '2026-08': { capturadoPor: 'Diego Bastida', capturadoEn: '2026-09-02T09:15:00-04:00' },
  '2026-08-Q1': { capturadoPor: 'Diego Bastida', capturadoEn: '2026-08-17T09:40:00-04:00' },
  '2026-08-Q2': { capturadoPor: 'Diego Bastida', capturadoEn: '2026-09-02T09:15:00-04:00' },
  '2026-09': { capturadoPor: 'Lucía Farina', capturadoEn: '2026-10-01T10:00:00-04:00' },
  '2026-09-Q1': { capturadoPor: 'Lucía Farina', capturadoEn: '2026-09-16T09:35:00-04:00' },
  '2026-09-Q2': { capturadoPor: 'Lucía Farina', capturadoEn: '2026-10-01T10:00:00-04:00' },
}

// ── Aplanado a registros ────────────────────────────────────────────────
// Se recorre PERIODOS_MOCK (y no las tablas) para que el orden de los
// registros siga siempre al de los periodos.

function valoresDe(tabla: Record<string, Valores>, periodoId: string): Valores | undefined {
  return tabla[periodoId]
}

export const METAS: Meta[] = PERIODOS_MOCK.flatMap((periodo) => {
  const valores = valoresDe(PLAN, periodo.id)
  if (!valores) return []
  return Object.entries(valores).map(([indicadorId, valor]) => ({
    periodoId: periodo.id,
    indicadorId,
    valor,
  }))
})

export const REALES: Real[] = PERIODOS_MOCK.flatMap((periodo) => {
  const valores = valoresDe(REAL, periodo.id)
  if (!valores) return []
  const captura = CAPTURA[periodo.id]
  return Object.entries(valores).map(([indicadorId, valor]) => ({
    periodoId: periodo.id,
    indicadorId,
    valor,
    // Hoy todo entra a mano desde el informe de HighLevel. En la fase 2 este
    // campo pasará a 'crm' sin que cambie nada más.
    origen: 'manual' as const,
    capturadoPor: captura?.capturadoPor,
    capturadoEn: captura?.capturadoEn,
  }))
})
