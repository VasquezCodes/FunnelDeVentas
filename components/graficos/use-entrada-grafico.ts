'use client'

/**
 * Entrada «dibujada» de un gráfico: cuándo se reproduce, no cómo.
 *
 * Cada gráfico aporta su propia timeline (`construir`): el Embudo traza su
 * espina y sus barras, la Serie traza una línea. Este hook decide el
 * CUÁNDO, que es igual para todos:
 *
 *   · Al entrar en vista. Un IntersectionObserver sobre la tarjeta. Los
 *     paneles ocultos del carrusel están plegados a alto 0 con
 *     `overflow: clip`, así que no intersecan hasta que se enseñan: llegar
 *     a un panel es, para el observador, que la tarjeta aparezca.
 *   · Al cambiar los datos con la tarjeta a la vista: cambia la `firma`, o
 *     cambia la identidad de `datos` porque es otro periodo aunque sus
 *     cifras coincidan. La entrada confirma el cambio de periodo, como hace
 *     la cabecera del mes.
 *   · Nunca al pasar el ratón ni en un re-render sin datos nuevos: el
 *     efecto solo depende de la firma y de la identidad de los datos.
 *
 * ── Tres estados de la tarjeta ───────────────────────────────────────────
 *   fuera       Estado final estático. Si se estaba animando (o estaba
 *               velada), se revierte: la próxima visita empieza de cero.
 *   asoma       Se PREPARA: el trazado queda en su fotograma inicial
 *               (vacío). Sin esto, al deslizar el carrusel se vería el
 *               gráfico terminado entrando por el borde, y a mitad de
 *               camino se borraría para dibujarse.
 *   a la vista  Se reproduce, una vez por visita.
 *
 * «A la vista» NO es el `intersectionRatio`, que mide la fracción del área
 * de la propia tarjeta. Con esa medida, una tarjeta que carga cortada por
 * el pie de la pantalla (1366×640, un móvil) se quedaba congelada en blanco
 * hasta que alguien hiciera scroll, y una más alta que dos pantallas no
 * llegaba nunca al 50 %. El estado «asoma» se pensó para el deslizamiento
 * horizontal del carrusel, no para una tarjeta cortada por abajo. Así que
 * se mide contra lo que de verdad puede verse:
 *   · en horizontal, la fracción del ANCHO de la tarjeta que se ve, que es
 *     lo que crece mientras el carrusel desliza;
 *   · en vertical, la fracción de lo que CABE: el alto de la tarjeta o el
 *     de la pantalla, el menor de los dos.
 * Las dos a partir de 0,5. Y aunque no se llegue, si la tarjeta no está a
 * medio deslizar (ancho ≥ 0,98) y su cifra clave se ve entera, también
 * cuenta: la respuesta ya está en pantalla y enseñarla en blanco sería
 * esconderla. Los umbrales del observador van de 0,1 en 0,1 para que vuelva
 * a avisar mientras la página se desplaza.
 *
 * Al terminar de deslizar, en cambio, puede no llegar ningún aviso. Si la
 * tarjeta está cortada por abajo, su fracción de área se estanca (0,30 a
 * 400 px de ancho) y el último umbral se cruzó a mitad de camino, con la
 * tarjeta todavía recortada por un lado: se quedaba preparada, en blanco,
 * para siempre. Por eso, mientras desliza sin estar a la vista, se pide otra
 * medida en cada fotograma —dejar de observarla y volver a observarla
 * obliga al observador a dar un aviso nuevo con la geometría del momento—
 * hasta que se queda quieta, llega a la vista o sale.
 *
 * ── Ni un fotograma del estado final antes del trazo ─────────────────────
 * Recharts mete los datos en su almacén dentro de un useEffect, así que en
 * el primer commit tras un cambio las barras aún son las viejas (o no
 * existen, al montar). Construir la timeline ahí dejaría fuera las barras
 * que aparezcan después: por eso se construye dos fotogramas más tarde, y
 * mientras tanto el `velo` (lo marcado con `data-entrada-velo`) se oculta.
 * Hay tres momentos en que el estado final podría asomar antes de tiempo:
 *   · Antes de hidratar. El HTML del servidor ya trae el gráfico terminado.
 *     La tarjeta llega con `data-entrada-pendiente` y el CSS global oculta
 *     su velo mientras lo tenga (solo si se admite movimiento). Este hook
 *     quita el atributo en cuanto toma el mando; React no lo vuelve a poner
 *     porque la prop no cambia.
 *   · Al hidratar. El primer aviso del observador es asíncrono y llega
 *     varios fotogramas tarde. Si la tarjeta está en pantalla se vela en el
 *     acto, dentro del propio efecto, antes de que el navegador pinte. SOLO
 *     se vela: construir aquí no vale, porque Recharts puede no haber
 *     pintado aún la espina ni las barras. Quien decide sigue siendo el
 *     observador. Una tarjeta dentro de un panel plegado también tiene caja
 *     propia (no mide cero), así que se vela igual; el primer aviso, que la
 *     da por fuera, le devuelve el velo.
 *   · Al cambiar de datos con la tarjeta a la vista: se prepara en el mismo
 *     commit, con la última medida conocida (`aLaVista`).
 *
 * ── Una visita, un contexto ──────────────────────────────────────────────
 * Cada timeline se construye dentro de su propio `gsap.context` (`visita`).
 * Lo que se crea desde una función `contextSafe` entra en el contexto de
 * useGSAP, y `kill()` no lo saca de ahí: sin el contexto hijo, la timeline
 * de cada visita —con sus decenas de tweens y sus referencias al DOM— se
 * iba acumulando hasta el siguiente cambio de periodo, y al revertirse
 * todas a la vez sus cuentas volvían a escribir ceros. Al retirar se
 * revierte el hijo, que se vacía; el padre solo guarda un contexto vacío
 * por visita.
 *
 * Por el mismo motivo el velo se pone y se quita a mano, con `style`, y no
 * con `gsap.set`: cada `set` es un tween más que se quedaría en el contexto.
 * Como el contexto ya no lo revierte, la limpieza lo devuelve ella misma.
 *
 * ── Cifras que cuentan ───────────────────────────────────────────────────
 * `contar` pone la cifra a 0, la hace contar con `contarHasta` y la apunta.
 * Si la entrada se corta a medias (la tarjeta sale de vista), el texto se
 * devuelve al de su `data-final`. Se lee del atributo y no del valor que se
 * pasó al crear la cuenta porque, al cambiar de periodo, React ya ha escrito
 * el valor nuevo cuando corre la limpieza: restaurar el viejo pisaría el
 * dato bueno.
 *
 * La limpieza del efecto (cambio de datos, desmontaje) restaura TODOS los
 * nodos del ámbito que tengan `data-final`, no solo los apuntados. Al
 * revertirse, el contexto vuelve a llevar al principio cada cuenta que siga
 * en él —la de la visita en curso y, si alguna se hubiera quedado, las de
 * visitas anteriores— y su `onUpdate` escribe otra vez el 0 («0 %») encima
 * del texto nuevo que acaba de poner React. GSAP ejecuta las limpiezas
 * DESPUÉS de revertir, así que esta es la última palabra y siempre deja el
 * dato del render actual.
 *
 * ── Limpieza ─────────────────────────────────────────────────────────────
 * `useGSAP` con dependencias NO revierte al cambiar las dependencias salvo
 * con `revertOnUpdate: true`; sin él, el observador de la firma anterior
 * seguiría vivo junto al nuevo (el fallo que ya dio el carrusel). Todo lo
 * que corre tarde —el observador, los fotogramas— va envuelto en
 * `contextSafe`, para que sus animaciones entren en el contexto y se
 * reviertan con él.
 *
 * Con `prefiereQuietud()` no se anima nada: el render de React ya es el
 * estado final. Se vuelve a consultar en cada visita y no solo al montar,
 * porque la preferencia puede cambiar con la página abierta y el tablero se
 * deja abierto durante horas.
 */

