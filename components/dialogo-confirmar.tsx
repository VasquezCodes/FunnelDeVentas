'use client'

/**
 * El cuadro que pregunta antes de perder algo.
 *
 * Sustituye a `window.confirm`, que pintaba una caja gris del navegador con
 * «localhost:3000 dice» encima del tablero: fuera del sistema de la app,
 * imposible de traducir bien y con un remite que en producción enseña el
 * dominio. Este es el mismo cuadro que `DialogoClave` —<dialog> nativo, con
 * el fondo inerte, el foco atrapado y Escape para cerrar que ya da el
 * navegador— y la misma tarjeta, tipografía y botones del resto.
 *
 * ── Confirmar dejó de ser una pregunta con respuesta inmediata ───────────
 * `window.confirm` PARA el hilo y devuelve true o false, así que quien
 * llamaba podía escribir `if (puedeSalir()) hazlo()`. Un cuadro de verdad no
 * para nada: se abre, y la respuesta llega después. Por eso este componente
 * recibe la acción pendiente y la ejecuta él al confirmar. Quien lo usa
 * guarda «lo que iba a hacer» en vez de preguntar si puede.
 *
 * `tono="peligro"` pinta el botón en el rojo de los estados, no en el carmín
 * de marca: el carmín es la acción normal de la casa, y esto es perder
 * trabajo.
 */

import { useEffect, useId, useRef } from 'react'
import { WarningIcon } from '@phosphor-icons/react/ssr'

import { cn } from '@/lib/utils'

export interface DialogoConfirmarProps {
  abierto: boolean
  titulo: string
  descripcion: string
  /** El botón que sigue adelante. */
  accion?: string
  cancelar?: string
  tono?: 'marca' | 'peligro'
  onConfirmar: () => void
  onCancelar: () => void
}

export function DialogoConfirmar({
  abierto,
  titulo,
  descripcion,
  accion = 'Continuar',
  cancelar = 'Cancelar',
  tono = 'peligro',
  onConfirmar,
  onCancelar,
}: DialogoConfirmarProps) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const confirmar = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  // El foco arranca en Cancelar —lo pone el navegador en el primer botón—,
  // que es lo prudente cuando lo que está en juego es perder cambios: pulsar
  // Intro sin leer no destruye nada.

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-descripcion`}
      onCancel={(evento) => {
        evento.preventDefault()
        onCancelar()
      }}
      // Pulsar el fondo cancela: el clic llega al <dialog> solo fuera de su caja.
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onCancelar()
      }}
      className="aparecer m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-foreground shadow-(--sombra-alta) backdrop:bg-[color-mix(in_oklab,var(--foreground)_32%,transparent)]"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="p-6">
        <h2
          id={`${id}-titulo`}
          className="font-display flex items-center gap-2 text-xl leading-tight font-semibold"
        >
          <WarningIcon
            weight="duotone"
            aria-hidden="true"
            className="size-5 shrink-0"
            style={{ color: tono === 'peligro' ? 'var(--estado-critico)' : 'var(--brand)' }}
          />
          {titulo}
        </h2>
        <p id={`${id}-descripcion`} className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {descripcion}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="h-10 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {cancelar}
          </button>
          <button
            ref={confirmar}
            type="button"
            onClick={onConfirmar}
            className={cn(
              'h-10 rounded-full px-5 text-sm font-medium text-white transition-opacity hover:opacity-90',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
            style={{
              backgroundColor: tono === 'peligro' ? 'var(--estado-critico)' : 'var(--brand)',
            }}
          >
            {accion}
          </button>
        </div>
      </div>
    </dialog>
  )
}
