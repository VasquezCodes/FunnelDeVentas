# Captura por bloques — diseño

- **Fecha:** 2026-09-15
- **Estado:** construido y verificado el 2026-09-15. Lo terminó otra sesión tras quedarse sin cuota el agente que lo empezó; ver «Implementación» al final.
- **Depende de:** `2026-09-15-captura-persistente-design.md` y su plan (`docs/superpowers/plans/2026-09-15-captura-persistente.md`). Este diseño se apoya en la pantalla de su Tarea 7 y no la sustituye.
- **Lo que pidió el usuario:**
  - «Mejorar la parte de captura de datos, porque está todo demasiado suelto.»
  - «Organizar por bloques los items que deberían ir en conjunto», como en el Excel.
  - «Hay otro agente trabajando en Firebase: no lo pises.»

## El problema

La captura enseña los 52 indicadores del catálogo en una sola lista, sin encabezados:

- **«Publicidad» sale cuatro veces** (leads, llamadas, ventas y gasto) y nada dice de qué bloque es cada una. Lo mismo pasa con el resto de canales.
- **Cinco filas son sumas de otras** y hoy se teclean:
  - el total de Engaged Leads, de Llamadas y de Ventas, que es la suma de sus canales;
  - el ingreso total;
  - el gasto de captación total.

  Teclear un total y sus partes a la vez invita a que no cuadren. En el Excel, las filas «Cero» existen justo para comprobarlo.

La hoja «Plan de Ventas» ya está organizada por bloques: cada etapa con su total, sus siete canales y su fila «Cero», y después los insumos, el dinero y los gastos. Pero va al revés del embudo, de la venta al lead, porque el Excel calcula hacia atrás.

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Eje de los bloques | Por etapa, en el orden en que avanza el lead | Es la estructura del Excel en el sentido del tablero. El encabezado del bloque da contexto a «Publicidad». |
| Totales | Se calculan; no tienen casilla | No pueden descuadrar, y son cinco casillas menos. |
| Cuándo se calculan | Al leer, nunca se guardan | Una sola regla, que usan la captura y el tablero. Un total nunca se queda viejo, y un canal nuevo recalcula los meses pasados sin migrar datos. |
| Total parcial | La suma de los sumandos con dato; si no hay ninguno, el total queda vacío | Vacío no es cero. La fila dice cuántos sumandos lleva («3 de 7 canales»). |
| Canales en cada bloque | Siempre los siete (seis en Gasto) | Lo eligió el usuario: el mismo esquema todos los meses. El Excel no tiene línea de gasto para Interno. |
| Insumos | Bloque final, plegado | Hoy ningún gráfico los usa, pero se pueden capturar para usos futuros sin que estorben. |
| Plegado | `<details>` nativo | En `components/ui` no hay acordeón, e instalar uno tocaría `package.json`, que es del otro agente. |
| Meta de quincena | La mitad del plan de cada indicador, como hoy (`lib/plan/quincenas.ts` no se toca). Los totales tampoco llevan trato especial. | Lo decidió el usuario: «dividir el plan en 2 y tomar una parte». |

## Los bloques

Se teclean 47 casillas por quincena, y 5 filas se calculan.

| # | Bloque | Icono (Lucide) | Filas, en orden | Total calculado |
|---|---|---|---|---|
| 1 | Engaged Leads | `Users` | `eleads.` + publicidad, prospeccion, referidos, afiliados, contenido, newsletter, interno | `eleads` |
| 2 | Llamadas iniciales | `PhoneCall` | `llamadas.` + los mismos siete canales | `llamadas` |
| 3 | Discoveries y propuestas | `ScanSearch` | `discoveries`, `propuestas` | No tiene |
| 4 | Ventas FLECHA | `BadgeCheck` | `ventas.` + los mismos siete canales | `ventas` |
| 5 | Ingresos | `Coins` | `ingreso-flecha-recurrente`, `ingreso-arco-recurrente`, `ingreso-flecha-setup`, `ventas-arco`, `ingreso-arco-setup`, `ingreso-otros` | `ingreso-total` |
| 6 | Gasto de captación | `Wallet` | `captacion.` + publicidad, prospeccion, referidos, afiliados, contenido, newsletter | `captacion-total` |
| 7 | Insumos por canal *(plegado)* | `Layers` | Subgrupos por canal: Publicidad (`publicidad-impresiones`, `publicidad-clicks`, `publicidad-inversion`) · Prospección (`prospeccion-contactos`) · Referidos (`referidos-contactos`, `referidos-reactivaciones`) · Afiliados (`afiliados-contactos`, `afiliados-reactivaciones`) · Contenido (`contenido-visitas`, `contenido-creacion`) · Newsletter (`newsletter-aperturas`, `newsletter-envios`) | No tiene |

