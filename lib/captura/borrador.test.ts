import { describe, expect, it } from 'vitest'

import { aBorrador, aNumero, aValores, mismoValor } from '@/lib/captura/borrador'

describe('aNumero', () => {
  it('lee la coma decimal del teclado en español', () => {
    expect(aNumero('12,5')).toBe(12.5)
  })
  it('el vacío y el separador suelto no son un número', () => {
    expect(aNumero('')).toBeNull()
    expect(aNumero(',')).toBeNull()
  })
  it('el 0 es un número', () => {
    expect(aNumero('0')).toBe(0)
  })
})

describe('aBorrador', () => {
  it('pasa lo guardado a texto editable y deja fuera los totales calculados', () => {
    const reales = [
      { periodoId: '2026-09-Q1', indicadorId: 'eleads.publicidad', valor: 30, origen: 'manual' as const },
      { periodoId: '2026-09-Q1', indicadorId: 'eleads', valor: 30, origen: 'manual' as const },
    ]
    expect(aBorrador(reales)).toEqual({ 'eleads.publicidad': '30' })
  })
})

describe('aValores', () => {
  it('solo viajan las casillas con número', () => {
    expect(aValores({ 'eleads.publicidad': '3', discoveries: '', propuestas: ',' })).toEqual({
      'eleads.publicidad': 3,
    })
  })
})

describe('mismoValor', () => {
  it('compara números, no textos', () => {
    expect(mismoValor('3', '3,0')).toBe(true)
    expect(mismoValor('', undefined)).toBe(true)
    expect(mismoValor('0', '')).toBe(false)
  })
})
