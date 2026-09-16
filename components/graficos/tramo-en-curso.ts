/**
 * El tramo del mes en curso, aparte.
 *
 * Un mes a medias se dibuja «a la fecha»: su real es el de una quincena y,
 * sin marca, la curva parecería hundirse. La convención de periodo
 * incompleto es punteada: el último tramo va punteado y su punto, hueco.
 *
 * Recharts no pinta un mismo trazo con dos estilos, así que se separa en dos
 * series: `real`, que acaba en el mes anterior, y `realEnCurso`, que une ese
 * mes con el que está en curso.
 */
export function tramoEnCurso<T extends { real: number | null }>(
  datos: readonly T[],
  enCurso: number,
): Array<T & { realEnCurso: number | null }> {
  const actual = datos[enCurso]
  if (enCurso < 0 || !actual || actual.real === null) {
    return datos.map((d) => ({ ...d, realEnCurso: null }))
  }
  return datos.map((d, i) => {
    if (i === enCurso) return { ...d, real: null, realEnCurso: actual.real }
    if (i === enCurso - 1) return { ...d, realEnCurso: d.real }
    return { ...d, realEnCurso: null }
  })
}
