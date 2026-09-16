/**
 * Lectura de la hoja «Plan de Ventas».
 *
 * Forma de la hoja:
 *
 *        A            B                    C            D          …
 *   1  Claves         ·                 2026-04-01   2026-05-01
 *   2    ·           UDS
 *   3  Ventas_ARCO   Setup (Ventas ARCO)     0            0
 *   …
 *
 * Columna A = clave, columna B = etiqueta legible, columnas C en adelante =
 * un mes cada una. 33 meses, de abril de 2026 a diciembre de 2028.
 *
 * ── Fechas ───────────────────────────────────────────────────────────────
 * Las cabeceras se leen como SERIAL de Excel, no como Date. `cellDates: true`
 * devolvería objetos Date construidos en la zona local, y como todas estas
 * fechas son el día 1 del mes, un desfase de −5 h (Miami) las movería al
 * último día del mes anterior: el plan entero se atribuiría con un mes de
 * error, sin romper nada. Es exactamente el fallo contra el que avisa
 * `lib/periodos.ts`, así que aquí la conversión es aritmética y en UTC.
 */

import * as XLSX from 'xlsx'

import type { Indicador, Meta, Periodo, TasaDelPlan } from '@/lib/tipos'
import { construirPeriodoMes } from '@/lib/periodos'
import { CATALOGO, type EntradaCatalogo } from '@/lib/plan/catalogo'
import { construirTasas } from '@/lib/plan/tasas'
import { valoresDeNombres } from '@/lib/plan/variables'

const HOJA = 'Plan de Ventas'
/** Las hipótesis del plan (tasas de conversión), leídas por nombre definido. */
const HOJA_VARIABLES = 'Variables'

/** Primera fila con datos: la 1 es la cabecera y la 2 dice «UDS». */
const PRIMERA_FILA_DATOS = 2

/** Columnas de identificación antes de que empiecen los meses. */
const COL_CLAVE = 0
const COL_ETIQUETA = 1
const PRIMERA_COL_MES = 2

export interface PlanLeido {
  /** Meses del plan, en orden cronológico ascendente. */
  periodos: Periodo[]
  /** Una meta por cada par (periodo, indicador) con cifra en la hoja. */
  metas: Meta[]
  /** Solo los indicadores que de verdad aparecieron en la hoja. */
  indicadores: Indicador[]
  /** Las tasas del plan, de la hoja «Variables». */
  tasas: TasaDelPlan[]
  /**
   * Filas del catálogo que no se encontraron. No es un error fatal —el
   * tablero sigue funcionando— pero tiene que verse: significa que alguien
   * renombró algo en el Excel y hay una tarjeta que ya no se llenará nunca.
   */
  incidencias: string[]
}

/**
 * Serial de Excel → año y mes, sin pasar por la zona horaria local.
 * 25569 son los días entre 1899-12-30 (época de Excel) y 1970-01-01.
 */
function anioMesDeSerial(serial: number): { anio: number; mes: number } | null {
  if (!Number.isFinite(serial) || serial <= 0) return null
  const fecha = new Date(Math.round((serial - 25569) * 86_400_000))
  if (Number.isNaN(fecha.getTime())) return null
  return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1 }
}

/** Cabecera de columna → mes. Acepta serial, texto ISO o Date ya construido. */
function mesDeCabecera(celda: unknown): { anio: number; mes: number } | null {
  if (celda === null || celda === undefined || celda === '') return null

  if (typeof celda === 'number') return anioMesDeSerial(celda)

  if (celda instanceof Date) {
    // Solo llega aquí si alguien cambia las opciones de lectura. Se usan los
    // captadores UTC por coherencia con el resto del módulo.
    return { anio: celda.getUTCFullYear(), mes: celda.getUTCMonth() + 1 }
  }

  const texto = String(celda).trim()
  const iso = /^(\d{4})-(\d{2})/.exec(texto)
  if (iso) return { anio: Number(iso[1]), mes: Number(iso[2]) }

  return null
}

/** Celda de valor → número, o null. Las cadenas con separadores no se adivinan. */
function numeroDe(celda: unknown): number | null {
  if (celda === null || celda === undefined || celda === '') return null
  if (typeof celda === 'number') return Number.isFinite(celda) ? celda : null
  if (typeof celda === 'boolean') return null
  const n = Number(String(celda).trim().replace(/\s/g, ''))
  return Number.isFinite(n) ? n : null
}

function texto(celda: unknown): string {
  return celda === null || celda === undefined ? '' : String(celda).trim()
}

/**
 * Índices del catálogo. La clave manda; la etiqueta solo resuelve las cuatro
 * filas calculadas que el Excel dejó sin clave (ingreso total, las dos
 * mensualidades y el total de captación).
 */
