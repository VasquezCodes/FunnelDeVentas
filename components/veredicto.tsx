/**
 * Veredicto: la conclusión del periodo, arriba del todo.
 *
 * ── El único bloque con bisel de la página ───────────────────────────────
 * El doble bisel (bandeja + núcleo) es caro visualmente: dice «esto es un
 * objeto aparte, míralo». Si se estampa en veinte tarjetas deja de decirlo y
 * se convierte en textura. Aquí se gasta una sola vez, en lo que de verdad
 * hay que mirar primero, y el resto de la hoja son filetes y aire.
 *
 * ── Jerarquía ────────────────────────────────────────────────────────────
 *   1. La frase. Es una conclusión en castellano, no un rótulo: contesta
 *      «¿vamos bien?» sin que haya que interpretar ninguna cifra.
 *   2. El cumplimiento, enorme. La misma respuesta en un número.
 *   3. El reparto de estados, en una tira fina. Periférico: se lee sin
 *      mirarlo y dice cuánto de lo demás está en cada situación.
 *
 * El color del acento sale del estado, y jamás va solo: la frase ya lo dice
 * con palabras, así que quien no distinga el rojo del verde lee lo mismo.
 */

import type { Estado, Periodo } from '@/lib/tipos'
import type { Lectura } from '@/lib/lectura'
import { ETIQUETAS_ESTADO, formatearCumplimiento } from '@/lib/comparacion'
import { Semaforo, varEstado, varEstadoSuave } from '@/components/semaforo'

/** Orden de la tira: de lo bueno a lo que falta. Es el orden en que se cuenta. */
const ORDEN_ESTADOS: Estado[] = ['ok', 'alerta', 'critico', 'sin-dato']

export interface VeredictoProps {
  lectura: Lectura
  periodo: Periodo
}

export function Veredicto({ lectura, periodo }: VeredictoProps) {
  const { titular, detalle, cumplimiento, tono, reparto } = lectura
  const total = ORDEN_ESTADOS.reduce((suma, e) => suma + reparto[e], 0)

  return (
    <section className="bandeja aparecer" aria-labelledby="veredicto-titular">
      <div className="nucleo px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
          {/* ── La frase ─────────────────────────────────────────────── */}
          <div className="min-w-0 max-w-[46ch] flex-1">
            <p className="cifra text-xs text-muted-foreground">
              {periodo.etiqueta}
            </p>
            <h1
              id="veredicto-titular"
              className="font-display mt-2 text-[1.6rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-[2rem]"
            >
              {titular}
            </h1>
            {detalle && (
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{detalle}</p>
            )}
          </div>

          {/* ── El número ──────────────────────────────────────────────
              En tinta, no en el color del estado. La audacia de este bloque
              es el TAMAÑO; añadirle además el color del semáforo lo convierte
              en un adorno de marca y, peor, gasta el rojo y el ámbar en algo
              que ya dice la frase de al lado con palabras. El estado va en su
              semáforo, pequeño, con marca y palabra, como en todo el sistema. */}
          {cumplimiento !== null && (
            <div className="shrink-0 text-right">
              <p
                className="cifra leading-none font-semibold tracking-tighter tabular-nums"
                style={{
                  // .cifra fija la mono; la display se devuelve en línea sin
                  // perder los tabular-nums, que viven en otra propiedad.
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(3rem, 8vw, 4.5rem)',
                }}
              >
                {formatearCumplimiento(cumplimiento)}
              </p>
              <div className="mt-2 flex items-center justify-end gap-2">
                <span className="eyebrow">del plan del mes</span>
                <Semaforo estado={tono} tamano="sm" />
              </div>
            </div>
          )}
        </div>

        {/* ── Reparto de estados ─────────────────────────────────────────
            Una tira apilada de 6 px. No lleva números encima: los cuenta la
            leyenda de debajo, con palabra y color, que es lo que se puede
            leer en voz alta o sin distinguir el rojo. */}
        {total > 0 && (
          <div className="mt-6">
            <div
              className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label={
                'Reparto de indicadores: ' +
                ORDEN_ESTADOS.filter((e) => reparto[e] > 0)
                  .map((e) => `${reparto[e]} ${ETIQUETAS_ESTADO[e].toLowerCase()}`)
                  .join(', ')
              }
            >
              {ORDEN_ESTADOS.map((estado) =>
                reparto[estado] === 0 ? null : (
                  <span
                    key={estado}
                    className="transicion-fluida h-full transition-[flex-grow] duration-500"
                    style={{
                      flexGrow: reparto[estado],
                      // 'sin-dato' es ausencia, no juicio: se pinta hueco.
                      backgroundColor:
                        estado === 'sin-dato'
                          ? 'color-mix(in oklab, var(--foreground) 10%, transparent)'
                          : varEstado(estado),
                    }}
                  />
                ),
              )}
            </div>

            <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {ORDEN_ESTADOS.map((estado) =>
                reparto[estado] === 0 ? null : (
                  <li
                    key={estado}
                    className="flex items-baseline gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block size-1.5 shrink-0 translate-y-[-1px] rounded-full"
                      style={{
                        backgroundColor:
                          estado === 'sin-dato'
                            ? 'color-mix(in oklab, var(--foreground) 22%, transparent)'
                            : varEstado(estado),
                      }}
                    />
                    <span className="cifra font-medium text-foreground">{reparto[estado]}</span>
                    <span>{ETIQUETAS_ESTADO[estado].toLowerCase()}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

/** Se exporta el token suave por si algún consumidor quiere el fondo a juego. */
export { varEstadoSuave }
