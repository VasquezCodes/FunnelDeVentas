# Gráficos v3 y v4: fichas, aluvial y mosaico — diseño

- **Fecha:** 2026-09-15
- **Estado:** construido y verificado.
- **Sustituye a** `2026-09-14-graficos-shadcn-design.md` (v2) en el Embudo, los Canales, el Dinero y la cabecera de la Serie.
- **Referencia del usuario:** un dashboard oscuro de analítica: una rejilla de tarjetas, cada una con cifra grande, «X last period», un % en píldora y un minigráfico con el periodo actual en color y el anterior en gris.
- **Lo que pidió:**
  - «Algo único e impactante», que no parezca hecho por IA, «nada de textos sueltos, nada de números sueltos, todo con sentido, minimalista y corporativo».
  - En la segunda ronda: fichas solo para el Embudo, y en Canales y Dinero «gráficos diferentes, creatividad», «visuales espectaculares para impresionar a los jefes», iconos de Lucide y «que elijas vos y luego me explicas por qué».

## Decisiones

| Panel | Forma | Quién la eligió |
|---|---|---|
| Embudo | Fichas con área en una hoja con filetes; cada ficha lee su propio mes | El usuario (v3); lectura por ficha pedida en la ronda 2 |
| Canales | Aluvial «del gasto a los leads» y una celda de precio por canal | Delegada (v4) |
| Dinero | Mosaico de recipientes que el real llena como un líquido | Delegada (v4) |
| Serie | Área con velo y plan discontinuo, 12 meses con conmutador | El usuario (la que más le gusta) |

- **La cifra grande** vuelve como en la referencia: con su plan al lado y sin frase. La cabecera con cifra y frase que se quitó el 2026-09-14 sigue fuera.
- **Iconos:**
  - Lucide en los gráficos, dentro de `IconoEnPastilla` (`components/graficos/hoja.tsx`): trazo de 1,75 en el color de la entidad sobre una aguada del 14 % del mismo color, el duotono hecho a mano.
  - Phosphor sigue en el cromo: barra superior, raíl, semáforo y estados vacíos.

## Piezas comunes

- **`components/graficos/hoja.tsx`:**
  - `Hoja` es la tarjeta: borde, radio de 14 px y `data-entrada-pendiente`.
  - `CabeceraHoja` lleva la leyenda a la izquierda y el mes elegido a la derecha.
  - `IconoEnPastilla` es el icono de Lucide en su pastilla.
- **`components/graficos/fichas.tsx`:** las fichas del Embudo y los ayudantes compartidos: `ventanaDe`, `cociente`, `puntoCalculado`, `lecturaDe`, `mesEnFrase`, `indicesSueltos` y `HojaVacia`.
- **Lectura de una cifra (`lecturaDe`):** «de 145 del plan» para volúmenes, «frente a $32.19 del plan» para tasas y costes, y «previsto en el plan, sin resultado» cuando no hay real. Si se lee un mes que no es el elegido, la frase lo nombra: «de 222 del plan en junio».
- **Datos:** `tablero.tsx` pasa `serie` (los periodos del grano elegido con sus comparativas) y `periodoId` a Embudo, Canales y Dinero. La Serie recibe `periodoId`.

## Embudo: fichas

- **Seis fichas:** las 5 etapas y «Conversión de lead a venta» (tasa real y del plan del mismo mes). Todo en carmín.
- **Iconos:** `Users`, `PhoneCall`, `ScanSearch`, `FileText`, `BadgeCheck` y `Percent`.
- **Ficha:**
  - Nombre y `Semaforo` sm con palabra y % del plan.
  - Cifra real en Fraunces 400 a 2,5 rem y la frase del plan debajo.
  - Mini serie de 6 periodos que acaban en el elegido: área monotone de 2 px con velo del 26 % al 0 % y plan discontinuo de 1,5 px («4 4»). Sin eje Y ni rejilla.
  - Punto de 8 px en el mes que se lee y punto de 5 px en los meses sueltos.
- **Hoja:** rejilla `gap-px` sobre `--regla-fina`, con 3 columnas desde 60 rem de contenedor, 2 desde 34 rem y 1 en móvil.
- **Cada ficha, su mes:**
  - El puntero, o ← y → con la ficha enfocada, mueve solo esa ficha: cifra, plan, estado, guía vertical y el mes en la frase. Escape vuelve al mes elegido.
  - Cada ficha tiene su `aria-live`.
  - La cabecera de la hoja sigue en el mes elegido.
- **Entrada:** en cascada, con 0,07 s entre fichas: meses, plan con recorte, curva con DrawSVG, velo con recorte, cifra que cuenta y punto con rebote.

## Canales: del gasto a los leads (`components/canales.tsx`)

