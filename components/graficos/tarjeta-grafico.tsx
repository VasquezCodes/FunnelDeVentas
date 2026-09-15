/**
 * El marco de la Serie y de los estados vacíos.
 *
 * Superficie `--card`, borde de 1 px, radio de 14 px y aire generoso. Sin
 * sombra ni degradado: el carrusel enseña una sola tarjeta cada vez, así que
 * no hay nada de lo que tenga que despegarse. La sombra se reserva para lo
 * que flota de verdad (los menús). Las fichas del Embudo, los Canales y el
 * Dinero llevan su propia hoja, con el mismo borde y radio (`fichas.tsx`).
 */

import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function TarjetaGrafico({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="tarjeta-grafico"
      // `relative`: la tarjeta es el bloque contenedor de lo que se posiciona
      // dentro, sobre todo del `div.sr-only` (absoluto) de la tabla para
      // lectores. Sin él, ese div se colocaba respecto a un antepasado fuera
      // del panel, escapaba del `height: 0; overflow: clip` con que el
      // carrusel pliega los paneles ocultos y alargaba la página con scroll
      // muerto.
      className={cn(
        'relative rounded-[14px] border border-border bg-card p-4 text-card-foreground sm:p-6',
        className,
      )}
      {...props}
    />
  )
}
