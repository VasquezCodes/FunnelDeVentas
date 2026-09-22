import { describe, expect, it } from 'vitest'

import { tramoProyectado } from '@/components/graficos/tramo-proyectado'
import type { Proyeccion, Proyectado } from '@/lib/proyeccion'

const serie = [
  { id: 'a', real: 10 },
  { id: 'b', real: 12 },
  { id: 'c', real: 5 },
  { id: 'd', real: null },
  { id: 'e', real: null },
]

/** El ritmo no lo usa el dibujo: aquí solo importan los puntos. */
const proyeccion = (puntos: Proyectado[]): Proyeccion => ({ puntos, ritmo: 1, mesesDeRitmo: 3 })

describe('tramoProyectado', () => {
  it('sin proyección no puntea nada', () => {
    expect(tramoProyectado(serie, null)).toEqual(serie.map((d) => ({ ...d, proyectado: null })))
  })

  it('arranca en el último real y sigue por los meses proyectados', () => {
    // Tres puntos —uno real y dos proyectados—, que es lo que hace falta
    // para que la curva sea curva y sin pisar la línea sólida.
    expect(
      tramoProyectado(serie, proyeccion([{ indice: 3, valor: 8 }, { indice: 4, valor: 11 }])),
    ).toEqual([
      { id: 'a', real: 10, proyectado: null },
      { id: 'b', real: 12, proyectado: null },
      { id: 'c', real: 5, proyectado: 5 },
      { id: 'd', real: null, proyectado: 8 },
      { id: 'e', real: null, proyectado: 11 },
    ])
  })

  it('el arranque es el ÚLTIMO real, no el primero', () => {
    const conHueco = [
      { id: 'a', real: 10 },
      { id: 'b', real: null },
      { id: 'c', real: 5 },
      { id: 'd', real: null },
    ]
    expect(tramoProyectado(conHueco, proyeccion([{ indice: 3, valor: 8 }]))).toEqual([
      { id: 'a', real: 10, proyectado: null },
      { id: 'b', real: null, proyectado: null },
      { id: 'c', real: 5, proyectado: 5 },
      { id: 'd', real: null, proyectado: 8 },
    ])
  })

  it('con un solo mes proyectado el tramo son dos puntos: no se inventa un tercero', () => {
    const corta = [
      { id: 'a', real: 10 },
      { id: 'b', real: null },
    ]
    expect(tramoProyectado(corta, proyeccion([{ indice: 1, valor: 7 }]))).toEqual([
      { id: 'a', real: 10, proyectado: 10 },
      { id: 'b', real: null, proyectado: 7 },
    ])
  })

  it('una proyección fuera de la serie se ignora', () => {
    expect(tramoProyectado(serie, proyeccion([{ indice: 9, valor: 8 }]))).toEqual(
      serie.map((d) => ({ ...d, proyectado: null })),
    )
  })
})