- **Forma:** diagrama aluvial de dos etapas.
  - Arriba, la barra del gasto repartida por canal; abajo, la de los leads.
  - Cada canal une sus dos tramos con una cinta de su color (degradado del 55 % al 22 %). Si la cinta se ensancha, el lead sale barato; si se estrecha, caro.
- **Cada barra contra su plan:**
  - El 100 % del plan mide lo mismo en las dos barras y lo marca una raya discontinua con halo.
  - La pista gris hasta la raya es lo que falta.
  - Si el gasto se pasa y los leads no llegan, las cintas convergen.
- **Cabeceras de barra:** «Gasto por canal» y «Leads por canal», con total en Fraunces, plan y estado. El gasto se juzga «menos es mejor».
  - Son los totales de los tres canales, no los de la cabecera del mes, porque el plan tiene gasto y leads sin canal.
- **Tramos:** redondeados solo en los extremos de la barra (recorte común), con 2 px de hueco entre tramos y entre barra y cinta. El icono de Lucide del canal va dentro si cabe, en `--canal-N-sobre`.
  - Iconos: `Megaphone`, `Radar` y `Handshake`.
- **Celdas:** una por canal, con el coste por lead en grande, «frente a $X del plan», el estado y «32 % del gasto → 68 % de los leads».
- **Resalte:** al pasar por un tramo, una cinta o una celda (o al enfocar la celda), los demás canales se apagan: al 20 % en el gráfico y al 45 % el contenido de las celdas.
- **Entrada:**
  1. Aparecen las pistas.
  2. El gasto se reparte de izquierda a derecha y su total cuenta.
  3. Aparecen las rayas del plan.
  4. Las cintas caen de arriba abajo, una tras otra.
  5. Cuentan los precios.
  6. Se llenan los leads.
- **Tokens nuevos:** `--canal-1-sobre`, `--canal-2-sobre` y `--canal-3-sobre` (claro: blanco en los tres; oscuro: tarjeta, tarjeta y blanco).

## Dinero: mosaico de recipientes (`components/dinero.tsx`)

- **Forma:** cada partida es una pieza cuyo tamaño es su plan (el recipiente). El real la llena desde abajo como un líquido.
  - La altura del líquido es el cumplimiento y el área llena es el importe real.
  - Si el real supera al plan, la pieza crece hasta el real y una raya discontinua marca el plan.
- **Dos bloques:** «ya estaba ganado al empezar el mes» (las dos recurrentes) y «hubo que venderlo en el mes» (las dos altas y otros).
  - El ancho de cada bloque es su peso, y su cabecera lo dice en Fraunces 2,5 rem: «55 %».
  - Iconos: `CalendarCheck` y `HandCoins`.
- **Treemap «squarified»** (Bruls, Huizing y van Wijk) dentro de cada bloque, con 8 px de hueco.
  - En móvil hay una pieza por fila a todo el ancho, con alto proporcional y 150 px de mínimo.
  - Iconos: `Repeat` para las recurrentes, `UserPlus` para las altas y `Coins` para otros.
- **Pieza:**
  - El recipiente es una aguada del 4 % con borde discontinuo.
  - El líquido es un degradado verde (el bloque ganado más denso), rematado arriba por una línea de 2 px en `--metrica-verde`.
  - El texto (nombre, cifra, plan y estado) va en bloque en la parte mayor de la pieza (el líquido o el aire) y se ajusta a ella midiendo en rem: primero cae el estado, luego el plan y la cifra baja de tamaño. La línea del nivel nunca cruza el texto.
- **Resalte:** al pasar por una pieza o enfocarla, las demás bajan al 50 %.
- **Entrada:** aparecen los recipientes, las cabeceras cuentan y el líquido sube en cada pieza (recorte desde abajo) mientras su importe cuenta.

## Serie (`components/tendencias.tsx`)

- **Forma:** la de siempre, con la cabecera de la ficha. La cifra reacciona al puntero y al teclado, sin tooltip.
- **Ventana:** 12 meses con el elegido en la sexta posición, y el conmutador «12 meses / Todo el plan». La escala se ajusta a lo visible.

## Retirado

- `canales-contraste.ts`, `etiqueta-estado.tsx`, `CabeceraGrafico`, `CONFIG_PLAN_REAL` y la rampa `--embudo-*`.

## Verificación (2026-09-15)

- `tsc` y `eslint` limpios; la consola del navegador, sin errores.
- Capturas a 1440, 875 y 400 px en claro y oscuro; movimiento reducido; mes futuro (octubre) y primer mes del plan (abril).
- Scripts de interacción:
  - Una ficha del Embudo lee junio y las demás siguen en septiembre.
  - Con el teclado, en la segunda ficha, se llega a julio y se anuncia.
  - En Canales y Dinero, el resalte apaga lo demás.
  - Tras la entrada no queda ningún estilo en línea.
