'use client'

/**
 * Control de periodo de la barra superior.
 *
 * ── Por qué una rejilla y no una lista ───────────────────────────────────
 * El plan tiene 33 meses. En una lista desplegable eso son 33 renglones que
 * hay que recorrer con la rueda para encontrar «marzo de 2027»: se tarda más
 * en buscar el mes que en leer el tablero.
 *
 * Una rejilla de doce celdas cabe entera de un vistazo y la posición es
 * constante —abril siempre está en el mismo sitio—, así que a la tercera vez
 * la mano va sola. El año se cambia con dos flechas.
 *
 * ── Por qué además hay paso adelante/atrás fuera del desplegable ─────────
 * El gesto más frecuente de esta herramienta es «enséñame el mes anterior».
 * Merece una tecla, no abrir un panel.
 *
 * ── Los meses sin capturar se marcan ─────────────────────────────────────
 * De 33 meses solo unos pocos tienen resultado. Presentarlos todos iguales
 * invita a caer en uno vacío y pensar que la herramienta está rota.
 */

import { useEffect, useRef, useState } from 'react'
import { CalendarDotsIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react/ssr'

import type { Periodo, TipoPeriodo } from '@/lib/tipos'
import { MESES_CORTOS, capitalizar } from '@/lib/periodos'
import { cn } from '@/lib/utils'

export interface SelectorPeriodoProps {
  /** Periodos del tipo activo, del más reciente al más antiguo. */
  periodos: Periodo[]
  actual: Periodo
  onCambiar: (id: string) => void
  tipo: TipoPeriodo
  onCambiarTipo: (tipo: TipoPeriodo) => void
  /** Ids con resultado capturado. */
  conDato: Set<string>
  /** Si el plan no trae quincenas, el conmutador no se pinta. */
  hayVariosTipos: boolean
}

export function SelectorPeriodo({
  periodos,
  actual,
  onCambiar,
  tipo,
  onCambiarTipo,
  conDato,
  hayVariosTipos,
}: SelectorPeriodoProps) {
  // `periodos` viene del más reciente al más antiguo, así que «atrás en el
  // tiempo» es el siguiente del array. Se nombra por lo que hace: el índice
  // miente aquí.
  const indice = periodos.findIndex((p) => p.id === actual.id)
  const haciaAtras = indice >= 0 && indice < periodos.length - 1 ? periodos[indice + 1] : null
  const haciaDelante = indice > 0 ? periodos[indice - 1] : null

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-initial">
      {hayVariosTipos && <ConmutadorTipo tipo={tipo} onCambiar={onCambiarTipo} />}

      {/* Atrás, periodo y adelante son un mismo control: van en una sola pieza.
          En móvil se estira para llenar la fila en vez de imponer su ancho:
          con ancho fijo, la fila medía 498 px en una pantalla de 400. */}
      <div
        className="flex min-w-0 flex-1 items-center gap-0.5 rounded-full border p-[3px] sm:flex-initial"
        style={{ borderColor: 'var(--border)' }}
      >
        <Paso
          etiqueta={haciaAtras ? `Ir a ${haciaAtras.etiqueta}` : 'No hay periodo anterior'}
          onClick={() => haciaAtras && onCambiar(haciaAtras.id)}
          desactivado={!haciaAtras}
        >
          <CaretLeftIcon weight="bold" aria-hidden="true" className="size-3.5" />
        </Paso>

        <Rejilla
          periodos={periodos}
          actual={actual}
          onCambiar={onCambiar}
          conDato={conDato}
        />

        <Paso
          etiqueta={haciaDelante ? `Ir a ${haciaDelante.etiqueta}` : 'No hay periodo siguiente'}
          onClick={() => haciaDelante && onCambiar(haciaDelante.id)}
          desactivado={!haciaDelante}
        >
          <CaretRightIcon weight="bold" aria-hidden="true" className="size-3.5" />
        </Paso>
      </div>
    </div>
  )
}

/* ── Rejilla de meses ───────────────────────────────────────────────────── */

