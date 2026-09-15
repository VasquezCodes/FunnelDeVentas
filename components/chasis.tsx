'use client'

/**
 * Chasis: barra superior fija y contenedor principal.
 *
 * ── Cómo se reparte la barra ─────────────────────────────────────────────
 * Tres zonas, y cada una responde a una pregunta distinta:
 *
 *   izquierda   quién soy      la marca
 *   centro      qué estoy haciendo   leer el tablero o capturar datos
 *   derecha     qué estoy mirando    el periodo, y el tema
 *
 * Antes iban las tres apelotonadas contra los bordes con el periodo pegado
 * al botón de tema. El control de periodo es el que más se usa de toda la
 * aplicación, así que ahora tiene sitio propio y separación real.
 *
 * ── Fija y pegada al borde ───────────────────────────────────────────────
 * No es una píldora flotante. Un tablero se opera: el selector de periodo y
 * la navegación tienen que estar siempre en el mismo sitio, sin que haya que
 * perseguirlos al hacer scroll.
 */

import Image from 'next/image'
import { BookOpenTextIcon, MoonStarsIcon, PencilSimpleLineIcon, SunDimIcon } from '@phosphor-icons/react/ssr'
import type { Icon } from '@phosphor-icons/react'
import { useCallback, useSyncExternalStore } from 'react'

import { cn } from '@/lib/utils'

export type Vista = 'tablero' | 'captura'

interface ChasisProps {
  vista: Vista
  onCambiarVista: (v: Vista) => void
  /** Control de periodo — lo inyecta el tablero, que es quien tiene el estado. */
  controles?: React.ReactNode
  children: React.ReactNode
}

/**
 * Cada modo lleva el icono de su gesto, no el de su pantalla. El tablero se
 * LEE —es una hoja reglada, un libro de cuentas abierto— y la captura se
 * ESCRIBE sobre el renglón. Un gráfico de barras y un teclado dirían «qué
 * hay»; un libro y un lápiz dicen «qué vas a hacer», que es lo que se decide
 * al pulsar.
 */
const VISTAS: Array<{ id: Vista; etiqueta: string; Icono: Icon }> = [
  { id: 'tablero', etiqueta: 'Tablero', Icono: BookOpenTextIcon },
  { id: 'captura', etiqueta: 'Capturar datos', Icono: PencilSimpleLineIcon },
]

