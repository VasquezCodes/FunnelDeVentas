# Gráficos v3 a v5: fichas, aluvial y moneda — diseño

- **Fecha:** 2026-09-15
- **Estado:** construido y verificado.
- **Sustituye a** `2026-09-14-graficos-shadcn-design.md` (v2) en el Embudo, los Canales, el Dinero y la cabecera de la Serie.
- **Referencia del usuario:** un dashboard oscuro de analítica: una rejilla de tarjetas, cada una con cifra grande, «X last period», un % en píldora y un minigráfico con el periodo actual en color y el anterior en gris.
- **Lo que pidió:**
  - «Algo único e impactante», que no parezca hecho por IA, «nada de textos sueltos, nada de números sueltos, todo con sentido, minimalista y corporativo».
  - Ronda 2: fichas solo para el Embudo, y en Canales y Dinero «gráficos diferentes, creatividad», «visuales espectaculares para impresionar a los jefes», iconos de Lucide y «que elijas vos y luego me explicas por qué».
  - Ronda 3: claridad en Canales («no sé cuál barra es la real y cuál es plan»), un Dinero «que se sienta como dinero, como moneda: corporación, serio, elegante, decisivo», las cantidades de cada canal y el título de la herramienta en la cabecera.
  - Ronda 4: menos información en Canales (fuera el detalle al pasar el ratón; los leads de cada canal, en su celda), más importancia para el título y mejor espaciado en la cabecera, el libro de Dinero reducido a la partida que se señala en la moneda, un carrusel que no cambie de sección al arrastrar y unos semáforos que no parezcan de IA.

## Decisiones

| Panel | Forma | Quién la eligió |
|---|---|---|
| Embudo | Fichas con área en una hoja con filetes; cada ficha lee su propio mes | El usuario (v3); lectura por ficha pedida en la ronda 2 |
| Canales | Aluvial «del gasto a los leads», con el plan como cota sobre cada barra, y una celda por canal | Delegada (v4); claridad pedida en la ronda 3 |
| Dinero | Moneda (anillo de partidas sobre el surco del plan) y libro de cuentas | Delegada (v5), tras rechazar el mosaico |
| Serie | Área con velo y plan discontinuo, 12 meses con conmutador | El usuario (la que más le gusta) |

- **La cifra grande** vuelve como en la referencia: con su plan al lado y sin frase. La cabecera con cifra y frase que se quitó el 2026-09-14 sigue fuera.
- **Iconos:**
  - Lucide en los gráficos, dentro de `IconoEnPastilla` (`components/graficos/hoja.tsx`): trazo de 1,75 en el color de la entidad sobre una aguada del 14 % del mismo color, el duotono hecho a mano.
  - Phosphor sigue en el cromo: barra superior, raíl y estados vacíos.
- **Semáforo (`components/semaforo.tsx`):** sin píldora. Una marca maciza con la forma del estado —círculo en plan, triángulo al límite, cuadrado fuera de plan, círculo hueco sin dato—, la palabra en el color del estado y la cifra en tinta, tabular. Sin fondo, sin borde y sin separador. La píldora tintada con icono de Phosphor se rechazó por «demasiado IA». La forma sola separa los estados sin color; la palabra, sin forma.
  - **Una sola voz** en toda la aplicación, también en «Capturar datos»: En plan, Al límite, Fuera de plan y Sin dato (`ETIQUETAS_ESTADO`, en `lib/comparacion.ts`). Hablan de plan, no de calidad. Al unificar, el usuario las prefirió a «En objetivo / En riesgo / Crítico», que usaban los gráficos; el semáforo ya no acepta una palabra propia.

## Cabecera (`components/cabecera-mes.tsx`)

- **Dos pisos:**
  - Arriba, lo que no cambia: el título «Funnel de ventas» (Fraunces 600, de 2,25 a 3,5 rem, el cuerpo mayor de la página), la entradilla «Plan de negocio frente al resultado real» y la firma de marca (raya de carmín y filete).
  - Abajo, cómo va el mes, en una fila de libro de cuentas: el mes encabeza la fila y le siguen Ingreso, Engaged leads, Ventas y Captación, cada cifra con su plan debajo («de $188,650 del plan»; la captación, «frente a $9,888 del plan»). Solo el ingreso lleva semáforo: es el veredicto del mes.