function Rejilla({
  periodos,
  actual,
  onCambiar,
  conDato,
}: {
  periodos: Periodo[]
  actual: Periodo
  onCambiar: (id: string) => void
  conDato: Set<string>
}) {
  const [abierto, setAbierto] = useState(false)
  const [anio, setAnio] = useState(actual.anio)
  const caja = useRef<HTMLDivElement>(null)

  // Abrir sitúa la rejilla en el año del periodo actual: si estás en marzo de
  // 2027 y abres, no tiene sentido empezar en 2026.
  //
  // Se hace aquí y no en un efecto: sincronizar estado con estado desde un
  // useEffect provoca un render de más y, peor, deja una ventana en la que el
  // panel ya está abierto enseñando el año equivocado.
  function alternar() {
    setAbierto((estaba) => {
      if (!estaba) setAnio(actual.anio)
      return !estaba
    })
  }

  // Cerrar al pulsar fuera o con Escape. Sin esto el panel se queda abierto
  // tapando el tablero, que es justo lo que se quería mirar.
  useEffect(() => {
    if (!abierto) return

    function fuera(evento: MouseEvent) {
      if (caja.current && !caja.current.contains(evento.target as Node)) setAbierto(false)
    }
    function escape(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAbierto(false)
    }

    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  const anios = [...new Set(periodos.map((p) => p.anio))].sort((a, b) => a - b)
  const primerAnio = anios[0]
  const ultimoAnio = anios[anios.length - 1]

  // Del año visible, qué mes existe en el plan. La rejilla siempre pinta los
  // doce; los que el plan no cubre salen apagados y no se pueden pulsar.
  const delAnio = new Map(periodos.filter((p) => p.anio === anio).map((p) => [p.mes, p]))

  return (
    <div ref={caja} className="relative min-w-0 flex-1 sm:flex-initial">
      <button
        type="button"
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={cn(
          'flex h-7 w-full items-center justify-center gap-2 rounded-full px-3 text-[0.8125rem] font-medium sm:w-44',
          'transition-colors duration-200 hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)]',
          'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
          abierto && 'bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)]',
        )}
      >
        {/* Sin el icono, el nombre del mes no parece pulsable: nada dice que
            abre la rejilla. Va en carmín porque es un control, no un dato. */}
        <CalendarDotsIcon
          weight="duotone"
          aria-hidden="true"
          className="size-4 shrink-0 text-brand"
        />
        <span className="truncate">{actual.etiqueta}</span>
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Elegir periodo"
          className="absolute top-[calc(100%+0.75rem)] left-1/2 z-50 w-[17.5rem] -translate-x-1/2 rounded-xl border p-3"
          style={{
            background: 'var(--popover)',
            borderColor: 'var(--regla)',
            boxShadow: 'var(--sombra-alta)',
          }}
        >
          {/* Año */}
          <div className="flex items-center justify-between">
            <FlechaAnio
              etiqueta="Año anterior"
              onClick={() => setAnio((a) => Math.max(primerAnio, a - 1))}
              desactivado={anio <= primerAnio}
            >
              <CaretLeftIcon weight="bold" aria-hidden="true" className="size-3.5" />
            </FlechaAnio>
            <span className="cifra text-sm font-medium tabular-nums">{anio}</span>
            <FlechaAnio
              etiqueta="Año siguiente"
              onClick={() => setAnio((a) => Math.min(ultimoAnio, a + 1))}
              desactivado={anio >= ultimoAnio}
            >
              <CaretRightIcon weight="bold" aria-hidden="true" className="size-3.5" />
            </FlechaAnio>
          </div>

          {/* Doce celdas, siempre en el mismo sitio */}
          <div className="mt-3 grid grid-cols-4 gap-1">
            {MESES_CORTOS.map((abreviatura, i) => {
              const mes = i + 1
              const periodo = delAnio.get(mes)
              const seleccionado = periodo?.id === actual.id
              const tiene = periodo ? conDato.has(periodo.id) : false

              return (
                <button
                  key={abreviatura}
                  type="button"
                  disabled={!periodo}
                  onClick={() => {
                    if (!periodo) return
                    onCambiar(periodo.id)
                    setAbierto(false)
                  }}
                  aria-current={seleccionado ? 'true' : undefined}
                  className={cn(
                    'relative flex h-9 flex-col items-center justify-center rounded-md text-xs',
                    'transition-colors duration-200',
                    'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                    !periodo && 'cursor-not-allowed opacity-25',
                    periodo &&
                      !seleccionado &&
                      'hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)]',
                  )}
                  style={
                    seleccionado
                      ? {
                          // Carmín de marca: dice dónde estás. Es cromo, no dato.
                          background: 'var(--brand)',
                          color: 'var(--primary-foreground)',
                        }
                      : undefined
                  }
                >
                  <span className="font-medium">{capitalizar(abreviatura)}</span>
                  {/* Punto de «tiene resultado». No se pinta dentro de la
                      celda activa: allí el carmín ya la distingue y un punto
                      encima sería ruido. */}
                  {tiene && !seleccionado && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1 size-1 rounded-full"
                      style={{ backgroundColor: 'var(--estado-neutro)' }}
                    />
                  )}
                  {tiene && <span className="sr-only">con resultado</span>}
                </button>
              )
            })}
          </div>

          <p
            className="mt-3 flex items-center gap-1.5 border-t pt-2.5 text-[0.6875rem] text-muted-foreground"
            style={{ borderColor: 'var(--regla-fina)' }}
          >
            <span
              aria-hidden="true"
              className="inline-block size-1 rounded-full"
              style={{ backgroundColor: 'var(--estado-neutro)' }}
            />
            Con resultado capturado
          </p>
        </div>
      )}
    </div>
  )
}

