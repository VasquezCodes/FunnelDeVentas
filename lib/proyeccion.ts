/**
 * La proyección del mes que todavía no tiene resultado.
 *
 * ── Qué se proyecta y con qué ────────────────────────────────────────────
 * El plan de ese mes, multiplicado por el ritmo al que se viene cumpliendo:
 * la media de `real / plan` de los últimos meses CERRADOS.
 *
 *     proyección = plan(mes) × media(real/plan de los 3 meses cerrados)
 *
 * Se eligió así frente a prolongar una recta sobre los últimos reales, y la
 * razón es el negocio: el plan ya lleva dentro la estacionalidad. Agosto cae
 * a un tercio y septiembre remonta porque el plan lo dice. Una tendencia
 * ciega, viniendo del bajón de agosto, proyectaría un septiembre hundido —y
 * en este libro llegaría a proyectar cero—, que es exactamente lo contrario
 * de lo que va a pasar. Apoyarse en el plan hereda su forma; lo único que
 * aporta el real es cuánto de ese plan se está consiguiendo de verdad.
 *
 * El precio hay que decirlo: si el plan de un mes está mal puesto, la
 * proyección hereda el error. Es un tablero de plan contra real, y la
 * pregunta que contesta es «si sigo rindiendo así, ¿dónde cierro?», no
 * «¿cuánto voy a vender?».
 *
 * ── Qué NO hace ──────────────────────────────────────────────────────────
 * No proyecta sin meses cerrados con los que medir el ritmo, ni sin plan
 * para el mes que vendría: devuelve null y el gráfico no dibuja nada. Una
 * proyección inventada sobre un mes en blanco sería una cifra sin respaldo
 * puesta donde todo el mundo mira.
 *
 * Pura y sin fechas del sistema: los mismos puntos, la misma proyección.
 */

/** Un periodo de la serie, con sus dos lados. */
export interface PuntoPlanReal {
  plan: number | null
  real: number | null
}

/** Un mes proyectado. */
export interface Proyectado {
  /** Posición del periodo dentro de la serie recibida. */
  indice: number
  valor: number
}

export interface Proyeccion {
  /** Los meses proyectados, en orden. Nunca vacío. */
  puntos: Proyectado[]
  /** El ritmo con que se proyectó. 0,93 = se viene cumpliendo el 93 % del plan. */
  ritmo: number
  /** Cuántos meses cerrados entraron en la media. */
  mesesDeRitmo: number
}

/** Meses cerrados que entran en el ritmo. Tres: un trimestre, y aguanta un mes raro. */
export const MESES_DE_RITMO = 3

/**
 * Cuánto pesa cada mes en el ritmo, del más reciente al más antiguo. El
 * último mes dice más de cómo va el equipo que el de hace tres: si el ritmo
 * está cambiando, una media plana llega tarde.
 */
export const PESOS_POR_ANTIGUEDAD: readonly number[] = [3, 2, 1]

