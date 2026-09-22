import { describe, expect, it } from 'vitest'

import { proyectar, type PuntoPlanReal } from '@/lib/proyeccion'

/** Atajo: `p(plan, real)`. `null` en real es un mes sin resultado. */
const p = (plan: number | null, real: number | null): PuntoPlanReal => ({ plan, real })

describe('proyectar', () => {
  it('proyecta el plan del mes siguiente al ritmo de los tres cerrados', () => {
    const serie = [p(400, 412), p(290, 191), p(96, 105), p(280, null)]
    const proyeccion = proyectar(serie)!

    // (412/400 + 191/290 + 105/96) / 3 = 0,92746…
    expect(proyeccion.puntos[0].indice).toBe(3)
    expect(proyeccion.mesesDeRitmo).toBe(3)
    expect(proyeccion.ritmo).toBeCloseTo(0.92746, 5)
    expect(proyeccion.puntos[0].valor).toBeCloseTo(259.69, 2)
  })

  it('respeta la forma del plan: un mes de vacaciones proyecta bajo', () => {
    // Cumpliendo el plan clavado, la proyección ES el plan: el bajón de
    // agosto sale del plan, no de la tendencia de los reales.
    const serie = [p(400, 400), p(290, 290), p(300, 300), p(96, null)]
    expect(proyectar(serie)!.puntos[0].valor).toBeCloseTo(96, 5)
  })

  it('solo mira los tres últimos meses cerrados, no toda la historia', () => {
    // Los dos primeros meses fueron un desastre y ya no cuentan.
    const serie = [p(100, 10), p(100, 10), p(100, 100), p(100, 100), p(100, 100), p(200, null)]
    expect(proyectar(serie)!.ritmo).toBeCloseTo(1, 5)
    expect(proyectar(serie)!.puntos[0].valor).toBeCloseTo(200, 5)
  })

  it('el mes a medias marca dónde proyectar pero no entra en el ritmo', () => {
    // Septiembre lleva media quincena: 74 contra un plan mensual de 280
    // sería un 26 % y hundiría la media. Cuenta como último dato, nada más.
    const serie = [p(400, 400), p(290, 290), p(96, 96), p(280, 74), p(300, null)]
    const proyeccion = proyectar(serie, { enCurso: 3 })!

    expect(proyeccion.puntos[0].indice).toBe(4)
    expect(proyeccion.mesesDeRitmo).toBe(3)
    expect(proyeccion.ritmo).toBeCloseTo(1, 5)
    expect(proyeccion.puntos[0].valor).toBeCloseTo(300, 5)
  })

  it('sin ningún mes cerrado no se proyecta: no hay ritmo que medir', () => {
    expect(proyectar([p(100, null), p(100, null)])).toBeNull()
  })

  it('sin plan para el mes siguiente no se proyecta', () => {
    expect(proyectar([p(100, 90), p(null, null)])).toBeNull()
  })

  it('con el plan a cero tampoco: multiplicarlo daría cero siempre', () => {
    expect(proyectar([p(100, 90), p(0, null)])).toBeNull()
  })

  it('no proyecta sobre un mes que ya tiene resultado', () => {
    expect(proyectar([p(100, 90), p(100, 95)])).toBeNull()
  })

  it('no proyecta si el último dato cierra la ventana: no hay sitio', () => {
    expect(proyectar([p(100, 90), p(100, 95), p(100, 99)])).toBeNull()
  })

  it('con un solo mes cerrado proyecta y lo dice', () => {
    const proyeccion = proyectar([p(100, 80), p(200, null)])!
    expect(proyeccion.mesesDeRitmo).toBe(1)
    expect(proyeccion.puntos[0].valor).toBeCloseTo(160, 5)
  })

  it('un mes cerrado con plan 0 no entra en el ritmo', () => {
    // El canal que el plan deja sin asignar no puede dar un cumplimiento.
    const serie = [p(0, 0), p(100, 50), p(100, null)]
    const proyeccion = proyectar(serie)!
    expect(proyeccion.mesesDeRitmo).toBe(1)
    expect(proyeccion.ritmo).toBeCloseTo(0.5, 5)
  })
})

describe('proyectar, varios meses', () => {
  it('proyecta dos meses por defecto, cada uno con su propio plan', () => {
    const serie = [p(100, 90), p(200, null), p(400, null)]
    const { puntos, ritmo } = proyectar(serie)!
    expect(ritmo).toBeCloseTo(0.9, 5)
    expect(puntos).toEqual([
      { indice: 1, valor: 180 },
      { indice: 2, valor: 360 },
    ])
  })

  it('proyecta desde el ÚLTIMO resultado, no desde el primer hueco', () => {
    // Un mes sin capturar en medio no abre una proyección: lo que manda es
    // hasta dónde llegan los resultados.
    const serie = [p(100, 90), p(200, null), p(400, 380), p(500, null)]
    // ritmo = media(380/400, 90/100) = 0,925 → 500 × 0,925
    expect(proyectar(serie)!.puntos).toEqual([{ indice: 3, valor: 462.5 }])
  })

  it('se para donde el plan se acaba, sin dejar huecos en el trazo', () => {
    const serie = [p(100, 90), p(200, null), p(null, null), p(400, null)]
    expect(proyectar(serie)!.puntos).toEqual([{ indice: 1, valor: 180 }])
  })
})
