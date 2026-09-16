import { describe, expect, it } from 'vitest'

import {
  colorDeCumplimiento,
  colorEnPosicion,
  degradadoDeCumplimiento,
  franjaDeCumplimiento,
} from '@/lib/color-cumplimiento'
import { calcularEstado } from '@/lib/comparacion'

describe('franjaDeCumplimiento', () => {
  it('usa los umbrales del semáforo, y el plan cumplido es «más verde»', () => {
    expect(franjaDeCumplimiento(null)).toBe('sin-dato')
    expect(franjaDeCumplimiento(0.3)).toBe('critico')
    expect(franjaDeCumplimiento(0.8)).toBe('alerta')
    expect(franjaDeCumplimiento(0.95)).toBe('ok')
    expect(franjaDeCumplimiento(1)).toBe('ok-fuerte')
    expect(franjaDeCumplimiento(1.3)).toBe('ok-fuerte')
  })

  it('nunca contradice la palabra del semáforo', () => {
    for (let c = 0; c <= 1.5; c += 0.01) {
      const franja = franjaDeCumplimiento(c)
      const estado = calcularEstado(c, 'mayor-mejor')
      expect(franja === 'ok-fuerte' ? 'ok' : franja).toBe(estado)
    }
  })
})

describe('colorDeCumplimiento', () => {
  it('da el token de su franja', () => {
    expect(colorDeCumplimiento(0.5)).toBe('var(--estado-critico)')
    expect(colorDeCumplimiento(0.9)).toBe('var(--estado-alerta)')
    expect(colorDeCumplimiento(0.97)).toBe('var(--estado-ok)')
    expect(colorDeCumplimiento(1.2)).toBe('var(--estado-ok-fuerte)')
    expect(colorDeCumplimiento(null)).toBe('var(--estado-neutro)')
  })
})

describe('colorEnPosicion', () => {
  it('arranca en rojo y desde el principio va camino del amarillo', () => {
    expect(colorEnPosicion(0)).toBe('var(--estado-critico)')
    expect(colorEnPosicion(0.3)).toBe('color-mix(in oklch, var(--estado-alerta) 50%, var(--estado-critico))')
  })

  it('es amarillo hacia el 60 % y verde hacia el 90 %', () => {
    expect(colorEnPosicion(0.6)).toBe('var(--estado-alerta)')
    expect(colorEnPosicion(0.9)).toBe('var(--estado-ok)')
  })

  it('un 68 % ya no es rojo: es amarillo que empieza a verdear', () => {
    expect(colorEnPosicion(0.68)).toMatch(/^color-mix\(in oklch, var\(--estado-ok\) \d+%, var\(--estado-alerta\)\)$/)
  })

  it('termina en el verde más intenso al llegar al plan', () => {
    expect(colorEnPosicion(1)).toBe('var(--estado-ok-fuerte)')
    expect(colorEnPosicion(1.4)).toBe('var(--estado-ok-fuerte)')
  })
})

describe('degradadoDeCumplimiento', () => {
  it('es la misma escala en CSS, de 0 al plan, interpolada en oklch', () => {
    expect(degradadoDeCumplimiento()).toBe(
      'linear-gradient(in oklch 90deg, var(--estado-critico) 0%, var(--estado-alerta) 60%, var(--estado-ok) 90%, var(--estado-ok-fuerte) 100%)',
    )
  })
})