- Los iconos de los bloques 1 a 4 son los mismos que usa `components/embudo.tsx` para cada etapa, y `Wallet` es el de la barra de gasto de `components/canales.tsx`. Así un bloque se reconoce igual en la captura y en el tablero.
- **Ingresos** sigue el orden del panel Dinero, no el del Excel: primero lo que ya estaba ganado (las dos mensualidades) y después lo vendido en el mes. `ventas-arco` va pegada a Altas ARCO: son unidades, no suma al ingreso y tampoco va en Ventas FLECHA, porque ARCO no pasa por el embudo.
- Discoveries y Propuestas van juntas para no dejar dos bloques de una sola fila.

## Qué suma cada total (`lib/plan/sumas.ts`, nuevo)

Es un dato del dominio, así que vive junto al plan y no en la pantalla. Se deriva del catálogo que ya existe, sin añadir campos a `Indicador` (`lib/tipos.ts` es del otro agente):

- `eleads`, `llamadas` y `ventas`: los indicadores del catálogo con `desglosaA` igual a su id. Son siete cada uno.
- `ingreso-total`: los del grupo `dinero` con unidad `moneda`, salvo el propio total. Son cinco; `ventas-arco` queda fuera por ser una cantidad.
- `captacion-total`: los del grupo `captacion` con `canal`. Son seis.

Exporta:

- `SUMANDOS: ReadonlyMap<string, readonly string[]>`: id del total → ids de sus sumandos, en el orden del catálogo.
- `TOTALES_CALCULADOS: ReadonlySet<string>`: las cinco claves de `SUMANDOS`.

## Los totales (`lib/captura/totales.ts`, nuevo)

- `completarTotales(valores: Record<string, number>): Record<string, number>`
  - Recibe las cifras de **una** quincena y devuelve una copia con los cinco totales.
  - Cada total es la suma de los sumandos que tienen dato, redondeada al céntimo. Un 0 cuenta como dato.
  - Si ningún sumando tiene dato, el total no aparece en la salida.
  - Si la entrada ya traía un total, gana el calculado, y si no le toca existir se quita. Así un total tecleado antes de este cambio nunca pisa la suma.
  - Es pura: no muta la entrada.
- `sumandosConDato(valores, totalId): { con: number; de: number }`: lo que dice la fila de total («3 de 7 canales»).

## Las metas de quincena, sin cambios

La meta de quincena de cada indicador sigue siendo la mitad de su plan del mes, como hoy: en las cantidades, dos enteros que suman el mes, con la unidad impar en la 2ª quincena. Los totales se parten igual, por su cuenta.

Consecuencia aceptada: en una quincena, el «de N» de un total puede diferir en unas pocas unidades de la suma de los «de N» de sus canales, porque cada canal impar manda su unidad sobrante a la 2ª quincena. Por ejemplo, Engaged Leads en la 1ª quincena de junio de 2026:

- el total (222) partido da 111;
- los canales partidos suman 110 (55 + 14 + 14 + 27).

El mes siempre cuadra exacto, porque el total del Excel ya es la suma de sus canales. En el dinero no pasa, porque se parte al céntimo.

## Integración en los ficheros del otro agente

Se hace **cuando su plan esté terminado**, no antes. Son tres cambios:

