/**
 * La hoja: el marco de los paneles del carrusel, salvo la Serie.
 *
 * Una tarjeta con borde de 1 px y radio de 14 px, sin sombra, y una
 * cabecera fija: a la izquierda, cómo se lee (la leyenda); a la derecha, el
 * mes que se mira. Debajo, cada panel pone su pieza: el Embudo la divide en
 * fichas con filetes; los Canales y el Dinero dibujan dentro su gráfico.
 *
 * `data-entrada-pendiente` va puesto de serie: todas las hojas tienen
 * entrada dibujada, y hasta que hidrata el CSS global oculta su velo (ver
 * `useEntradaGrafico`, que quita el atributo al tomar el mando).
 */

import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export function Hoja({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="tarjeta-grafico"
      data-entrada-pendiente=""
      className={cn(
        'relative overflow-hidden rounded-[14px] border border-border bg-card text-card-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function CabeceraHoja({
  leyenda,
  mes,
  style,
}: {
  leyenda: ReactNode
  /** El mes que se mira, con su año: «Septiembre 2026». */
  mes?: string
  style?: CSSProperties
}) {
  return (
    <div
      // La entrada la usa como «respuesta en pantalla»: si la cabecera se ve
      // entera, la hoja cuenta como a la vista aunque asome cortada.
      data-cabecera-grafico
      className="flex min-h-12 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-5 py-3"
      style={{ borderColor: 'var(--regla-fina)', ...style }}
    >
      {leyenda}
      {mes && <p className="text-xs font-medium text-foreground tabular-nums">{mes}</p>}
    </div>
  )
}

/**
 * Un icono de Lucide en su pastilla: el trazo en el color de la entidad y
 * una aguada del mismo color detrás. Es el duotono de los iconos Phosphor
 * del resto del tablero hecho con dos piezas, para que las dos familias
 * convivan sin que el cambio de trazo se note.
 */
export function IconoEnPastilla({
  Icono,
  color,
  tamano = 'md',
}: {
  Icono: LucideIcon
  color: string
  tamano?: 'sm' | 'md'
}) {
  const pequeno = tamano === 'sm'
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center',
        pequeno ? 'size-6 rounded-md' : 'size-7 rounded-lg',
      )}
      style={{ backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)` }}
    >
      <Icono size={pequeno ? 14 : 16} strokeWidth={1.75} color={color} />
    </span>
  )
}
