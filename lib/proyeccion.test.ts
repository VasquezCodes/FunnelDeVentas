import { describe, expect, it } from 'vitest'

import { proyectar, type PuntoPlanReal } from '@/lib/proyeccion'

/** Atajo: `p(plan, real)`. `null` en real es un mes sin resultado. */
const p = (plan: number | null, real: number | null): PuntoPlanReal => ({ plan, real })

describe('proyectar', () => {
  it('proyecta el plan del mes siguiente al ritmo de los tres últimos', () => {
    const serie = [p(400, 412), p(290, 191), p(96, 105), p(280, null)]
    const proyeccion = proyectar(serie)!

    // Agregado y ponderado, del más reciente al más antiguo (3·2·1):
    // (3·105 + 2·191 + 1·412) / (3·96 + 2·290 + 1·400) = 1109 / 1268
    expect(proyeccion.puntos[0].indice).toBe(3)
    expect(proyeccion.mesesDeRitmo).toBe(3)
    expect(proyeccion.ritmo).toBeCloseTo(1109 / 1268, 10)
    expect(proyeccion.puntos[0].valor).toBeCloseTo(280 * (1109 / 1268), 6)
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

  it('el mes a medias entra en el ritmo: su plan ya es el de la quincena', () => {
    // Así llega del tablero (metasDelMes): septiembre con media quincena trae
    // el plan de esa quincena, 140, y no el del mes, 280. Es el dato más
    // fresco, y con él el ritmo nota que septiembre va flojo.
    const serie = [p(400, 400), p(290, 290), p(96, 96), p(140, 70), p(300, null)]
    const conEl = proyectar(serie, { enCurso: 3 })!
    const sinEl = proyectar(serie, { enCurso: 3, conMesEnCurso: false })!

    expect(conEl.puntos[0].indice).toBe(4)
    expect(sinEl.ritmo).toBeCloseTo(1, 10)
    // (3·70 + 2·96 + 1·290) / (3·140 + 2·96 + 1·290) = 692 / 902
    expect(conEl.ritmo).toBeCloseTo(692 / 902, 10)
    expect(conEl.ritmo).toBeLessThan(sinEl.ritmo)
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
    // (3·380 + 2·90) / (3·400 + 2·100) = 1320 / 1400
    const { puntos } = proyectar(serie)!
    expect(puntos).toHaveLength(1)
    expect(puntos[0].indice).toBe(3)
    expect(puntos[0].valor).toBeCloseTo(500 * (1320 / 1400), 10)
  })

  it('se para donde el plan se acaba, sin dejar huecos en el trazo', () => {
    const serie = [p(100, 90), p(200, null), p(null, null), p(400, null)]
    expect(proyectar(serie)!.puntos).toEqual([{ indice: 1, valor: 180 }])
  })
})

describe('por qué el ritmo es agregado y ponderado', () => {
  it('un mes pequeño con suerte no dispara la proyección', () => {
    // Ventas: un mes de plan 2 con 5 ventas es un 250 %. En una media vale
    // lo mismo que un mes de plan 100, y la proyección se va un 45 % arriba.
    // En el agregado aporta 5 de 190 y pesa lo que pesa.
    const serie = [p(100, 90), p(100, 95), p(2, 5), p(100, null)]
    const media = proyectar(serie, { ritmo: 'media', pesos: [1, 1, 1] })!
    const agregado = proyectar(serie, { pesos: [1, 1, 1] })!

    expect(media.ritmo).toBeCloseTo((0.9 + 0.95 + 2.5) / 3, 10) // 1,45
    expect(agregado.ritmo).toBeCloseTo(190 / 202, 10) // 0,94
  })

  it('el último mes pesa más: si el ritmo cambia, la proyección lo nota antes', () => {
    // Tres meses en plan y el último al 70 %: una media plana diría 90 %.
    const serie = [p(100, 100), p(100, 100), p(100, 70), p(100, null)]
    const plano = proyectar(serie, { pesos: [1, 1, 1] })!
    const ponderado = proyectar(serie)!

    expect(plano.ritmo).toBeCloseTo(0.9, 10)
    expect(ponderado.ritmo).toBeCloseTo((3 * 70 + 2 * 100 + 100) / 600, 10) // 0,85
  })
})