- **Rejilla:** cada cifra ocupa tres filas —etiqueta, cifra y plan— compartidas por `subgrid`, así las cifras quedan a la misma altura y el mes se sienta en su fila. Una sola fila desde 72 rem de contenedor; el mes encima y cuatro columnas desde 36 rem; dos por dos en móvil. Filetes finos entre cifras.
- **Movimiento:** al cargar, el título sube por palabras y se traza la firma; el mes entra por letras y las cifras cuentan. Al cambiar de mes solo se repiten el mes y las cifras.
- El `<title>` de la página es «Funnel de ventas».

## Carrusel (`components/carrusel.tsx`)

- Se cambia de sección con el raíl o con las flechas. Se quitó el gesto de arrastrar (`Observer` de GSAP): con el ratón, seleccionar una cifra arrastrando cambiaba de sección. Con él se fue la pista «Desliza o usa las flechas».

## Piezas comunes

- **`components/graficos/hoja.tsx`:**
  - `Hoja` es la tarjeta: borde, radio de 14 px y `data-entrada-pendiente`.
  - `CabeceraHoja` lleva la leyenda a la izquierda y el mes elegido a la derecha.
  - `IconoEnPastilla` es el icono de Lucide en su pastilla.
- **`components/graficos/fichas.tsx`:** las fichas del Embudo y los ayudantes compartidos: `ventanaDe`, `cociente`, `puntoCalculado`, `puntoDeComparativa`, `lecturaDe`, `mesEnFrase`, `indicesSueltos` y `HojaVacia`.
- **Lectura de una cifra (`lecturaDe`):** «de 145 del plan» para volúmenes, «frente a $32.19 del plan» para tasas y costes, y «previsto en el plan, sin resultado» cuando no hay real. Si se lee un mes que no es el elegido, la frase lo nombra: «de 222 del plan en junio». La usan las fichas, los Canales, el Dinero y la cabecera.
- **Datos:** `tablero.tsx` pasa `serie` (los periodos del grano elegido con sus comparativas) y `periodoId` a Embudo, Canales y Dinero. La Serie recibe `periodoId`.

## Embudo: fichas

- **Seis fichas:** las 5 etapas y «Conversión de lead a venta» (tasa real y del plan del mismo mes). Todo en carmín.
- **Iconos:** `Users`, `PhoneCall`, `ScanSearch`, `FileText`, `BadgeCheck` y `Percent`.
- **Ficha:**
  - Nombre y semáforo (marca, palabra y % del plan), centrados en la misma línea.
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
  - Cada canal une sus dos tramos con una cinta de su color. Si la cinta se ensancha, el lead sale barato; si se estrecha, caro.
- **Real y plan, sin dudas:**
  - Cada barra se rotula a la izquierda («Gasto», «Leads») y su total, a la derecha, se dice real: «$11,382 real», con su semáforo. El gasto se juzga «menos es mejor».
  - El plan es una cota discontinua con topes, encima de la barra del gasto y debajo de la de los leads, rotulada «Plan $9,330» y «Plan 130 leads». Una caída discontinua baja de la cota al extremo del plan.
  - Leyenda propia: la muestra de tres tonos es el real; la cota con topes, el plan.
  - Los totales son los de los tres canales, no los de la cabecera del mes, porque el plan tiene gasto y leads sin canal.
  - En una hoja estrecha, rótulo, total y semáforo van encima (gasto) o debajo (leads) de su barra.
- **Tramos:** redondeados solo en los extremos de la barra, con 2 px de hueco. Dentro va lo que quepa del rótulo —icono, nombre e importe; icono e importe; o solo el icono— en `--canal-N-sobre`.
  - Iconos: `Megaphone`, `Radar` y `Handshake`.
- **Celdas:** una por canal, con el coste por lead en grande, «frente a $X del plan», el semáforo, los leads del canal contra su plan («63 leads de 94 del plan») y «32 % del gasto → 68 % de los leads».
- **Resalte:** al pasar por un tramo, una cinta o una celda (o al enfocar la celda), los demás canales se apagan: al 20 % en el gráfico y al 45 % el contenido de las celdas. Hubo un detalle flotante con el gasto, los leads y el coste de cada canal; se quitó por «muy explotado de info», y los leads pasaron a la celda.
- **Entrada:**
  1. Las cotas del plan se trazan de izquierda a derecha.
  2. El gasto se reparte y su total cuenta.
  3. Las cintas caen de arriba abajo, una tras otra.
  4. Se llenan los leads y cuentan los totales y los precios.