1. **`lib/reales/mes.ts › realesDelPeriodo`:** cada quincena pasa por `completarTotales` antes de construir sus reales. El mes suma las quincenas ya completadas, así que su total es la suma de los canales del mes. `coberturaDelMes` no cambia: un documento con canales ya cuenta como quincena con dato.
2. **`app/captura/acciones.ts › guardarMes`:** los ids válidos son los del plan menos `TOTALES_CALCULADOS`. Un total que llegue del navegador se rechaza con el mensaje de `limpiarValores` («El indicador «eleads» no está en el plan.»). La pantalla nunca los manda, así que solo lo vería quien llame a la acción a mano.
3. **`components/captura-manual.tsx`**, sobre la versión de la Tarea 7: la pantalla que se describe abajo.

El modelo de Firestore no cambia: los documentos simplemente nunca llevan totales.

## La pantalla (`components/captura-manual.tsx`)

Se mantiene todo lo de la Tarea 7:

- la cabecera con el contador de cambios;
- la rejilla de columnas: indicador · 1ª quincena (casilla y «de N») · 2ª quincena · mes · cumplimiento · estado;
- las casillas cambiadas marcadas;
- el pie con el aviso de bloqueo;
- «Guardar cambios» con su cuadro de contraseña.

Cambia cómo se agrupan las filas:

- **Estructura:** la pantalla recorre `BLOQUES` (`lib/captura/bloques.ts`) en vez de la lista plana de indicadores. Un indicador que el Excel no trajo (una incidencia) no pinta fila.
- **Encabezado de bloque:** una fila con la rejilla de siempre. En la primera columna van el icono en pastilla y el título; en las demás, los nombres de columna en el estilo `eyebrow`. Se repiten en cada bloque porque un encabezado fijo arriba no puede engancharse a la página: el contenedor tiene scroll horizontal. Así cada bloque se lee solo.
- **Filas de sumando:** van con sangría bajo su encabezado. El nombre visible sigue siendo el del catálogo («Publicidad»). La etiqueta accesible de cada casilla lleva el bloque: «Engaged Leads, Publicidad, 1ª quincena».
- **Fila de total:**
  - Tiene una raya simple encima, como el subtotal del panel Dinero.
  - Su nombre es «Total» o «Ingreso total», con «3 de 7 canales» (o «de 5 partidas», o «de 6 canales») en gris.
  - En cada quincena, la suma en gris y sin casilla, con su «de N». Ese «de N» es la meta de quincena del total, que puede no coincidir con la suma de las metas de sus canales (ver «Las metas de quincena, sin cambios»).
  - Mes, cumplimiento y estado funcionan como en cualquier otra fila.
  - Se recalcula en cada pulsación con `completarTotales` aplicado al borrador de cada quincena.
- **Insumos:** un `<details>` cerrado al abrir la pantalla.
  - Su `<summary>` es el encabezado del bloque, con «N de 12 capturados».
  - Dentro, un subtítulo por canal y sus filas.
  - Cerrarlo no descarta nada: sus casillas siguen en el borrador y en el contador de cambios.
- **Contador de cambios:** cuenta solo las casillas tecleadas. Un total que cambia porque cambió un canal no es un cambio aparte.

## Pruebas

- **Unitarias (Vitest):** su `vitest.config.ts` ya incluye `lib/**/*.test.ts`, así que no hace falta tocarlo.
  - `lib/plan/sumas.test.ts`:
    - Cada total tiene los sumandos esperados: siete, siete, siete, cinco y seis.
    - `ventas-arco` no está entre los del ingreso.
    - Ningún total es sumando de otro.
  - `lib/captura/totales.test.ts`:
    - Suma completa, suma parcial y ningún sumando (el total no aparece).
    - El 0 cuenta como dato.
    - El dinero se redondea al céntimo.
    - Un total que viene en la entrada se sustituye o se quita.
    - La entrada no se muta.
    - `sumandosConDato`.
  - `lib/captura/bloques.test.ts`:
    - Todo indicador del catálogo aparece exactamente una vez, entre filas y totales.
    - El total de cada bloque está en `TOTALES_CALCULADOS`, y sus filas son sus sumandos.
    - El orden de los bloques es 1 a 7.
    - Insumos es el único bloque plegado.
