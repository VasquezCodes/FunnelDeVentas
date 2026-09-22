'use client'

/**
 * Carrusel de secciones.
 *
 * ── Qué problema resuelve y qué cuesta ───────────────────────────────────
 * La hoja completa medía casi cuatro pantallas y había que recorrerla entera
 * para llegar al dinero. Aquí las cuatro secciones ocupan el mismo sitio y
 * se deslizan.
 *
 * El precio hay que decirlo: un carrusel ESCONDE. Ya no se puede comparar el
 * embudo con los canales de un vistazo, y lo que no se ve tiende a no
 * mirarse. Se paga a cambio de que la respuesta —la cabecera del mes— esté
 * siempre delante, sin scroll, que es lo que se viene a buscar.
 *
 * ── Por qué una rejilla y no cuatro capas ────────────────────────────────
 * Los cuatro paneles viven en la misma fila de una rejilla, uno al lado del
 * otro. Así el contenedor mide siempre lo que el panel más alto y el bloque
 * no pega saltos al cambiar de sección. Con posicionado absoluto o con
 * display:none habría que medir y animar la altura, que es un temblor
 * garantizado.
 *
 * ── El raíl es información ───────────────────────────────────────────────
 * No son pestañas decorativas: cada una lleva un punto si esa sección tiene
 * algo fuera de plan. La navegación dice dónde mirar antes de entrar.
 *
 * ── Sin gesto de arrastre ────────────────────────────────────────────────
 * Se cambia de sección con el raíl o con las flechas, nunca arrastrando.
 * Hubo un gesto de deslizar y se quitó: con el ratón, arrastrar para
 * seleccionar una cifra cambiaba de sección.
 */

import { useEffect, useRef, useState } from 'react'
import type { Icon } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'
import { gsap, prefiereQuietud, useGSAP } from '@/lib/animacion'

export interface Panel {
  id: string
  clave: string
  /** Icono de la sección en el raíl. */
  icono?: Icon
  titulo: string
  /** Marca el raíl si esta sección tiene algo que mirar. */
  avisa?: boolean
  contenido: React.ReactNode
}

export interface CarruselProps {
  paneles: Panel[]
}

