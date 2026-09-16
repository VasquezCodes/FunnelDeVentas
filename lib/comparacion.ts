/**
 * Motor de comparación: plan de negocio contra resultado real.
 *
 * Este módulo es el único lugar donde se decide qué significa «vamos bien».
 * Es puro por diseño: sin efectos, sin fechas del sistema, sin acceso a red.
 * Dadas las mismas entradas devuelve siempre lo mismo, así que se puede
 * ejecutar en el servidor (RSC) y en el cliente sin divergencias.
 *
 * Reglas del dominio que se resuelven aquí y en ningún otro sitio:
 *   · Nunca se divide entre cero. Falta de dato ⇒ null ⇒ estado 'sin-dato'.
 *   · La dirección 'menor-mejor' invierte el juicio, no el dato.
 *   · Los formateadores devuelven '—' ante null. Jamás 'NaN', jamás '0'.
 */

import type {
  Comparativa,
  Conversion,
  Direccion,
  Estado,
  Indicador,
  Meta,
  Real,
  Umbrales,
  Unidad,
} from '@/lib/tipos'
import { UMBRALES_POR_DEFECTO } from '@/lib/tipos'

// ── Constantes tipográficas ─────────────────────────────────────────────

/** Raya (U+2014). Es lo que se pinta cuando no hay dato. */
export const SIN_DATO = '—'

/** Signo menos tipográfico (U+2212). El guion ASCII es más corto y desalinea. */
const SIGNO_MENOS = '−'

/** Espacio duro. En español el símbolo % va separado de la cifra. */
const ESPACIO_DURO = ' '

/**
 * Las palabras de cada estado: una sola voz para el semáforo, las tablas y
 * los lectores de pantalla. El color nunca viaja solo: color + forma + texto.
 * Hablan de plan, no de calidad: «fuera de plan» es un hecho; «crítico»
 * sería un juicio que el dato solo no sostiene.
 */
export const ETIQUETAS_ESTADO: Record<Estado, string> = {
  ok: 'En plan',
  alerta: 'Al límite',
  critico: 'Fuera de plan',
  'sin-dato': 'Sin dato',
}

// ── Utilidades internas ─────────────────────────────────────────────────

/**
 * Entrada admitida para un lado de la comparación: el registro completo
 * (`Meta` / `Real`), el número suelto, o la ausencia del dato.
 * Permite llamar al motor tanto desde `compararTodos` (que trabaja con
 * registros) como desde una prueba o un cálculo suelto (que trabaja con
 * números) sin duplicar la función.
 */
export type ValorEntrada = number | Meta | Real | null | undefined

/** Normaliza cualquier entrada a `number | null`. NaN e Infinity son «sin dato». */
function valorDe(entrada: ValorEntrada): number | null {
  if (entrada === null || entrada === undefined) return null
  const bruto = typeof entrada === 'number' ? entrada : entrada.valor
  return Number.isFinite(bruto) ? bruto : null
}

/** Sustituye el guion ASCII que emite Intl por el signo menos tipográfico. */
function conMenosTipografico(texto: string): string {
  return texto.replace(/-/g, SIGNO_MENOS)
}

// ── Formateadores (memorizados: crear un Intl.NumberFormat es caro) ─────

const FORMATO_CANTIDAD = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 0,
})

const FORMATO_MONEDA = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const FORMATO_DECIMAL_1 = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const FORMATO_ENTERO = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 0,
})

/** Dinero con céntimos, para costes unitarios. */
const FORMATO_COSTE = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Un coste unitario, con céntimos: un coste por lead de $20.41 no es $20. */
export function formatearCoste(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return SIN_DATO
  return conMenosTipografico(FORMATO_COSTE.format(valor))
}

/** Variantes con signo explícito. El cero se queda sin signo: «+0» no informa. */
const FORMATO_CANTIDAD_CON_SIGNO = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
})

const FORMATO_MONEDA_CON_SIGNO = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
})

const FORMATO_DECIMAL_1_CON_SIGNO = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

/**
 * Formatea el valor de un indicador según su unidad.
 *
 *   cantidad    →  '1,240'
 *   moneda      →  '$18,500'   (USD, sin decimales: son cifras de plan)
 *   porcentaje  →  '42.0 %'
 *
 * Convención de la unidad 'porcentaje': el valor viaja en puntos
 * porcentuales (42 significa 42 %), no como fracción. Los ratios
 * calculados por el motor (cumplimiento, conversión) sí viajan como
 * fracción 0–1 y tienen sus propios formateadores más abajo.
 */
export function formatearValor(valor: number | null | undefined, unidad: Unidad): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return SIN_DATO

  switch (unidad) {
    case 'moneda':
      return conMenosTipografico(FORMATO_MONEDA.format(valor))
    case 'porcentaje':
      return conMenosTipografico(FORMATO_DECIMAL_1.format(valor)) + ESPACIO_DURO + '%'
    case 'cantidad':
    default:
      return conMenosTipografico(FORMATO_CANTIDAD.format(valor))
  }
}

