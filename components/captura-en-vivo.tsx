'use client'

/**
 * El panel de la derecha de la captura: cómo va, contra el plan, el bloque
 * que se está escribiendo.
 *
 * Es un gráfico de barras sencillo, a propósito. Cada fila es una barra con
 * su porcentaje del plan, sobre una escala común en la que una raya fina
 * marca el 100 %. Llegar a la raya es cumplir; pasarla es hacer más de lo
 * previsto. El color es el juicio (verde en plan, ámbar cerca del plan, rojo
 * fuera del plan) y siempre va con su palabra al lado: el color nunca viaja
 * solo.
 *
 * Se recalcula en cada pulsación, así que quien captura ve al momento si lo
 * que acaba de escribir deja el canal dentro o fuera del plan. Arriba va el
 * total del bloque, más grueso; debajo, sus filas.
 */

import type { LucideIcon } from 'lucide-react'

import { IconoEnPastilla } from '@/components/graficos/hoja'
import { Semaforo, varEstado } from '@/components/semaforo'
import { calcularEstado, formatearValor } from '@/lib/comparacion'
import type { Direccion, Unidad } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/**
 * Hasta dónde llega la escala: el 150 % del plan. Así la raya del plan cae
 * en dos tercios del ancho y se ve cuánto se pasa, sin que un 300 % aplaste
 * al resto.
 */
const TOPE = 1.5
const RAYA_PLAN = `${(1 / TOPE) * 100}%`

export interface FilaEnVivo {
  id: string
  nombre: string
  unidad: Unidad
  direccion: Direccion
  real: number | null
  plan: number | null
}

export interface CapturaEnVivoProps {
  titulo: string
  Icono: LucideIcon
  color: string
  /** «Agosto 2026» o «16–31 ago 2026». */
  periodo: string
  /** El total del bloque, si lo tiene: va arriba y más grueso. */
  total: FilaEnVivo | null
  filas: FilaEnVivo[]
}

export function CapturaEnVivo({ titulo, Icono, color, periodo, total, filas }: CapturaEnVivoProps) {
  return (
    <aside aria-label={`Cómo va ${titulo} frente al plan`} className="bandeja">
      <div className="nucleo px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <IconoEnPastilla Icono={Icono} color={color} tamano="sm" />
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] leading-tight font-semibold text-foreground">{titulo}</p>
            <p className="text-xs text-muted-foreground">{periodo}</p>
          </div>
        </div>

        {total && (
          <div className="mt-4 border-b pb-4" style={{ borderColor: 'var(--regla-fina)' }}>
            <Barra fila={total} fuerte />
          </div>
        )}

        <ul className={cn('space-y-3.5', total ? 'mt-4' : 'mt-5')}>
          {filas.map((fila) => (
            <li key={fila.id}>
              <Barra fila={fila} />
            </li>
          ))}
        </ul>

        <p className="mt-4 flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
          <span aria-hidden="true" className="h-3 w-px" style={{ backgroundColor: 'var(--foreground)' }} />
          La raya es el plan
        </p>
      </div>
    </aside>
  )
}

function Barra({ fila, fuerte = false }: { fila: FilaEnVivo; fuerte?: boolean }) {
  const { real, plan, unidad, direccion } = fila
  const hayPlan = plan !== null && plan > 0
  const cumplimiento = hayPlan && real !== null ? real / plan : null
  const estado = calcularEstado(cumplimiento, direccion)
  const largo = cumplimiento === null ? 0 : Math.min(cumplimiento, TOPE) / TOPE

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn('truncate text-foreground', fuerte ? 'text-sm font-semibold' : 'text-[0.8125rem]')}>
          {fila.nombre}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {real !== null && (
            <span className={cn('text-foreground', fuerte ? 'font-semibold' : 'font-medium')}>
              {formatearValor(real, unidad)}
            </span>
          )}
          {hayPlan ? ` de ${formatearValor(plan, unidad)}` : real !== null ? ' sin plan' : 'sin plan'}
        </span>
      </div>

      {hayPlan && (
        <div className="mt-1.5 flex items-center gap-3">
          <div
            className={cn('relative flex-1 rounded-full', fuerte ? 'h-2.5' : 'h-1.5')}
            style={{ backgroundColor: 'color-mix(in oklab, var(--foreground) 7%, transparent)' }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-300 ease-(--ease-fluid)"
              style={{ width: `${largo * 100}%`, backgroundColor: varEstado(estado) }}
            />
            {/* La raya del plan, por encima de la barra. */}
            <span
              aria-hidden="true"
              className="absolute -inset-y-1 w-px"
              style={{ left: RAYA_PLAN, backgroundColor: 'var(--foreground)' }}
            />
          </div>
          <Semaforo
            estado={estado}
            cumplimiento={fuerte ? cumplimiento : null}
            className={fuerte ? 'w-36 justify-end' : 'w-24 justify-end'}
          />
        </div>
      )}
    </div>
  )
}