- **Tokens:** `--canal-1-sobre`, `--canal-2-sobre` y `--canal-3-sobre` (claro: blanco, blanco y tinta; oscuro: tarjeta, tarjeta y blanco).

## Dinero: moneda y libro de cuentas (`components/dinero.tsx`)

- **La moneda:**
  - Canto acuñado (120 muescas en el gris de la regla), filo, surco del plan (aguada verde y discontinuo por su línea media) y cara con guilloché.
  - El real, partida a partida, es un anillo en el sentido de las agujas sobre el surco. El círculo entero es el plan: lo que el anillo no cubre es lo que falta. Si el real pasa del plan, el anillo se cierra y el exceso se dice debajo.
  - En la cara: «Ingreso del mes», la cifra, «de $X del plan» y el semáforo. Debajo, con la marca del surco: «$24,525 faltan para el plan».
  - Rampa `--dinero-1` a `--dinero-5`, verdes validados en claro y en oscuro.
  - Las coordenadas de las muescas y del guilloché se redondean a centésimas: el seno y el coseno no dan el mismo último decimal en el servidor que en el navegador, y eso rompía la hidratación.
- **El libro de cuentas:** un estado de resultados.
  - Dos bloques con subtotal y su peso («55 % del ingreso»): «Ya ganado al empezar el mes» (las recurrentes, `CalendarCheck`) y «Vendido en el mes» (las altas y otros, `HandCoins`).
  - Partidas sangradas con su icono (`Repeat`, `UserPlus`, `Coins`), real, plan y cumplimiento con barrita.
  - Total con la raya de la suma y la doble raya de cierre.
  - En una hoja estrecha (menos de 26 rem) quedan el real y el plan: la columna de cumplimiento y los iconos no caben, y el cumplimiento del total ya lo dice la moneda.
- **Resalte:**
  - Al señalar un tramo de la moneda, el libro se queda solo con esa partida: bloques, otras partidas, total y sus rayas se desvanecen en su sitio, sin mover nada, y vuelven al soltar. Se queda la raya bajo la cabecera de columnas.
  - Al señalar o enfocar una fila del libro, las demás filas bajan al 40 % y los demás tramos de la moneda al 25 %. Aquí no desaparecen: no quedaría adónde llevar el ratón.
- **Entrada:** barrido de las muescas, el surco, los arcos con DrawSVG a velocidad constante, las cifras que cuentan, las barritas y la diferencia.

## Serie (`components/tendencias.tsx`)

- **Forma:** la de siempre, con la cabecera de la ficha y su semáforo. La cifra reacciona al puntero y al teclado, sin tooltip.
- **Ventana:** 12 meses con el elegido en la sexta posición, y el conmutador «12 meses / Todo el plan». La escala se ajusta a lo visible.

## Retirado

- `canales-contraste.ts`, `etiqueta-estado.tsx`, `CabeceraGrafico`, `CONFIG_PLAN_REAL` y la rampa `--embudo-*`.
- El mosaico de recipientes de Dinero (v4).
- El detalle flotante de Canales (`DetalleCanal`).
- La píldora del semáforo y sus iconos de Phosphor.
- `ETIQUETAS_SEMAFORO` y la prop `etiqueta` del semáforo: queda una sola voz para los estados.
- El gesto de arrastre del carrusel y su pista.
- La prop `lectura` de la cabecera: su único uso era un texto para lectores de pantalla que ahora dice el semáforo del ingreso.

## Verificación (2026-09-15)

- `tsc` y `eslint` limpios; la consola del navegador, sin errores ni avisos de hidratación.
- Capturas a 1440, 875 y 400 px en claro y a 1440 px en oscuro, más la vista «Capturar datos», que también usa el semáforo.
- Scripts de interacción:
  - Una ficha del Embudo lee junio y las demás siguen en septiembre; con el teclado, en la segunda ficha, se llega a julio y se anuncia.
  - Arrastrar sobre las fichas selecciona texto y la sección no cambia.
  - Canales: ningún detalle flotante; cada celda con sus leads; el resalte apaga los demás canales.
  - Dinero: desde la moneda, solo la fila señalada queda visible; desde el libro, las demás filas al 40 %; al soltar, todo vuelve.
  - Tras la entrada no queda ningún estilo en línea.
