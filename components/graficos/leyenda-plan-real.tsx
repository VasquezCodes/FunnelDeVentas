/**
 * Leyenda del par plan / real.
 *
 * Cada muestra tiene la FORMA de su marca, no un cuadradito de color: en
 * barras, la del plan es fina y la del real gruesa, con el arranque recto y
 * la punta redondeada, igual que en el gráfico. Así la leyenda se entiende
 * aunque el gris y la tinta se confundan (una impresión en blanco y negro,
 * una pantalla lavada): el grosor ya dice cuál es cuál.
 *
 * Dos series siempre llevan leyenda, aunque el título de la sección ya hable
 * de «plan»: sin ella hay que adivinar qué gris es cuál. El texto va en
 * tokens de texto, nunca en el color de la serie; el gris del plan no pasa
 * el contraste de un texto.
 *
 * `forma="lineas"` queda preparada para la Serie: el plan es una proyección
 * y va discontinuo; el real es un trazo continuo de 2 px.
 */

import { MESES_DE_RITMO } from '@/lib/proyeccion'
import { cn } from '@/lib/utils'

export interface LeyendaPlanRealProps {
  forma?: 'barras' | 'lineas'
  /**
   * Añade la proyección: el mes que todavía no tiene resultado, calculado
   * con el plan de ese mes al ritmo de cumplimiento de los últimos meses
   * cerrados (`lib/proyeccion.ts`). La leyenda dice con cuántos meses se
   * hizo, porque una proyección sin su método es una cifra caída del cielo.
   */
  proyeccion?: boolean
  /** Cuántos meses cerrados entran en el ritmo, para decirlo en la leyenda. */
  mesesDeRitmo?: number
  className?: string
}

export function LeyendaPlanReal({
  forma = 'barras',
  proyeccion = false,
  mesesDeRitmo = MESES_DE_RITMO,
  className,
}: LeyendaPlanRealProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs', className)}>
      <span className="flex items-center gap-2 text-muted-foreground">
        <MuestraPlan forma={forma} />
        Plan
      </span>
      <span className="flex items-center gap-2 text-foreground">
        <MuestraReal forma={forma} />
        Real
      </span>
      {proyeccion && (
        <span className="flex items-center gap-2 text-muted-foreground">
          <MuestraPunteada />
          Proyección (últimos {mesesDeRitmo} meses)
        </span>
      )}
    </div>
  )
}

/**
 * El trazo de la proyección: punteado y rematado con un anillo discontinuo,
 * igual que en el gráfico. Si la leyenda dibujara otra cosa no serviría para
 * leerlo.
 */
function MuestraPunteada() {
  return (
    <svg aria-hidden="true" width="26" height="10" className="shrink-0">
      <line
        x1="1"
        x2="18"
        y1="5"
        y2="5"
        stroke="var(--serie-real)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0.1 4"
      />
      <circle
        cx="21.5"
        cy="5"
        r="3"
        fill="var(--card)"
        stroke="var(--serie-real)"
        strokeWidth="1.75"
        strokeDasharray="1.4 1.4"
      />
    </svg>
  )
}

/* Las proporciones repiten las del Embudo (8 px contra 14 px) a la mitad.
   Las dos muestras van en px, no en rem: las barras del gráfico también son
   px fijos, y con `h-1` (0,25 rem) la del plan crecía con la escala de la
   raíz en pantallas anchas mientras la del real no, y la proporción se
   desviaba. */

function MuestraPlan({ forma }: { forma: 'barras' | 'lineas' }) {
  if (forma === 'lineas') {
    return (
      <span
        aria-hidden="true"
        className="inline-block w-5 border-t-2 border-dashed"
        style={{ borderColor: 'var(--serie-plan)' }}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[4px] w-4 rounded-r-[2px]"
      style={{ backgroundColor: 'var(--serie-plan)' }}
    />
  )
}

function MuestraReal({ forma }: { forma: 'barras' | 'lineas' }) {
  if (forma === 'lineas') {
    return (
      <span
        aria-hidden="true"
        className="inline-block h-0.5 w-5 rounded-full"
        style={{ backgroundColor: 'var(--serie-real)' }}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[7px] w-4 rounded-r-[3px]"
      style={{ backgroundColor: 'var(--serie-real)' }}
    />
  )
}