import { useRef, type RefObject } from 'react'

import { contarHasta, gsap, prefiereQuietud, useGSAP } from '@/lib/animacion'

/** Fracción visible a partir de la cual la entrada se reproduce. */
const UMBRAL_VISTA = 0.5
/**
 * El observador avisa al cruzar un umbral pero puede entregar 0,4999: el
 * umbral se compara con un pelo de margen para no perder justo ese aviso.
 */
const MARGEN_UMBRAL = 0.02
/**
 * Umbrales del observador. El 0,01 separa «asoma» de «fuera» aunque no se
 * llegue a cruzar el 0,5. Los intermedios existen porque «a la vista» ya no
 * es el `intersectionRatio`: puede cumplirse entre dos umbrales suyos, y
 * sin avisos intermedios nadie se enteraría hasta el siguiente.
 */
const UMBRALES = [0, 0.01, 0.1, 0.2, 0.3, 0.4, UMBRAL_VISTA, 0.6, 0.8, 1]
/** Fracción del ancho a partir de la cual la tarjeta no está a medio deslizar. */
const ANCHO_ENTERO = 0.98
/** Holgura, en px, al comprobar que la cifra clave cabe en lo visible. */
const HOLGURA_CIFRA = 0.5

/**
 * ¿Está la tarjeta a la vista, y está a medio deslizar? Ver «Tres estados»
 * arriba: se mide contra lo que puede verse, no contra el área de la
 * tarjeta.
 *
 * La cifra clave se compara con `intersectionRect` —la parte de la tarjeta
 * que de verdad se ve, ya recortada por la pantalla y por cualquier
 * antepasado con `overflow`— y no con la pantalla sola: un panel que se
 * despliega podría tener la cifra dentro de la pantalla pero aún recortada.
 */
