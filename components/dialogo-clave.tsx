'use client'

/**
 * El cuadro que pide la contraseña antes de guardar.
 *
 * Es un <dialog> nativo abierto con showModal(): el navegador ya da el fondo
 * inerte, el foco atrapado dentro y Escape para cerrar. No hace falta una
 * librería para eso.
 *
 * El campo no está controlado por React: la contraseña se lee del formulario
 * al enviar y se borra del DOM tras un fallo. Así no vive en el estado de
 * ningún componente más tiempo del necesario.
 */

import { useEffect, useId, useRef } from 'react'
import { LockKeyIcon, WarningIcon } from '@phosphor-icons/react/ssr'

import { Input } from '@/components/ui/input'

export interface DialogoClaveProps {
  abierto: boolean
  guardando: boolean
  /** El motivo del último fallo («Contraseña incorrecta.»), o null. */
  error: string | null
  cambios: number
  onConfirmar: (clave: string) => void
  onCancelar: () => void
}

export function DialogoClave({
  abierto,
  guardando,
  error,
  cambios,
  onConfirmar,
  onCancelar,
}: DialogoClaveProps) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const id = useId()

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  // Tras un fallo, el campo se vacía y recupera el foco para volver a teclear.
  useEffect(() => {
    if (!error || !campo.current) return
    campo.current.value = ''
    campo.current.focus()
  }, [error])

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={`${id}-titulo`}
      onCancel={(evento) => {
        evento.preventDefault()
        if (!guardando) onCancelar()
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-foreground shadow-(--sombra-alta) backdrop:bg-[color-mix(in_oklab,var(--foreground)_32%,transparent)]"
      style={{ borderColor: 'var(--border)' }}
    >
      <form
        className="p-6"
        onSubmit={(evento) => {
          evento.preventDefault()
          const clave = String(new FormData(evento.currentTarget).get('clave') ?? '')
          if (clave) onConfirmar(clave)
        }}
      >
        <h2
          id={`${id}-titulo`}
          className="font-display flex items-center gap-2 text-xl leading-tight font-semibold"
        >
          <LockKeyIcon weight="duotone" aria-hidden="true" className="size-5 shrink-0 text-brand" />
          Confirmar cambios
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {cambios === 1
            ? '1 cifra cambiada. Escribe la contraseña de captura para guardarla.'
            : `${cambios} cifras cambiadas. Escribe la contraseña de captura para guardarlas.`}
        </p>

        <label htmlFor={`${id}-clave`} className="mt-5 block text-sm font-medium">
          Contraseña
        </label>
        <Input
          ref={campo}
          id={`${id}-clave`}
          name="clave"
          type="password"
          autoComplete="off"
          required
          disabled={guardando}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1.5 h-10"
        />
        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="mt-2 flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--estado-critico)' }}
          >
            <WarningIcon weight="duotone" aria-hidden="true" className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="h-10 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="h-10 rounded-full bg-brand px-5 text-sm font-medium text-primary-foreground shadow-(--sombra-tray) transition-colors hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