- **Tras la integración, de punta a punta, en local con `quincenas-dev`:**
  1. Capturar tres canales de Engaged Leads en la 1ª quincena. El total dice «3 de 7 canales» y su suma, y el tablero enseña esa suma como Engaged Leads del mes («hasta el 15»).
  2. Llamar a `guardarMes` con `eleads` en los valores. Se rechaza y no se escribe nada.
  3. Abrir y cerrar Insumos con un cambio dentro. El contador lo sigue contando y se guarda.
- **Interfaz:** capturas a 1440 y a 400 px. `npx tsc --noEmit` y `eslint` limpios.

## Orden de trabajo

1. **Ahora, sin tocar nada del otro agente:** `lib/plan/sumas.ts`, `lib/captura/totales.ts` y `lib/captura/bloques.ts`, con sus pruebas. Son todos ficheros nuevos.
2. **Cuando el plan de captura persistente esté terminado:** los tres cambios de integración.
3. **Sin commits mientras el otro agente trabaje en la misma carpeta.** El usuario decide cuándo se hace commit y de qué.

## Fuera de alcance

- Pasar a la fila de abajo con Intro dentro de una misma quincena. Con el tabulador se va fila a fila (1ª → 2ª quincena → fila siguiente).
- El panel Canales, que sigue enseñando solo tres canales (`CANALES_ACTIVOS`), aunque el Excel ya da cifras a Contenido, Newsletter e Interno.
- El desfase del gasto de publicidad: el Excel imputa a cada mes el gasto de las impresiones de dos meses después, y eso distorsiona el coste por lead del plan en el panel Canales.
- Gráficos para los insumos.

## Implementación (2026-09-15)

La primera fase (sumas, totales y bloques, con sus pruebas) la dejó hecha el agente que empezó. La integración se hizo con dos cambios respecto a lo escrito arriba, encontrados al revisarla:

1. **Los totales se completan al leer, no solo en `realesDelPeriodo`.**
   - El problema: la meta a la fecha de un mes en curso (`metasDelMes`, en `lib/reales/mes.ts`) mira los documentos tal como se guardan, y en ellos nunca hay totales. Completándolos solo en los reales, un total con la 1ª quincena capturada se habría comparado con el plan del mes entero y habría salido «Fuera de plan» por estar a medias.
   - La solución: `completarQuincenas` (en `lib/captura/totales.ts`) completa todas las quincenas una vez por petición en `lib/plan/fuente.ts`. Así los reales, la meta a la fecha y la cobertura ven las mismas cifras, y `lib/reales/mes.ts` no cambia.
2. **El borrador de la pantalla deja fuera los totales.**
   - El problema: lo guardado llega ya con los totales calculados, y si pasaran al borrador viajarían al guardar y la acción los rechazaría.
   - La solución: la conversión vive en `lib/captura/borrador.ts`, con sus pruebas, y `aBorrador` salta los `TOTALES_CALCULADOS`.

Además:
- La acción de guardar usa `idsCapturables` (en `lib/plan/sumas.ts`): todo el plan menos los cinco totales.
- Colores de los encabezados: carmín del embudo en las etapas, verde en Ingresos, azul en Gasto y gris en Insumos (`COLOR_FAMILIA`).
- El recuento de un total («3 de 7 canales») cuenta las partes con dato en cualquiera de las dos quincenas.

**Verificación:**
- `npm test`: 66 pruebas en 9 archivos. `tsc` y `eslint` limpios.
- Recorrido de punta a punta en local, sobre `quincenas-dev` vaciada antes, sin errores en la consola:
  - Siete bloques, en orden, y 47 casillas por quincena.
  - Con tres canales de Engaged Leads en la 1ª quincena, el total dice «3 de 7 canales · 50 de 72» y el mes, «69 % Fuera de plan» contra la meta de la 1ª quincena.
  - Insumos empieza plegado. Una cifra tecleada dentro sigue contando al cerrarlo: «1 de 12 capturados», con 5 cambios en total.
  - Tras guardar y recargar, todo sigue ahí.
  - El tablero enseña «Septiembre 2026 · hasta el 15» y Engaged leads «50 de 72 del plan».
- El rechazo de un total en la acción queda cubierto por las pruebas de `idsCapturables` y `limpiarValores`. La pantalla nunca los envía.
