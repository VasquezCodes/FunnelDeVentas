import { describe, expect, it } from 'vitest'

import { tramoEnCurso } from '@/components/graficos/tramo-en-curso'

const serie = [
  { id: 'a', real: 10 },
  { id: 'b', real: 12 },
  { id: 'c', real: 5 },
]

describe('tramoEnCurso', () => {
  it('sin mes en curso no cambia nada', () => {
    expect(tramoEnCurso(serie, -1)).toEqual(serie.map((d) => ({ ...d, realEnCurso: null })))
  })
  it('separa el último tramo: el real acaba antes y el tramo une los dos meses', () => {
    expect(tramoEnCurso(serie, 2)).toEqual([
      { id: 'a', real: 10, realEnCurso: null },
      { id: 'b', real: 12, realEnCurso: 12 },
      { id: 'c', real: null, realEnCurso: 5 },
    ])
  })
  it('en curso el primero: queda un punto suelto', () => {
    expect(tramoEnCurso(serie, 0)[0]).toEqual({ id: 'a', real: null, realEnCurso: 10 })
  })
  it('un mes en curso sin real no se toca', () => {
    const conHueco = [
      { id: 'a', real: 10 },
      { id: 'b', real: null },
    ]
    expect(tramoEnCurso(conHueco, 1)).toEqual(conHueco.map((d) => ({ ...d, realEnCurso: null })))
  })
})