function construirIndices(): {
  porClave: Map<string, EntradaCatalogo>
  porEtiqueta: Map<string, EntradaCatalogo>
} {
  const porClave = new Map<string, EntradaCatalogo>()
  const porEtiqueta = new Map<string, EntradaCatalogo>()

  for (const entrada of CATALOGO) {
    if (entrada.clave) porClave.set(entrada.clave, entrada)
    else if (entrada.etiqueta) porEtiqueta.set(entrada.etiqueta, entrada)
  }

  return { porClave, porEtiqueta }
}

export function leerPlan(contenido: ArrayBuffer): PlanLeido {
  const libro = XLSX.read(contenido, {
    type: 'array',
    // Solo se necesitan estas dos hojas: leer las 17 (una con 32 000 filas
    // de facturas) multiplicaría el tiempo y la memoria sin motivo.
    sheets: [HOJA, HOJA_VARIABLES],
    // Fechas como serial: ver la nota de cabecera.
    cellDates: false,
    // Las fórmulas no interesan, sí sus resultados, que es lo que queda en
    // la celda. Saltárselas ahorra bastante trabajo en un libro así.
    cellFormula: false,
    cellStyles: false,
  })

  const hoja = libro.Sheets[HOJA]
  if (!hoja) {
    throw new Error(
      `El libro no tiene la hoja «${HOJA}». Hojas encontradas: ${libro.SheetNames.join(', ')}`,
    )
  }

  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  })

  if (filas.length <= PRIMERA_FILA_DATOS) {
    throw new Error(`La hoja «${HOJA}» no tiene filas de datos.`)
  }

  // ── Meses ─────────────────────────────────────────────────────────────
  const cabecera = filas[0] ?? []
  const periodos: Periodo[] = []
  const columnaDePeriodo: number[] = []

  for (let col = PRIMERA_COL_MES; col < cabecera.length; col++) {
    const mes = mesDeCabecera(cabecera[col])
    if (!mes) continue
    periodos.push(construirPeriodoMes(mes.anio, mes.mes))
    columnaDePeriodo.push(col)
  }

  if (periodos.length === 0) {
    throw new Error(
      `No se reconoció ninguna columna de mes en la cabecera de «${HOJA}». ` +
        `¿Cambió la estructura de la hoja?`,
    )
  }

  // ── Filas ─────────────────────────────────────────────────────────────
  const { porClave, porEtiqueta } = construirIndices()
  const metas: Meta[] = []
  const encontrados = new Map<string, Indicador>()

  for (let f = PRIMERA_FILA_DATOS; f < filas.length; f++) {
    const fila = filas[f] ?? []
    const clave = texto(fila[COL_CLAVE])
    const etiqueta = texto(fila[COL_ETIQUETA])

    const entrada = (clave && porClave.get(clave)) || (etiqueta && porEtiqueta.get(etiqueta))
    if (!entrada) continue

    // Una fila del catálogo aparece una sola vez. Si el Excel la repitiera,
    // gana la primera: sumarlas duplicaría el plan en silencio.
    if (encontrados.has(entrada.indicador.id)) continue
    encontrados.set(entrada.indicador.id, entrada.indicador)

    periodos.forEach((periodo, i) => {
      const valor = numeroDe(fila[columnaDePeriodo[i]])
      // Celda vacía ⇒ no hay meta ⇒ el motor lo tratará como 'sin-dato'.
      // Escribir un 0 aquí afirmaría que el plan pedía cero, que no es lo mismo.
      if (valor === null) return
      metas.push({ periodoId: periodo.id, indicadorId: entrada.indicador.id, valor })
    })
  }

  // ── Incidencias ───────────────────────────────────────────────────────
  const incidencias: string[] = []
  for (const entrada of CATALOGO) {
    if (encontrados.has(entrada.indicador.id) || entrada.opcional) continue
    incidencias.push(entrada.clave ?? entrada.etiqueta ?? entrada.indicador.id)
  }

  // Se conserva el orden del catálogo, que es el orden de lectura del
  // tablero, y no el orden en que aparecen las filas en la hoja.
  const indicadores = CATALOGO.map((e) => e.indicador).filter((i) => encontrados.has(i.id))

  // ── Tasas ─────────────────────────────────────────────────────────────
  // Una tasa perdida no tumba nada: su fila enseña la real sin plan al lado.
  // Solo quedan las que unen dos filas del libro: la cualificación canal a
  // canal no existe en un libro que no reparte Discoveries.
  const construidas = construirTasas(valoresDeNombres(libro))
  const tasas = construidas.tasas.filter((t) => encontrados.has(t.desde) && encontrados.has(t.hacia))
  for (const nombre of construidas.faltan) incidencias.push(`${HOJA_VARIABLES} · ${nombre}`)

  return { periodos, metas, indicadores, tasas, incidencias }
}