/**
 * Formatea el cumplimiento (fracción real/meta) como porcentaje entero:
 * 0.78 → '78 %', 1.12 → '112 %'. Sin decimales a propósito: la precisión
 * decimal en un semáforo es ruido, y así no se confunde con un indicador
 * cuya unidad ya es 'porcentaje'.
 */
export function formatearCumplimiento(c: number | null): string {
  if (c === null || !Number.isFinite(c)) return SIN_DATO
  return conMenosTipografico(FORMATO_ENTERO.format(c * 100)) + ESPACIO_DURO + '%'
}

/**
 * Formatea la desviación (real − meta) con signo explícito.
 * El signo es la información principal: '+320', '−$4,000', '−2.5 %'.
 * El cero se muestra sin signo, porque «+0» sugiere una mejora que no existe.
 */
export function formatearDesviacion(d: number | null, unidad: Unidad): string {
  if (d === null || !Number.isFinite(d)) return SIN_DATO

  switch (unidad) {
    case 'moneda':
      return conMenosTipografico(FORMATO_MONEDA_CON_SIGNO.format(d))
    case 'porcentaje':
      return conMenosTipografico(FORMATO_DECIMAL_1_CON_SIGNO.format(d)) + ESPACIO_DURO + '%'
    case 'cantidad':
    default:
      return conMenosTipografico(FORMATO_CANTIDAD_CON_SIGNO.format(d))
  }
}

/**
 * Formatea una tasa de conversión (fracción 0–1) con un decimal: 0.342 → '34.2 %'.
 * Aquí sí hace falta el decimal: entre 34 % y 34.8 % hay dinero de por medio.
 */
export function formatearTasaConversion(tasa: number | null): string {
  if (tasa === null || !Number.isFinite(tasa)) return SIN_DATO
  return conMenosTipografico(FORMATO_DECIMAL_1.format(tasa * 100)) + ESPACIO_DURO + '%'
}

// ── Semáforo ────────────────────────────────────────────────────────────

/**
 * Traduce un cumplimiento a estado, respetando la dirección del indicador.
 *
 * EL PUNTO DELICADO DE TODO EL MÓDULO. `cumplimiento` es siempre el ratio
 * crudo real/meta; nunca se toca el dato. Lo que se invierte es el juicio.
 *
 * Para 'menor-mejor' se refleja el ratio alrededor de 1:
 *
 *     cumplimientoEfectivo = 2 − (real / meta)
 *
 * Con meta 100:
 *     real  80  → ratio 0.80 → efectivo 1.20  → 'ok'      (gastamos menos: bien)
 *     real 100  → ratio 1.00 → efectivo 1.00  → 'ok'      (justo en plan)
 *     real 120  → ratio 1.20 → efectivo 0.80  → 'alerta'  (nos pasamos un 20 %)
 *     real 150  → ratio 1.50 → efectivo 0.50  → 'critico'
 *     real   0  → ratio 0.00 → efectivo 2.00  → 'ok'      (coste cero: perfecto)
 *
 * Se usa la reflexión y no el inverso (meta/real) por dos motivos:
 *   1. Es simétrica: desviarse un 20 % hacia el lado malo da 0.80 tanto en
 *      'mayor-mejor' como en 'menor-mejor'. Con meta/real daría 0.83 y los
 *      mismos umbrales significarían cosas distintas según la dirección.
 *   2. No introduce una segunda división —y por tanto un segundo riesgo de
 *      dividir entre cero— cuando el real es 0, que es un caso perfectamente
 *      normal en un indicador 'menor-mejor'.
 */
export function calcularEstado(
  cumplimiento: number | null,
  direccion: Direccion,
  umbrales: Umbrales = UMBRALES_POR_DEFECTO,
): Estado {
  if (cumplimiento === null || !Number.isFinite(cumplimiento)) return 'sin-dato'

  const efectivo = direccion === 'menor-mejor' ? 2 - cumplimiento : cumplimiento

  if (efectivo >= umbrales.ok) return 'ok'
  if (efectivo >= umbrales.alerta) return 'alerta'
  return 'critico'
}

// ── Comparación ─────────────────────────────────────────────────────────

/**
 * Compara la meta y el real de un indicador.
 *
 *   desviacion   = real − meta  (negativo = por debajo del plan, sea o no bueno)
 *   cumplimiento = real / meta  (null si falta un lado o si la meta es 0)
 *
 * Meta 0 ⇒ cumplimiento null ⇒ 'sin-dato'. No hay ratio honesto contra cero:
 * cualquier real sería «infinitamente» superior al plan. La desviación sí se
 * calcula, porque real − 0 sigue siendo información legítima.
 */
