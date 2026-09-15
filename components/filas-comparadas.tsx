/**
 * Filas de plan contra real, con una escala compartida.
 *
 * ── Escala única ─────────────────────────────────────────────────────────
 * Todas las barras se miden contra el mismo máximo. Es lo que hace honesta
 * la comparación entre filas: «altas ARCO» es corta porque hay poco, no
 * porque cada fila se haya reescalado a su propio ancho. Reescalar por fila
 * es el error clásico de estos gráficos y convierte una comparación en una
 * ilusión óptica.
 *
 * ── Dos barras, no una encima de otra ────────────────────────────────────
 * El plan es una barra fina y el real una gruesa, emparejadas. Superponer el
 * real sobre un «fantasma» del plan tiene dos fallos: si el real se pasa,
 * tapa el plan por completo y ya no se ve por cuánto; si se queda corto, el
 * trozo de fantasma que asoma parece un segmento con valor propio. Así, la
 * distancia horizontal entre los dos extremos ES la desviación, y se mide a
 * ojo en los dos sentidos.
 *
 * Sin SVG: son filas de una lista, y una lista de divs se compone, se envuelve
 * y se lee por un lector de pantalla mejor que un lienzo dibujado a mano.
 */

import { cn } from 'cn'

import type { Comparativa } from '@/lib/tipos'
import { formatearValor } from '@/lib/comparacion'
import { varEstado } from '@/components/semaforo'

/** Un valor mayor que cero nunca desaparece: si no, 0 y «casi 0» se confunden. */
const MINIMO_VISIBLE = 0.004

export interface FilasComparadasProps {
  comparativas: Comparativa[]
  /** Marca la fila del total, que se separa y se imprime más fuerte. */
  destacarId?: string
  className?: string
}

export function FilasComparadas({ comparativas, destacarId, className }: FilasComparadasProps) {
  const maximo = comparativas.reduce(
    (mayor, c) => Math.max(mayor, c.meta ?? 0, c.real ?? 0),
    0,
  )

  const ancho = (valor: number | null): number => {
    if (valor === null || maximo <= 0 || valor <= 0) return 0
    return Math.max(MINIMO_VISIBLE, valor / maximo)
  }

  return (
    <ul className={cn('flex flex-col', className)}>
      {comparativas.map((c) => {
        const destacada = c.indicador.id === destacarId
        const { indicador, meta, real } = c

        return (
          <li
            key={indicador.id}
            className={cn(
              'renglon grid grid-cols-[minmax(7rem,1fr)_minmax(0,2.2fr)_auto] items-center gap-x-4 py-3 sm:gap-x-6',
              destacada && 'border-t-transparent',
            )}
          >
            <span
              className={cn(
                'min-w-0 truncate text-sm',
                destacada ? 'font-display text-base font-semibold' : 'font-medium',
              )}
            >
              {indicador.nombre}
            </span>

            {/* Par de barras. Nacen todas en el mismo origen, a la izquierda. */}
            <div className="flex flex-col gap-[3px]" aria-hidden="true">
              <Barra fraccion={ancho(meta)} alto={destacada ? 6 : 5} color="var(--serie-plan)" />
              <Barra
                fraccion={ancho(real)}
                alto={destacada ? 13 : 11}
                color={real === null ? 'transparent' : 'var(--serie-real)'}
                vacia={real === null}
              />
            </div>

            {/* Las cifras se alinean cada una con SU barra, así ninguna
                necesita etiqueta para saberse cuál es. */}
            <div className="flex flex-col items-end gap-[3px] tabular-nums">
              <span className="cifra text-[0.6875rem] leading-[6px] text-muted-foreground">
                {formatearValor(meta, indicador.unidad)}
              </span>
              <span
                className={cn(
                  'cifra leading-[13px]',
                  destacada ? 'text-base font-semibold' : 'text-sm font-medium',
                )}
                style={real !== null && destacada ? { color: varEstado(c.estado) } : undefined}
              >
                {formatearValor(real, indicador.unidad)}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Barra({
  fraccion,
  alto,
  color,
  vacia = false,
}: {
  fraccion: number
  alto: number
  color: string
  vacia?: boolean
}) {
  if (vacia) {
    // Sin dato: una raya neutra corta en el origen. No es un cero, y no debe
    // parecerlo — un cero es una afirmación y esto es una ausencia.
    return (
      <div
        className="w-4 rounded-full"
        style={{ height: alto, backgroundColor: 'var(--estado-neutro)', opacity: 0.45 }}
      />
    )
  }

  return (
    <div className="w-full" style={{ height: alto }}>
      <div
        className="transicion-fluida h-full origin-left rounded-r-[3px] transition-transform duration-500"
        style={{ transform: `scaleX(${fraccion})`, backgroundColor: color }}
      />
    </div>
  )
}