/* ── Botones ────────────────────────────────────────────────────────────── */

const TIPOS: Array<{ id: TipoPeriodo; etiqueta: string }> = [
  { id: 'mes', etiqueta: 'Mes' },
  { id: 'quincena', etiqueta: 'Quincena' },
]

/**
 * Mismo dibujo que el conmutador de vistas de la barra —bandeja y píldoras—
 * pero el activo va en papel y no en carmín: el carmín ya dice en qué modo
 * estás, y dos manchas de marca juntas competirían por decir «aquí».
 */
function ConmutadorTipo({
  tipo,
  onCambiar,
}: {
  tipo: TipoPeriodo
  onCambiar: (tipo: TipoPeriodo) => void
}) {
  return (
    <div
      role="group"
      aria-label="Grano del periodo"
      className="flex items-center gap-0.5 rounded-full p-1"
      style={{ background: 'color-mix(in oklab, var(--foreground) 5%, transparent)' }}
    >
      {TIPOS.map((t) => {
        const activo = t.id === tipo
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(t.id)}
            className={cn(
              'h-7 rounded-full px-3.5 text-[0.8125rem] font-medium',
              'transition-[background-color,color,box-shadow] duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              activo
                ? 'bg-background text-foreground shadow-[var(--sombra-tray)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
            style={{ transitionTimingFunction: 'var(--ease-fluid)' }}
          >
            {t.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

function Paso({
  children,
  etiqueta,
  onClick,
  desactivado,
}: {
  children: React.ReactNode
  etiqueta: string
  onClick: () => void
  desactivado: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      aria-label={etiqueta}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground',
        'transition-[color,background-color] duration-200',
        'hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] hover:text-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-30',
      )}
      style={{ transitionTimingFunction: 'var(--ease-fluid)' }}
    >
      {children}
    </button>
  )
}

function FlechaAnio({
  children,
  etiqueta,
  onClick,
  desactivado,
}: {
  children: React.ReactNode
  etiqueta: string
  onClick: () => void
  desactivado: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      aria-label={etiqueta}
      className={cn(
        'flex size-7 items-center justify-center rounded-md text-muted-foreground',
        'transition-colors duration-200',
        'hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] hover:text-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-25',
      )}
    >
      {children}
    </button>
  )
}