export function compararIndicador(
  indicador: Indicador,
  meta: ValorEntrada,
  real: ValorEntrada,
  umbrales: Umbrales = UMBRALES_POR_DEFECTO,
): Comparativa {
  const valorMeta = valorDe(meta)
  const valorReal = valorDe(real)

  const hayAmbos = valorMeta !== null && valorReal !== null

  const desviacion = hayAmbos ? valorReal - valorMeta : null

  // La guarda `valorMeta !== 0` es la que impide la división entre cero.
  const cumplimiento = hayAmbos && valorMeta !== 0 ? valorReal / valorMeta : null

  return {
    indicador,
    meta: valorMeta,
    real: valorReal,
    desviacion,
    cumplimiento,
    estado: calcularEstado(cumplimiento, indicador.direccion, umbrales),
  }
}

/**
 * Compara una lista de indicadores contra sus metas y reales.
 *
 * Conserva el orden de `indicadores`: es el orden con el que se pinta el
 * tablero, y no debe depender de cómo lleguen los datos. Un indicador sin
 * meta o sin real aparece igualmente, en estado 'sin-dato'; ocultarlo sería
 * esconder justo el problema (nadie capturó ese dato).
 *
 * Si llegan registros duplicados para el mismo indicador, gana el último.
 */
export function compararTodos(
  indicadores: readonly Indicador[],
  metas: readonly Meta[],
  reales: readonly Real[],
  umbrales: Umbrales = UMBRALES_POR_DEFECTO,
): Comparativa[] {
  const porIndicadorMeta = new Map<string, Meta>()
  for (const m of metas) porIndicadorMeta.set(m.indicadorId, m)

  const porIndicadorReal = new Map<string, Real>()
  for (const r of reales) porIndicadorReal.set(r.indicadorId, r)

  return indicadores.map((indicador) =>
    compararIndicador(
      indicador,
      porIndicadorMeta.get(indicador.id),
      porIndicadorReal.get(indicador.id),
      umbrales,
    ),
  )
}

// ── Embudo ──────────────────────────────────────────────────────────────

/**
 * Calcula las conversiones entre etapas consecutivas del embudo.
 *
 * Toma solo las comparativas cuyo indicador tiene `etapa` (las demás no
 * forman parte del embudo), las ordena por etapa ascendente —1 es la boca—
 * y calcula, para cada par consecutivo:
 *
 *     tasaPlan = meta[i+1] / meta[i]
 *     tasaReal = real[i+1] / real[i]
 *
 * La tasa es null si falta cualquiera de los dos valores o si el
 * denominador es 0 (no hubo nada que convertir: no existe una tasa, y
 * fingir un 0 % sería mentir). Las etapas se emparejan tal como llegan,
 * sin exigir que los números sean consecutivos: si el embudo tiene las
 * etapas 1, 2 y 5, se calculan las conversiones 1→2 y 2→5.
 */
export function calcularConversiones(comparativas: readonly Comparativa[]): Conversion[] {
  const etapas = comparativas
    .filter((c): c is Comparativa & { indicador: Indicador & { etapa: number } } =>
      c.indicador.etapa !== null,
    )
    .slice()
    .sort((a, b) => a.indicador.etapa - b.indicador.etapa)

  const conversiones: Conversion[] = []

  for (let i = 0; i < etapas.length - 1; i++) {
    const desde = etapas[i]
    const hacia = etapas[i + 1]

    conversiones.push({
      desde: desde.indicador,
      hacia: hacia.indicador,
      tasaPlan: dividirSeguro(hacia.meta, desde.meta),
      tasaReal: dividirSeguro(hacia.real, desde.real),
    })
  }

  return conversiones
}

/** División que devuelve null en vez de Infinity, NaN o dato ausente. */
function dividirSeguro(numerador: number | null, denominador: number | null): number | null {
  if (numerador === null || denominador === null || denominador === 0) return null
  const resultado = numerador / denominador
  return Number.isFinite(resultado) ? resultado : null
}

// ── Agregados de apoyo ──────────────────────────────────────────────────

/**
 * Cuenta cuántos indicadores hay en cada estado. Para el resumen de cabecera
 * («3 en plan · 1 al límite · 1 fuera de plan»), que debe leerse sin scroll.
 */
export function resumirEstados(comparativas: readonly Comparativa[]): Record<Estado, number> {
  const resumen: Record<Estado, number> = { ok: 0, alerta: 0, critico: 0, 'sin-dato': 0 }
  for (const c of comparativas) resumen[c.estado] += 1
  return resumen
}

/**
 * ¿La desviación juega a favor? Sirve para decidir el signo visual de un
 * delta sin volver a razonar sobre la dirección en cada componente.
 * Desviación 0 (o sin dato) no es favorable ni desfavorable: devuelve null.
 */
export function esDesviacionFavorable(
  desviacion: number | null,
  direccion: Direccion,
): boolean | null {
  if (desviacion === null || !Number.isFinite(desviacion) || desviacion === 0) return null
  return direccion === 'menor-mejor' ? desviacion < 0 : desviacion > 0
}
