import { describe, expect, it } from 'vitest'

import { ETIQUETAS_ESTADO, calcularEstado, formatearValor } from '@/lib/comparacion'

/**
 * Los cuatro tramos, sobre una base de 100 % del plan. Es la escala que pidió
 * el equipo y la que se lee en pantalla, así que se fija aquí: cambiar un
 * corte sin querer rompe estas pruebas antes que el tablero.
 */
describe('calcularEstado, indicadores de «mayor mejor»', () => {
  const estado = (c: number) => calcularEstado(c, 'mayor-mejor')

  it('más de un 5 % por encima: mejor que el plan', () => {
    expect(estado(1.06)).toBe('mejor')
    expect(estado(1.4)).toBe('mejor')
  })

  it('el 5 % de arriba y de abajo: en plan', () => {
    expect(estado(1.05)).toBe('en-plan')
    expect(estado(1)).toBe('en-plan')
    expect(estado(0.95)).toBe('en-plan')
  })

  it('entre un 5 % y un 20 % por debajo: cerca del plan', () => {
    expect(estado(0.94)).toBe('cerca')
    expect(estado(0.8)).toBe('cerca')
  })

  it('más de un 20 % por debajo: fuera del plan', () => {
    expect(estado(0.79)).toBe('fuera')
    expect(estado(0)).toBe('fuera')
  })

  it('sin cumplimiento no hay juicio', () => {
    expect(estado(NaN)).toBe('sin-dato')
    expect(calcularEstado(null, 'mayor-mejor')).toBe('sin-dato')
  })
})

/**
 * El gasto lleva la misma escala por el otro lado: pasarse es lo malo. Se
 * comprueba con los mismos cortes, no con otros, porque el motor refleja el
 * cumplimiento en vez de invertir el dato.
 */
describe('calcularEstado, indicadores de «menor mejor» (el gasto)', () => {
  const estado = (c: number) => calcularEstado(c, 'menor-mejor')

  it('gastar más de un 5 % por debajo del plan: mejor que el plan', () => {
    expect(estado(0.94)).toBe('mejor')
    expect(estado(0.6)).toBe('mejor')
  })

  it('gastar dentro del 5 %, arriba o abajo: en plan', () => {
    expect(estado(0.95)).toBe('en-plan')
    expect(estado(1)).toBe('en-plan')
    expect(estado(1.05)).toBe('en-plan')
  })

  it('pasarse entre un 5 % y un 20 %: cerca del plan', () => {
    expect(estado(1.06)).toBe('cerca')
    expect(estado(1.2)).toBe('cerca')
  })

  it('pasarse más de un 20 %: fuera del plan', () => {
    expect(estado(1.21)).toBe('fuera')
    expect(estado(1.8)).toBe('fuera')
  })

  it('es simétrico con «mayor mejor»: desviarse un 20 % al lado malo pesa igual', () => {
    expect(calcularEstado(0.8, 'mayor-mejor')).toBe(calcularEstado(1.2, 'menor-mejor'))
    expect(calcularEstado(0.79, 'mayor-mejor')).toBe(calcularEstado(1.21, 'menor-mejor'))
  })
})

describe('ETIQUETAS_ESTADO', () => {
  it('cada estado tiene su palabra, y habla de plan', () => {
    expect(ETIQUETAS_ESTADO).toEqual({
      mejor: 'Mejor que el plan',
      'en-plan': 'En plan',
      cerca: 'Cerca del plan',
      fuera: 'Fuera del plan',
      'sin-dato': 'Sin dato',
    })
  })
})

describe('formatearValor, cantidades', () => {
  it('un entero va sin decimales: son leads, llamadas, clics', () => {
    expect(formatearValor(95880, 'cantidad')).toBe('95.880')
    expect(formatearValor(0, 'cantidad')).toBe('0')
  })

  it('una cantidad con decimales los enseña: el plan tiene 1,17 reactivaciones', () => {
    // Redondeada a entero salía «1 de 1» con «Cerca del plan» al lado: la
    // cifra decía que cuadraba y el juicio decía que no.
    expect(formatearValor(1.17, 'cantidad')).toBe('1,17')
    expect(formatearValor(0.7, 'cantidad')).toBe('0,7')
  })

  it('el juicio no cambia: sigue saliendo de las cifras sin redondear', () => {
    expect(calcularEstado(1 / 1.17, 'mayor-mejor')).toBe('cerca')
  })
})
