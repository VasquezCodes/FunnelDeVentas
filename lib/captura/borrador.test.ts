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
  const real = (indicadorId: string, valor: number) => ({
    periodoId: '2026-09-Q1',
    indicadorId,
    valor,
    origen: 'manual' as const,
  })

  it('pasa lo guardado a texto editable, solo lo que se teclea en el plan', () => {
    const reales = [real('eleads.publicidad', 30), real('eleads', 30), real('discoveries', 12)]
    expect(aBorrador(reales, new Set(['eleads.publicidad', 'discoveries']))).toEqual({
      'eleads.publicidad': '30',
      discoveries: '12',
    })
  })

  it('con Discoveries por canal, la cifra de Discoveries ya no es una casilla', () => {
    const reales = [real('discoveries', 12), real('discoveries.publicidad', 7)]
    expect(aBorrador(reales, new Set(['discoveries.publicidad']))).toEqual({
      'discoveries.publicidad': '7',
    })
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