function medir(
  entrada: IntersectionObserverEntry,
  raiz: HTMLElement,
): { vista: boolean; deslizando: boolean } {
  const caja = entrada.boundingClientRect
  const corte = entrada.intersectionRect
  if (caja.width <= 0 || caja.height <= 0) return { vista: false, deslizando: false }
  const altoVisible = entrada.rootBounds?.height ?? window.innerHeight
  const ancho = corte.width / caja.width
  const alto = corte.height / Math.max(1, Math.min(caja.height, altoVisible))
  const deslizando = ancho < ANCHO_ENTERO
  const minimo = UMBRAL_VISTA - MARGEN_UMBRAL
  if (ancho >= minimo && alto >= minimo) return { vista: true, deslizando }
  if (deslizando) return { vista: false, deslizando }

  // La cabecera (leyenda y estado) hace de «respuesta en pantalla»; la cifra
  // clave se conserva por si algún gráfico vuelve a llevarla.
  const cifra = raiz.querySelector('[data-cabecera-grafico], [data-cifra-clave]')
  if (!cifra) return { vista: false, deslizando }
  const r = cifra.getBoundingClientRect()
  const cabe =
    r.height > 0 &&
    r.top >= corte.top - HOLGURA_CIFRA &&
    r.bottom <= corte.bottom + HOLGURA_CIFRA &&
    r.left >= corte.left - HOLGURA_CIFRA &&
    r.right <= corte.right + HOLGURA_CIFRA
  return { vista: cabe, deslizando }
}

export interface HerramientasEntrada {
  /**
   * Hace contar una cifra desde 0 hasta `valor`. El nodo necesita
   * `data-final` con su texto definitivo. Devuelve el tween para colocarlo
   * en la timeline con `tl.add(tween, posicion)`, o null si no hay nodo.
   */
  contar: (
    nodo: Element | null,
    valor: number,
    formatear: (n: number) => string,
    duracion?: number,
  ) => gsap.core.Tween | null
}

export interface EntradaGraficoOpciones {
  /** La tarjeta: el ámbito de los selectores y lo que observa el observador. */
  ambito: RefObject<HTMLElement | null>
  /** Resumen de los datos. La entrada se repite cuando cambia. */
  firma: string
  /**
   * Identidad de la carga de datos (normalmente el array memoizado que
   * llega por props). Si cambia, porque es otro periodo, la entrada se
   * repite aunque las cifras coincidan y la firma sea la misma: dos
   * quincenas con metas pares, o dos meses futuros sin resultado y con el
   * mismo plan, son periodos distintos y el cambio hay que confirmarlo.
   */
  datos?: unknown
  /**
   * Monta la timeline de entrada sobre el DOM ya pintado. Debe acabar con
   * `clearProps` sobre todo lo que toque: el estado final tiene que ser
   * idéntico al estático. Devuelve null si no hay nada que animar.
   */
  construir: (raiz: HTMLElement, herramientas: HerramientasEntrada) => gsap.core.Timeline | null
}

