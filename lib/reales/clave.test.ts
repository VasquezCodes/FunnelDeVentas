import { describe, expect, it } from 'vitest'

import { claveValida } from '@/lib/reales/clave'

describe('claveValida', () => {
  it('acepta la contraseña correcta', () => {
    expect(claveValida('prueba-local-2026', 'prueba-local-2026')).toBe(true)
  })
  it('rechaza una incorrecta, también de otra longitud', () => {
    expect(claveValida('otra', 'prueba-local-2026')).toBe(false)
    expect(claveValida('prueba-local-2026x', 'prueba-local-2026')).toBe(false)
  })
  it('falla cerrado si la variable no existe o está vacía', () => {
    expect(claveValida('', undefined)).toBe(false)
    expect(claveValida('', '')).toBe(false)
    expect(claveValida('algo', undefined)).toBe(false)
  })
})