export function Carrusel({ paneles }: CarruselProps) {
  const [activo, setActivo] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const via = useRef<HTMLDivElement>(null)
  const ventana = useRef<HTMLDivElement>(null)
  /** Panel activo antes del cambio en curso: sigue desplegado mientras sale. */
  const anterior = useRef(0)

  const total = paneles.length

  // El desplazamiento se expresa en porcentaje de la VÍA, que mide
  // `total * 100 %` del hueco visible. Un panel = 100/total de la vía.
  //
  // La altura de la ventana acompaña al panel activo. Sin esto la caja mide
  // siempre lo que el panel más alto y queda un vacío enorme bajo los cortos.
  //
  // Con eso no basta: la ventana solo recorta en horizontal y la rejilla
  // sigue midiendo lo que el panel más alto, así que los ocultos desbordaban
  // por abajo —invisibles— y alargaban la página con un vacío bajo el pie.
  // Por eso los ocultos se pliegan a alto 0. Recortar la ventana también en
  // vertical no sirve: cortaría los tooltips del embudo que asoman fuera.
  useGSAP(
    () => {
      if (!via.current || !ventana.current) return

      const secciones = Array.from(via.current.children) as HTMLElement[]
      const saliente = anterior.current
      anterior.current = activo

      // El que sale se pliega al terminar de irse, no antes: plegado a medio
      // deslizamiento se vería vaciarse.
      const plegar = (conservar: number | null) => {
        secciones.forEach((seccion, i) => {
          const oculto = i !== activo && i !== conservar
          gsap.set(seccion, oculto ? { height: 0, overflow: 'clip' } : { clearProps: 'height,overflow' })
        })
      }

      const destino = -(100 / total) * activo
      const panel = secciones[activo]
      const quieto = prefiereQuietud()

      // Sin animación no hay nadie saliendo: se pliega todo ya.
      plegar(quieto ? null : saliente)
      // Se mide DESPUÉS de desplegarlo: plegado mediría 0.
      const alto = panel?.offsetHeight

      if (quieto) {
        gsap.set(via.current, { xPercent: destino })
        if (alto) gsap.set(ventana.current, { height: alto })
        return
      }

      gsap.to(via.current, {
        xPercent: destino,
        duration: 0.62,
        ease: 'power3.inOut',
        // Si llega otro cambio a medio camino, este tween se descarta entero
        // y su onComplete no pliega el panel que está entrando.
        overwrite: 'auto',
        onComplete: () => plegar(null),
      })
      if (alto) {
        gsap.to(ventana.current, { height: alto, duration: 0.62, ease: 'power3.inOut' })
      }
    },
    { scope: raiz, dependencies: [activo, total] },
  )

  /**
   * El panel activo puede cambiar de alto sin que cambie `activo`: al elegir
   * otro indicador en la serie, al redimensionar la ventana, al llegar una
   * tipografía. Sin observarlo, la caja se queda con la altura de antes y
   * recorta el contenido.
   *
   * Es un useEffect y NO un useGSAP. useGSAP con dependencias no ejecuta la
   * limpieza al cambiar de panel —solo al desmontar—, así que el observador
   * del panel anterior seguía vivo: al plegarse ese panel a alto 0, ponía la
   * ventana a 0 y el panel nuevo se quedaba sin sitio.
   */
  useEffect(() => {
    const panel = via.current?.children[activo] as HTMLElement | undefined
    if (!panel || !ventana.current) return

    const observador = new ResizeObserver(() => {
      if (!ventana.current) return
      gsap.set(ventana.current, { height: panel.offsetHeight })
    })
    observador.observe(panel)
    return () => observador.disconnect()
  }, [activo])

  function alTeclear(evento: React.KeyboardEvent) {
    if (evento.key === 'ArrowRight') {
      evento.preventDefault()
      setActivo((i) => Math.min(total - 1, i + 1))
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault()
      setActivo((i) => Math.max(0, i - 1))
    } else if (evento.key === 'Home') {
      evento.preventDefault()
      setActivo(0)
    } else if (evento.key === 'End') {
      evento.preventDefault()
      setActivo(total - 1)
    }
  }

  const panel = paneles[activo]

  return (
    <div ref={raiz}>
      {/* ── Raíl ─────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Secciones del tablero"
        onKeyDown={alTeclear}
        className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b"
        style={{ borderColor: 'var(--regla)' }}
      >
        {paneles.map((p, i) => {
          const seleccionado = i === activo
          const Icono = p.icono
          return (
            <button
              key={p.id}
              role="tab"
              id={`rail-${p.id}`}
              aria-selected={seleccionado}
              aria-controls={`panel-${p.id}`}
              tabIndex={seleccionado ? 0 : -1}
              onClick={() => setActivo(i)}
              className={cn(
                'eyebrow group/rail transicion-fluida relative -mb-px px-3 py-3 transition-colors duration-300',
                'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                seleccionado ? 'text-foreground' : 'hover:text-foreground',
              )}
            >
              <span className="flex items-center gap-1.5">
                {Icono && (
                  <Icono
                    weight="duotone"
                    aria-hidden="true"
                    className={cn(
                      'transicion-fluida size-3.5 shrink-0 transition-colors duration-300',
                      // Carmín solo en la sección donde estás, como el
                      // subrayado: icono y raya dicen lo mismo y lo dicen
                      // juntos. Las demás se quedan en el gris del raíl y se
                      // encienden al pasar el ratón — avisan de adónde lleva
                      // el clic antes de darlo.
                      seleccionado ? 'text-brand' : 'group-hover/rail:text-brand',
                    )}
                  />
                )}
                {p.clave}
                {p.avisa && (
                  <span
                    aria-hidden="true"
                    className="inline-block size-1 shrink-0 rounded-full"
                    style={{ backgroundColor: 'var(--estado-critico)' }}
                  />
                )}
              </span>
              {/* Subrayado del activo. Es un elemento aparte y no un
                  border-bottom para que pueda solaparse con el filete del
                  raíl sin moverlo. */}
              <span
                aria-hidden="true"
                className="transicion-fluida absolute inset-x-2 bottom-0 h-[2px] origin-left transition-transform duration-300"
                style={{
                  // Carmín de marca: marca dónde estás. Es la barra de color
                  // más grande de la página y se mueve contigo al navegar.
                  // Sigue sin ser un dato, que es lo que la mantiene lejos
                  // del rojo crítico del semáforo.
                  backgroundColor: 'var(--brand)',
                  transform: `scaleX(${seleccionado ? 1 : 0})`,
                }}
              />
              {p.avisa && <span className="sr-only">(hay algo fuera de plan)</span>}
            </button>
          )
        })}

        <span className="cifra ml-auto pr-1 text-[0.6875rem] text-muted-foreground">
          {activo + 1} / {total}
        </span>
      </div>

      {/* ── Cabecera del panel activo ──────────────────────────────────
          Solo el título. La altura mínima da para dos renglones, que es lo
          que ocupa el título más largo en una pantalla estrecha: sin ella,
          pasar de un panel a otro daría un salto de línea y el gráfico de
          debajo se movería. */}
      <div className="mt-6 mb-5 min-h-13">
        <h2 className="font-display text-xl leading-tight font-semibold tracking-tight text-balance">
          {panel.titulo}
        </h2>
      </div>

      {/* ── Vía ──────────────────────────────────────────────────────────
          `overflow-x: clip` y no `hidden`: hidden convierte el elemento en un
          contenedor de scroll, y basta con que un hijo se pase de ancho para
          que aparezca una barra horizontal en toda la página. `clip` recorta
          sin crear ese contenedor.

          La altura la fija el panel activo y la anima GSAP. La alternativa
          —una rejilla donde todos los paneles comparten fila— daba una caja
          tan alta como el panel más alto y dejaba cientos de píxeles muertos
          debajo del embudo. */}
      <div ref={ventana} className="overflow-x-clip">
        <div
          ref={via}
          className="grid items-start"
          style={{
            width: `${total * 100}%`,
            // `minmax(0, 1fr)` y NO `1fr`. Una columna `1fr` lleva
            // `min-width: auto`, así que crece hasta caber su contenido: la
            // gráfica de la serie mide unos 2 150 px con 33 periodos,
            // estiraba su columna y con ella la vía entera, y el resultado
            // era una barra de scroll horizontal en toda la página. El
            // `min-w-0` del hijo no lo evita: quien se desborda es la
            // columna, no el hijo.
            gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`,
          }}
        >
          {paneles.map((p, i) => {
            const oculto = i !== activo
            return (
              <section
                key={p.id}
                id={`panel-${p.id}`}
                role="tabpanel"
                aria-labelledby={`rail-${p.id}`}
                // `inert` saca del tabulador y del lector de pantalla todo lo
                // que hay dentro de un panel que no se está viendo. Sin esto
                // el foco se va a botones invisibles fuera de la pantalla.
                inert={oculto}
                className="min-w-0 px-[1px]"
              >
                {p.contenido}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