export interface OpcionesProyeccion {
  /**
   * Posición del mes a medias, si lo hay.
   *
   * ENTRA en el ritmo, y es a propósito. Hubo una versión que lo dejaba
   * fuera suponiendo que su plan era el del mes entero —media quincena
   * contra un mes completo hundiría la media—. El supuesto era falso: el
   * tablero le da al mes a medias el plan de lo que ya pasó
   * (`metasDelMes`), así que «219 de 222» compara quincena con quincena. Y
   * es el dato más fresco que hay: descartarlo era proyectar con lo de hace
   * un mes teniendo lo de hace quince días.
   *
   * Se conserva para poder evaluar la versión anterior (`conMesEnCurso`).
   */
  enCurso?: number
  /** Si es false, el mes a medias no entra en el ritmo. Por defecto, true. */
  conMesEnCurso?: boolean
  mesesDeRitmo?: number
  /** Ver `PESOS_POR_ANTIGUEDAD`. `[1, 1, 1]` es una media plana. */
  pesos?: readonly number[]
  /**
   * Cómo se resume el ritmo de varios meses:
   *
   *   · 'agregado' (por defecto): lo real de todos entre lo planeado de
   *     todos, con sus pesos. Un mes grande pesa más que uno pequeño.
   *   · 'media': la media de los cumplimientos de cada mes.
   *
   * Parecen lo mismo y no lo son cuando el plan es pequeño. Con ventas —dos,
   * tres, cinco al mes— un mes de plan 2 con 5 ventas es un 250 %, y en una
   * media vale lo mismo que un mes de plan 100: un solo mes pequeño con
   * suerte dispara la proyección. En el agregado, ese mes aporta 5 de 190 y
   * pesa lo que pesa.
   */
  ritmo?: 'agregado' | 'media'
  /**
   * Cuántos meses seguidos se proyectan. Dos, y no uno, por una razón de
   * dibujo que se paga en el sitio correcto: el tramo punteado arranca en el
   * último real, y con un solo mes proyectado serían dos puntos, que es una
   * recta —entre dos puntos no hay curva posible—. Con dos meses son tres
   * puntos y la curva sale sola, sin arrastrar puntos que la línea sólida ya
   * dibuja, que es lo que dejaba una sombra punteada bajo el área.
   *
   * No se inventa nada de más: cada mes proyectado sale de su propio plan
   * por el mismo ritmo, igual que el primero.
   */
  meses?: number
}

/** Meses que se proyectan por delante. Ver `OpcionesProyeccion.meses`. */
export const MESES_PROYECTADOS = 2

export function proyectar(
  puntos: readonly PuntoPlanReal[],
  {
    enCurso = -1,
    conMesEnCurso = true,
    mesesDeRitmo = MESES_DE_RITMO,
    meses = MESES_PROYECTADOS,
    pesos = PESOS_POR_ANTIGUEDAD,
    ritmo: forma = 'agregado',
  }: OpcionesProyeccion = {},
): Proyeccion | null {
  // El periodo desde el que se proyecta: el último con resultado.
  let ultimo = -1
  for (let i = 0; i < puntos.length; i++) {
    if (puntos[i].real !== null) ultimo = i
  }
  if (ultimo < 0) return null

  // Los meses que entran en el ritmo, del más reciente al más antiguo.
  const muestras: Array<{ plan: number; real: number }> = []
  for (let i = ultimo; i >= 0 && muestras.length < mesesDeRitmo; i--) {
    if (!conMesEnCurso && i === enCurso) continue
    const { plan, real } = puntos[i]
    if (real === null || plan === null || plan <= 0) continue
    muestras.push({ plan, real })
  }
  if (muestras.length === 0) return null

  // El peso de cada mes por su antigüedad; si hay más meses que pesos, los
  // de más atrás se quedan con el último.
  const peso = (k: number) => pesos[Math.min(k, pesos.length - 1)] ?? 1

  let ritmo: number
  if (forma === 'media') {
    const total = muestras.reduce((s, _, k) => s + peso(k), 0)
    ritmo = muestras.reduce((s, m, k) => s + peso(k) * (m.real / m.plan), 0) / total
  } else {
    const real = muestras.reduce((s, m, k) => s + peso(k) * m.real, 0)
    const plan = muestras.reduce((s, m, k) => s + peso(k) * m.plan, 0)
    ritmo = real / plan
  }
  const cumplimientos = muestras

  // Los meses que vienen, mientras sigan vacíos y con plan que escalar. Se
  // para en el primero que no cumpla: un hueco en medio partiría el trazo.
  const proyectados: Proyectado[] = []
  for (let i = ultimo + 1; i < puntos.length && proyectados.length < meses; i++) {
    const destino = puntos[i]
    // Con resultado ya, sin plan, o con el plan a cero (multiplicarlo daría
    // cero siempre): ahí se acaba la proyección.
    if (destino.real !== null || destino.plan === null || destino.plan <= 0) break
    proyectados.push({ indice: i, valor: destino.plan * ritmo })
  }
  if (proyectados.length === 0) return null

  return { puntos: proyectados, ritmo, mesesDeRitmo: cumplimientos.length }
}