export function Chasis({ vista, onCambiarVista, controles, children }: ChasisProps) {
  return (
    <div className="min-h-screen">
      <header
        className={cn(
          'sticky top-0 z-30',
          'border-b',
          'bg-[color-mix(in_oklab,var(--background)_84%,transparent)] backdrop-blur-xl',
        )}
        style={{ borderColor: 'var(--regla)' }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5">
          <Marca />

          {/* En móvil el botón de tema sube a la fila de la marca: en la fila
              del periodo no cabía y empujaba la página a 498 px de ancho. */}
          <div className="ml-auto sm:hidden">
            <BotonTema />
          </div>

          <span
            aria-hidden="true"
            className="hidden h-7 w-px shrink-0 sm:block"
            style={{ backgroundColor: 'var(--regla)' }}
          />

          <NavVistas vista={vista} onCambiarVista={onCambiarVista} />

          <div className="flex w-full items-center gap-4 sm:ml-auto sm:w-auto">
            {controles}
            {/* El tema es una preferencia de la aplicación, no parte del
                periodo: un filete lo separa de lo que sí se está mirando. */}
            {controles && (
              <span
                aria-hidden="true"
                className="hidden h-6 w-px shrink-0 sm:block"
                style={{ backgroundColor: 'var(--regla)' }}
              />
            )}
            <div className="hidden sm:block">
              <BotonTema />
            </div>
          </div>
        </div>
      </header>

      {/* `overflow-x: clip` recorta cualquier desbordamiento lateral sin
          crear un contenedor de scroll — y sin romper el `position: sticky`
          de la cabecera, que es lo que pasaría con `overflow: hidden`. */}
      <main className="mx-auto max-w-[1400px] overflow-x-clip px-5 pt-6 pb-10">{children}</main>
    </div>
  )
}

/* ── Marca ──────────────────────────────────────────────────────────────── */

/**
 * El wordmark es ancho: se fija el ALTO y el ancho se deja automático. Al
 * revés —fijando el ancho— la marca se aplastaría o se estiraría según el
 * espacio, que es la forma más rápida de que un logo deje de ser un logo.
 *
 * `width`/`height` en el componente son la proporción del fichero, no el
 * tamaño de pantalla: next/image las necesita para reservar el hueco y no
 * provocar un salto de maquetación al cargar. El tamaño real lo pone la
 * clase.
 */
function Marca() {
  return (
    <div className="flex shrink-0 items-center">
      <Image
        src="/marca/logo-negro.png"
        alt="Bastida &amp; Farina"
        width={160}
        height={56}
        priority
        className="h-11 w-auto dark:hidden"
      />
      <Image
        src="/marca/logo-blanco.png"
        alt="Bastida &amp; Farina"
        width={160}
        height={56}
        priority
        className="hidden h-11 w-auto dark:block"
      />
    </div>
  )
}

/* ── Navegación ─────────────────────────────────────────────────────────── */

/**
 * Cambia de MODO, no de sección: leer o capturar. Por eso sigue siendo un
 * control segmentado —dos estados excluyentes, ambos visibles— y no el
 * subrayado que usa el raíl de secciones dentro del tablero. Dos gestos
 * distintos, dos formas distintas.
 */
function NavVistas({ vista, onCambiarVista }: Pick<ChasisProps, 'vista' | 'onCambiarVista'>) {
  return (
    <nav
      aria-label="Vistas"
      className="flex items-center gap-0.5 rounded-full p-0.5"
      style={{ background: 'color-mix(in oklab, var(--foreground) 5%, transparent)' }}
    >
      {VISTAS.map(({ id, etiqueta, Icono }) => {
        const activa = id === vista
        return (
          <button
            key={id}
            type="button"
            onClick={() => onCambiarVista(id)}
            aria-current={activa ? 'page' : undefined}
            className={cn(
              // El icono pesa a la izquierda: el relleno corto de ese lado lo
              // compensa, para que se vea centrado el conjunto y no el texto.
              'flex items-center gap-2 rounded-full py-2 pr-4 pl-3 text-sm font-medium',
              'transition-[background-color,color,transform] duration-300',
              'active:scale-[0.98]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              activa ? 'shadow-[var(--sombra-tray)]' : 'text-muted-foreground hover:text-foreground',
            )}
            style={{
              transitionTimingFunction: 'var(--ease-fluid)',
              // Carmín de marca en el modo activo. Es cromo, no dato: dice
              // «estás aquí». Blanco sobre carmín mide 6,4:1, de sobra para
              // un texto de este cuerpo.
              ...(activa
                ? { backgroundColor: 'var(--brand)', color: 'var(--primary-foreground)' }
                : {}),
            }}
          >
            {/*
              Duotono: el trazo y una aguada del mismo tono al 20 %. Fuera del
              modo activo va en carmín —es cromo de marca, no dato—; dentro, el
              fondo ya es carmín, así que pasa al color del texto por
              `currentColor` y la aguada se vuelve un velo claro sobre la marca.
            */}
            <Icono
              weight="duotone"
              aria-hidden="true"
              className={cn('size-4 shrink-0', !activa && 'text-brand')}
            />
            {etiqueta}
          </button>
        )
      })}
    </nav>
  )
}

/* ── Tema ───────────────────────────────────────────────────────────────── */

/**
 * El tema vive en el DOM (la clase `dark` del <html>), no en React: lo pone
 * un script en el <head> antes de pintar para evitar el fogonazo blanco.
 *
 * `useSyncExternalStore` es la primitiva para justo eso —leer algo externo a
 * React— y resuelve de paso los dos problemas del `useEffect` que había
 * antes: no dispara un render en cascada al montar, y se entera si la clase
 * cambia desde fuera (otra pestaña, las herramientas del navegador, un
 * script). El snapshot del servidor es `false` porque el HTML que emite el
 * servidor nunca lleva la clase; el script la añade ya en el cliente.
 */
function suscribirTema(alCambiar: () => void): () => void {
  const observador = new MutationObserver(alCambiar)
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observador.disconnect()
}

const leerTema = () => document.documentElement.classList.contains('dark')
const temaEnServidor = () => false

function BotonTema() {
  const oscuro = useSyncExternalStore(suscribirTema, leerTema, temaEnServidor)

  const alternar = useCallback(() => {
    const siguiente = !document.documentElement.classList.contains('dark')
    // Basta con tocar el DOM: el observador de arriba avisa a React.
    document.documentElement.classList.toggle('dark', siguiente)
    try {
      localStorage.setItem('tema', siguiente ? 'oscuro' : 'claro')
    } catch {
      // Modo privado o almacenamiento bloqueado: el tema no persiste y ya.
    }
  }, [])

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full border',
        'text-muted-foreground hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] hover:text-foreground',
        'transition-[color,background-color,transform] duration-300 active:scale-[0.95]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
      style={{ borderColor: 'var(--border)', transitionTimingFunction: 'var(--ease-fluid)' }}
    >
      {/* Se enseña el modo al que se va, no el que hay: sol en el oscuro,
          luna con estrellas en el claro. En carmín, como el resto de los
          controles de la barra. */}
      {oscuro ? (
        <SunDimIcon weight="duotone" aria-hidden="true" className="size-4 text-brand" />
      ) : (
        <MoonStarsIcon weight="duotone" aria-hidden="true" className="size-4 text-brand" />
      )}
    </button>
  )
}