export function useEntradaGrafico({
  ambito,
  firma,
  datos,
  construir,
}: EntradaGraficoOpciones): void {
  /**
   * ¿Estaba la tarjeta a la vista en el último aviso del observador? Vive
   * fuera del contexto de GSAP para sobrevivir al cambio de datos: así, al
   * llegar datos nuevos, se sabe en el acto si hay que preparar la entrada,
   * sin esperar al primer aviso del observador nuevo.
   */
  const aLaVista = useRef(false)

  useGSAP(
    (_contexto, seguro) => {
      const raiz = ambito.current
      if (!raiz || !seguro) return

      const velos = () =>
        Array.from(raiz.querySelectorAll<HTMLElement | SVGElement>('[data-entrada-velo]'))

      /** Oculta o devuelve el velo. A mano: ver «Una visita, un contexto». */
      const velar = (ocultar: boolean) => {
        velos().forEach(({ style }) => {
          if (ocultar) {
            style.opacity = '0'
            style.visibility = 'hidden'
          } else {
            style.removeProperty('opacity')
            style.removeProperty('visibility')
          }
        })
      }

      // Siembra del velo al hidratar (ver «Ni un fotograma…»): si la tarjeta
      // está en pantalla se vela ya, antes de pintar. `velado` recuerda que
      // hay que devolverlo si el observador acaba diciendo que está fuera.
      let velado = false
      if (!prefiereQuietud()) {
        const caja = raiz.getBoundingClientRect()
        if (
          caja.top < window.innerHeight &&
          caja.bottom > 0 &&
          caja.left < window.innerWidth &&
          caja.right > 0
        ) {
          velar(true)
          velado = true
        }
      }
      // Desde aquí manda el hook: el velo del CSS (solo antes de hidratar)
      // ya no hace falta. Con movimiento reducido también se quita, aunque
      // allí el CSS no oculte nada, para no dejar el atributo colgando.
      raiz.removeAttribute('data-entrada-pendiente')

      if (prefiereQuietud()) return

      /** Nodos puestos a contar: hay que devolverlos si la entrada se corta. */
      const cifras = new Set<Element>()
      /** Contexto de la visita en curso: ver «Una visita, un contexto». */
      let visita: gsap.Context | null = null
      let linea: gsap.core.Timeline | null = null
      let fotogramas: number[] = []
      /** ¿Ya se reprodujo en esta visita? Se rearma al salir de vista. */
      let enVisita = false
      /** Se pidió reproducir antes de que la timeline estuviera montada. */
      let pedida = false
      /**
       * Medida pedida para el fotograma siguiente mientras la tarjeta
       * desliza (ver «Tres estados»). `cajaAnterior` es dónde estaba en la
       * medida anterior: si no se ha movido, ya no desliza y se deja de
       * pedir, para no medir sin fin una tarjeta que esté cortada de lado.
       */
      let remedida = 0
      let cajaAnterior: { left: number; top: number } | null = null

      const restaurarCifras = () => {
        cifras.forEach((nodo) => {
          const final = nodo.getAttribute('data-final')
          if (final !== null) nodo.textContent = final
        })
        cifras.clear()
      }

      const cancelarFotogramas = () => {
        fotogramas.forEach((id) => cancelAnimationFrame(id))
        fotogramas = []
      }

      const dejarDeMedir = () => {
        if (remedida) cancelAnimationFrame(remedida)
        remedida = 0
        cajaAnterior = null
      }

      const herramientas: HerramientasEntrada = {
        contar: (nodo, valor, formatear, duracion = 0.9) => {
          if (!nodo) return null
          cifras.add(nodo)
          // El fotograma inicial se escribe ya: la cuenta puede empezar tarde
          // en la timeline y, hasta entonces, se vería la cifra final.
          nodo.textContent = formatear(0)
          return contarHasta(nodo, valor, formatear, { duracion })
        },
      }

      /** Vuelta al estado estático: nada a medias, nada oculto. */
      const retirar = seguro(() => {
        cancelarFotogramas()
        // Revertir el contexto de la visita lo vacía (a diferencia de
        // `linea.revert()`, que acaba en un `kill()` y deja los tweens
        // apuntados en el contexto padre). Las cuentas vuelven a su 0 al
        // revertirse, y por eso las cifras se restauran justo después.
        visita?.revert()
        visita = null
        linea = null
        pedida = false
        velado = false
        velar(false)
        restaurarCifras()
      })

      const montar = seguro(() => {
        fotogramas = []
        // Primero se quita el velo y DESPUÉS se construye, en la misma tarea:
        // el navegador no pinta entre medias, y las `from` de la timeline
        // dejan puesto su fotograma inicial. Al revés, quitar el velo
        // borraría el `opacity: 0` inicial de lo que también está velado (la
        // cifra clave) y asomaría un fotograma de más.
        velar(false)
        velado = false
        visita = gsap.context(() => {
          linea = construir(raiz, herramientas)
        })
        if (!linea) {
          visita.revert()
          visita = null
          restaurarCifras()
          return
        }
        linea.pause(0)
        if (pedida) linea.play()
      })

      const preparar = seguro(() => {
        // La preferencia puede haber cambiado con la página abierta.
        if (prefiereQuietud()) {
          retirar()
          return
        }
        if (linea || fotogramas.length) return
        velar(true)
        fotogramas.push(
          requestAnimationFrame(() => {
            fotogramas.push(requestAnimationFrame(montar))
          }),
        )
      })

      const reproducir = seguro(() => {
        if (prefiereQuietud()) {
          retirar()
          return
        }
        pedida = true
        if (linea) linea.play(0)
        else preparar()
      })

      const observador = new IntersectionObserver(
        seguro((entradas: IntersectionObserverEntry[]) => {
          const entrada = entradas[entradas.length - 1]
          if (!entrada) return
          // Un objetivo recortado del todo puede llegar como «intersecando»
          // con área 0 (contacto de bordes): para esto cuenta como fuera.
          const asoma = entrada.isIntersecting && entrada.intersectionRatio > 0
          const { vista, deslizando } = asoma
            ? medir(entrada, raiz)
            : { vista: false, deslizando: false }
          aLaVista.current = vista

          if (!asoma) {
            dejarDeMedir()
            // `velado`: la siembra veló una tarjeta que resultó estar en un
            // panel plegado, y hay que devolverle el velo.
            if (enVisita || linea || fotogramas.length || velado) retirar()
            enVisita = false
            return
          }
          // Mientras dura la visita no se vuelve a preparar: al deslizar el
          // carrusel hacia fuera la tarjeta cruza el 50 % de bajada, y eso no
          // debe vaciar el gráfico que se está yendo.
          if (enVisita) {
            dejarDeMedir()
            return
          }
          if (vista) {
            dejarDeMedir()
            enVisita = true
            reproducir()
            return
          }

          preparar()
          // A medio deslizar y sin estar a la vista: se pide otra medida para
          // el fotograma siguiente, porque al acabar el deslizamiento puede
          // no cruzarse ningún umbral más (ver «Tres estados»).
          const { left, top } = entrada.boundingClientRect
          const quieta = cajaAnterior?.left === left && cajaAnterior?.top === top
          if (deslizando && !quieta) {
            cajaAnterior = { left, top }
            if (!remedida) {
              remedida = requestAnimationFrame(() => {
                remedida = 0
                observador.unobserve(raiz)
                observador.observe(raiz)
              })
            }
          } else {
            cajaAnterior = null
          }
        }),
        { threshold: UMBRALES },
      )

      // Datos nuevos con la tarjeta ya a la vista: se prepara ahora mismo, en
      // el mismo commit, antes de que el navegador pinte los datos nuevos ya
      // terminados. El aviso inicial del observador llegará después y verá
      // que la visita ya está en marcha.
      if (aLaVista.current) {
        enVisita = true
        reproducir()
      }

      observador.observe(raiz)

      return () => {
        // Antes que desconectar: una medida pendiente volvería a observar.
        dejarDeMedir()
        observador.disconnect()
        cancelarFotogramas()
        // Todos los `data-final` del ámbito, no solo los apuntados: ver
        // «Cifras que cuentan». Solo se escribe lo que difiere, para no
        // tocar nodos que React ya dejó bien.
        raiz.querySelectorAll('[data-final]').forEach((nodo) => {
          const final = nodo.getAttribute('data-final')
          if (final !== null && nodo.textContent !== final) nodo.textContent = final
        })
        cifras.clear()
        // El velo ya no es un tween del contexto: nadie más lo devolvería.
        velar(false)
      }
    },
    { scope: ambito, dependencies: [firma, datos], revertOnUpdate: true },
  )
}
