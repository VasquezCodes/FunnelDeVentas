/**
 * Tarjeta de indicador: la unidad de lectura del tablero.
 *
 * Deliberadamente NO es una gráfica. Un sparkline dentro de una tarjeta
 * obliga a estimar una posición para leer un valor que ya conocemos con
 * exactitud; aquí la cifra se imprime y se acabó. La única codificación
 * gráfica es la barra de cumplimiento, y solo porque compara dos números
 * (real y meta) contra un mismo tope, que es justo lo que una cifra suelta
 * no deja ver de un vistazo.
 *
 * Jerarquía de lectura, de arriba abajo:
 *   1. El real, enorme. Es la respuesta a «¿cómo vamos?».
 *   2. Meta y desviación, en una línea discreta. El contexto.
 *   3. La barra de 3 px. El resumen periférico, se lee sin mirarlo.
 *   4. El semáforo, arriba a la derecha, donde el ojo aterriza al barrer
 *      una rejilla de tarjetas buscando el problema.
 *
 * Sin 'use client': no hay estado ni efectos. El tooltip sí es cliente,
 * pero es él quien cruza la frontera, no la tarjeta entera.
 */

import { InfoIcon } from '@phosphor-icons/react/ssr'
import { cn } from 'cn'

import { Semaforo, varEstado } from '@/components/semaforo'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { esDesviacionFavorable, formatearDesviacion, formatearValor } from '@/lib/comparacion'
import type { Comparativa } from '@/lib/tipos'

export interface TarjetaKpiProps {
  c: Comparativa
  /** Tipografía y semáforo un punto mayores. Para el indicador cabecera. */
  destacada?: boolean
  className?: string
}

export function TarjetaKpi({ c, destacada = false, className }: TarjetaKpiProps) {
  const { indicador, meta, real, desviacion, cumplimiento, estado } = c

  /**
   * El signo de la desviación NO decide el color: lo decide la dirección del
   * indicador. En «coste por lead» (menor-mejor) un −4 € es una buena noticia
   * y pintarlo de rojo sería mentir con el color. Todo ese razonamiento vive
   * una sola vez, en `esDesviacionFavorable`.
   */
  const favorable = esDesviacionFavorable(desviacion, indicador.direccion)
  const colorDesviacion =
    favorable === null
      ? 'var(--muted-foreground)' // desviación 0 o sin dato: ni premio ni castigo
      : favorable
        ? varEstado('en-plan')
        : varEstado('fuera')

  /**
   * Barra de cumplimiento.
   *
   * `relleno` es la parte que llega a la meta, recortada a 1: la barra nunca
   * se desborda ni reescala el resto de tarjetas de la rejilla, así que 100 %
   * significa lo mismo en todas y se pueden comparar de un barrido.
   *
   * `exceso` es lo que pasa de la meta, dibujado desde el borde derecho hacia
   * dentro con el mismo color al 100 % de saturación (el relleno va al 72 %).
   * Se insinúa, no se celebra: en un indicador menor-mejor pasarse de la meta
   * es malo, y como el color lo pone el estado, ese exceso aparece en rojo.
   * El tope de 1 evita que un 400 % pinte la barra entera de exceso.
   *
   * La barra mide siempre el ratio crudo real/meta, sin invertirlo para los
   * menor-mejor: la longitud dice «cuánto hay respecto al plan» y el color
   * dice «si eso está bien». Dos canales, un significado cada uno; invertir
   * también la longitud haría que la barra más larga fuera unas veces la
   * mejor y otras la peor, que es exactamente lo que no queremos al barrer
   * una rejilla de tarjetas.
   */
  const relleno = cumplimiento === null ? 0 : Math.min(Math.max(cumplimiento, 0), 1)
  const exceso = cumplimiento === null ? 0 : Math.min(Math.max(cumplimiento - 1, 0), 1)

  const nombre = indicador.nombre

  return (
    <div
      className={cn(
        'bandeja transicion-fluida transition-[box-shadow,transform] duration-300',
        'hover:[box-shadow:var(--sombra-alta)] active:scale-[0.99]',
        className,
      )}
      style={
        destacada
          ? // Único distintivo de la destacada: un hairline algo más presente.
            // Nada de carmín: el color de marca jamás entra en un dato.
            { borderColor: 'color-mix(in oklab, var(--foreground) 13%, transparent)' }
          : undefined
      }
    >
      <div className={cn('nucleo flex flex-col', destacada ? 'gap-4 p-5' : 'gap-3 p-4')}>
        {/* ── Cabecera: nombre + semáforo ───────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          {indicador.definicion ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  // Es un <button> real: se alcanza con el tabulador y el
                  // tooltip se abre también con el teclado, no solo al pasar
                  // el ratón. Un <span title=""> no haría ni una cosa ni otra.
                  className="eyebrow group/def transicion-fluida inline-flex items-center gap-1 rounded-sm text-left transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span>{nombre}</span>
                  <InfoIcon
                    weight="duotone"
                    className="size-3 shrink-0 opacity-45 transition-opacity group-hover/def:opacity-90"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Ver cómo se calcula</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[22rem] leading-relaxed">
                  {indicador.definicion}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="eyebrow">{nombre}</span>
          )}

          <Semaforo
            estado={estado}
            cumplimiento={cumplimiento}
            tamano={destacada ? 'md' : 'sm'}
          />
        </div>

        {/* ── Cifra real + contexto ─────────────────────────────────── */}
        <div>
          <p
            className={cn(
              'cifra font-display leading-none tracking-tight',
              destacada ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl',
              real === null && 'text-muted-foreground',
            )}
            // .cifra y .font-display están en la misma capa de utilidades y
            // ambas fijan font-family; como .cifra se declara después, gana
            // ella. El estilo en línea devuelve la serif de display sin
            // perder los tabular-nums de .cifra (que viven en
            // font-variant-numeric, no en la familia). Si algún día se
            // reordena globals.css poniendo .font-display al final, esta
            // línea sobra.
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {formatearValor(real, indicador.unidad)}
          </p>

          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              Meta <span className="cifra text-foreground/70">{formatearValor(meta, indicador.unidad)}</span>
            </span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            {/* El signo (+ / −) ya distingue las dos direcciones sin recurrir
                al color: quien no vea el verde sigue leyendo el dato. */}
            <span className="cifra font-medium" style={{ color: colorDesviacion }}>
              {formatearDesviacion(desviacion, indicador.unidad)}
            </span>
          </p>
        </div>

        {/* ── Barra de cumplimiento ─────────────────────────────────────
            aria-hidden: no aporta nada a un lector de pantalla, que ya ha
            leído el porcentaje exacto dentro del semáforo. */}
        <div
          aria-hidden="true"
          className="relative mt-auto h-[3px] w-full overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--muted)' }}
        >
          <div
            className="transicion-fluida absolute inset-0 origin-left transition-transform duration-500"
            style={{
              // scaleX y no width: la anchura dispara layout en cada cambio
              // de periodo; la transformada se resuelve en la GPU.
              transform: `scaleX(${relleno})`,
              backgroundColor: `color-mix(in oklab, ${varEstado(estado)} 72%, transparent)`,
            }}
          />
          {exceso > 0 && (
            <div
              className="transicion-fluida absolute inset-0 origin-right transition-transform duration-500"
              style={{
                transform: `scaleX(${exceso})`,
                backgroundColor: varEstado(estado),
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
