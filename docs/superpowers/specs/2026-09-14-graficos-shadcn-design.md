# Gráficos con el acabado de shadcnstudio — diseño (v2)

> **Superada el 2026-09-15** por `2026-09-15-fichas-design.md` en el Embudo, los Canales, el Dinero y la cabecera de la Serie. Lo que sigue es historia: la rampa `--embudo-*` y las piezas de la v2 ya no existen.

- **Fecha:** 2026-09-14
- **Estado:** v2 aprobada por el usuario.
  - La v1 (barras emparejadas dentro de una tarjeta) no gustó: se parecía demasiado al gráfico de antes.
  - En la v2 el usuario eligió la forma de cada gráfico y pidió más color de marca.
- **Alcance:** los cuatro gráficos a la vez (Embudo, Serie, Dinero y Canales), sin rondas largas de verificación.
- **Skills aplicadas:** frontend-design, dataviz y las de GSAP (react, timeline, plugins).

## Decisiones del usuario

1. **Embudo: embudo centrado.** Las barras están centradas y se estrechan hacia abajo; el plan va detrás en claro y el real delante.
2. **Serie: área suave con degradado.** El real es un área curva con velo, y el plan una línea discontinua.
3. **Dinero: medidor radial más barras.** Las barras comparan plan y real por partida; el medidor muestra la parte recurrente.
4. **Canales: barras redondeadas con el nombre dentro**, al estilo del Chart 6 de shadcnstudio. Lo propuse yo y no hubo objeción.
5. **Color:** los de ahora (gris del plan y tinta) **más el carmín y los tonos rojos de la marca, y verde y azul para las métricas**. Esto **anula** la regla anterior de que el carmín nunca entraba en un gráfico.
6. **Sin cambios respecto a la v1:**
   - Tarjeta con cabecera y cifra clave.
   - El `chart` oficial de shadcn (Recharts 3.8) con componentes propios; los bloques de shadcnstudio son de pago y solo sirven de referencia visual.
   - Entrada con GSAP y efecto de dibujado.

## Qué ya existe y se reutiliza (no reescribir)

- `components/ui/chart.tsx`: ChartContainer, ChartTooltip y el resto del `chart` de shadcn.
- `components/graficos/`:
  - `TarjetaGrafico`, `CabeceraGrafico`, `LeyendaPlanReal`, `EtiquetaEstado` y `useAnchoContenedor`.
  - `useEntradaGrafico`: reproduce una timeline de GSAP cuando la tarjeta se ve o cuando cambian los datos; respeta el movimiento reducido y deja el estado final limpio.
  - `config.ts`: colores compartidos.
- `lib/animacion.ts`: gsap, useGSAP, DrawSVGPlugin (ya registrado), SplitText, `contarHasta`, `prefiereQuietud` y las curvas de la casa.
- Estos archivos compartidos **no se modifican** durante la construcción en paralelo. Si un gráfico necesita algo que no está, lo implementa en su propio archivo o en un archivo nuevo con el nombre del gráfico como prefijo.

## Color (v2)

| Uso | Token | Claro | Oscuro |
|---|---|---|---|
| Plan (en todos los gráficos) | `--serie-plan` / `--serie-plan-suave` | `#a79c95` / `#cfc7c1` | `#6a615c` / `#3d3733` |
| Etapas del embudo (rampa ordinal de carmín, de la etapa 1 a la 5) | `--embudo-1` … `--embudo-5` | `#e493b0` `#d65a86` `#bd0842` `#920634` `#650422` | `#8f1a42` `#c02a5c` `#e8447a` `#f07aa0` `#f7b3c8` |
| Métricas de embudo (leads, llamadas, ventas…) | `--metrica-carmin` | `#bd0842` | `#e8447a` |
| Métricas de dinero | `--metrica-verde` | `#2e8b3d` | ver `globals.css` |
| Métricas de captación y costes | `--metrica-azul` | `#2a78d6` | `#3987e5` |
| Canales (rampa vino de marca, sin cambios) | `--canal-1..3` | | |
| Semáforo (sin cambios) | `--estado-*` | | |
| Rejilla (sólida, 1 px) | `--grid-line` | | |

- **Rampa del embudo:** de claro arriba a intenso abajo. En oscuro se invierte el ancla, así que la última etapa, el resultado, es siempre la más marcada.
- **Validado con `validate_palette.js`:**
  - El trío de métricas pasa las cinco comprobaciones en claro. En oscuro pasa con el verde que queda fijado en `globals.css`.
  - La rampa de carmín pasa las comprobaciones ordinales en los dos modos (el extremo claro está a 2,31:1 en claro y 2,01:1 en oscuro).
- **Reglas:**
  - El color sigue a la entidad, nunca a su rango.
  - El texto no lleva el color de la serie. La única excepción es el texto dentro de una barra rellena, que va en blanco o en tinta según la luminancia del relleno.
  - **El semáforo sigue siendo el único juicio y siempre lleva icono y palabra.** Una barra carmín es identidad (marca o etapa), no «crítico».
- **Color de la Serie:** depende del `grupo` del indicador elegido: `embudo` → carmín, `dinero` → verde, `captacion` → azul.

## Sistema visual común

- **Tarjeta (`TarjetaGrafico`):** fondo `--card`, borde de 1 px, radio de 14 px, sin sombra ni degradado de fondo, padding de 24 px (16 px en móvil).
- **Cabecera (`CabeceraGrafico`), v2:** solo la leyenda a la izquierda y la `EtiquetaEstado` a la derecha. La cifra clave en grande con su frase («69 % · Discoveries, la etapa más lejos de su plan») se quitó a petición del usuario («no me gusta tener ese número ahí»): el gráfico es la respuesta, y el título lo pone el panel del carrusel. Los estados vacíos ponen su mensaje en el cuerpo de la tarjeta, no en la cabecera.
- **Tipografía:** Geist en toda la tarjeta; `tabular-nums` solo en columnas de valores y ejes.
- **Tooltip (`ChartTooltip` con contenido propio):** el valor manda y la etiqueta acompaña. Lleva la etiqueta de estado con icono y palabra. Con el foco de teclado se ve el mismo detalle, y el foco es visible.
- **Accesibilidad:** cada gráfico tiene su tabla en un `div.sr-only` que la envuelve; nunca `sr-only` sobre la propia `<table>`.
- **Carrusel:** `ChartContainer` lleva **altura explícita** (`aspect-auto h-[…] w-full`). Nada de `h-full` ni `display: none`.
- **Recharts:** `isAnimationActive={false}` en todas las series. Todo el movimiento lo lleva GSAP.
- **Responsive:** tiene que leerse bien a 1440, 875 y 400 px de ancho.

## Diseño por gráfico

### Embudo (`components/embudo.tsx`): v4, columnas por etapa

> **Hecho (v4).** El usuario rechazó también la v3 (silueta continua): «horrible». Eligió columnas por etapa, al estilo del Chart 21 de shadcnstudio: cinco pares de columnas de izquierda a derecha (plan fina y gris, real ancha en `--embudo-N`, puntas redondeadas de 4 px), la cifra real sobre su columna, el nombre y «Plan 145» debajo, eje Y con marcas redondas, rejilla horizontal sólida y línea base. Entrada: la línea base se traza con DrawSVG y las columnas suben desde ella de izquierda a derecha mientras las cifras cuentan (~1,3 s). En móvil los nombres se parten en dos líneas y la letra se encoge si una palabra no cabe.
>
> **Historial (v3, descartada).** La v2 (caja redondeada por etapa con la píldora dentro) no gustó: se leía como campos de formulario. La v3 dibuja el plan como UNA silueta continua (tramos rectos unidos por cuellos inclinados, relleno muy claro y contorno de 1 px), el real como barra plana centrada en `--embudo-N`, los nombres pegados al borde de su tramo (bajan en escalera) y las cifras en columna a la derecha; trazado acotado a 680 px y centrado. Entrada: el borde superior se traza desde el centro, los costados bajan a la vez con DrawSVG, aparece el relleno y las barras se abren etapa a etapa mientras las cifras cuentan (~1,5 s). Lo que sigue es la descripción original de la v2, que queda superada en la forma.

- **Cabecera:** igual que en la v1. La cifra clave es la etapa con menor cumplimiento («69 %», «Discoveries, la etapa más lejos de su plan» y su estado), con el caso «Sin resultado todavía».
- **Forma:** un embudo centrado. Cada etapa es una fila con:
  - **La banda del plan:** un rectángulo centrado de ancho proporcional a la meta, relleno `--serie-plan-suave`, radio de 8 px y unos 36 px de alto. Por encima lleva su contorno de 1 px en `--serie-plan`, dibujado **encima** de la barra real para que se vea también cuando el real supera al plan.
  - **La barra real:** centrada, de ancho proporcional al real, color `var(--embudo-N)` según la etapa, radio de 6 px y unos 24 px de alto.
- **Escala:** una sola escala compartida (el ancho máximo corresponde al mayor valor de todo el embudo). Un valor mayor que cero nunca desaparece; si falta, no hay barra.
- **Implementación sugerida:** `BarChart layout="vertical"` con un `shape` propio que dibuje la banda, la barra y el contorno centrados, a partir del eje X numérico, o una capa `Customized`. Así funcionan la categoría, el tooltip y el cursor de Recharts.
- **Nombres de etapa:** a la izquierda, en `--foreground`.
- **Columna derecha:** el real en seminegrita y «de 145» en tono apagado, con `tabular-nums`.
- **Hover o foco:** una banda de fila sutil; nunca se cambia el color de la serie.
- **Entrada:**
  1. Los contornos del plan **se dibujan con DrawSVG**.
  2. Las barras reales **se abren desde el centro hacia los lados** con un recorte desde los dos costados, escalonadas de arriba abajo.
  3. Las cifras cuentan hasta su valor.
  4. Al acabar, `clearProps`.

### Serie (`components/tendencias.tsx`)

- **Cabecera:**
  - El selector de indicador (el `Select` existente).
  - La cifra clave: el valor del último mes con dato, con «de $X del plan, Y %».
  - La `EtiquetaEstado` de ese mes.
- **Gráfico:** `AreaChart` con `type="monotone"`.
  - **Real:** trazo de 2 px en el color de la métrica y relleno con `linearGradient` del mismo color, de un 28 % de opacidad arriba a un 0 % abajo.
  - **Plan:** `Line` discontinua (`strokeDasharray="4 4"`) en `--serie-plan`, sin puntos.
  - **Punto final:** solo en el último real, de 8 px, con anillo del color de la tarjeta.
  - **Meses futuros:** solo el plan; los huecos no se interpolan (`connectNulls={false}`).
- **Ejes:**
  - Eje Y con valores compactos ($200k).
  - Eje X con `etiquetaCorta` («Sep 2026»), sin pisarse; hay que espaciar las etiquetas en móvil.
  - Rejilla horizontal sólida.
  - El gráfico cabe en el ancho de la tarjeta, sin scroll horizontal.
- **Tooltip con guía vertical:** periodo, Plan, Real, Cumplimiento y estado.
- **Entrada:**
  1. La curva real **se dibuja con DrawSVG** de izquierda a derecha.
  2. El área se revela a la par con un recorte de izquierda a derecha.
  3. La línea del plan se revela con un recorte (DrawSVG no sirve para trazos discontinuos).
  4. El punto final aparece al llegar la línea y la cifra cuenta.
- Hay que conservar la lógica útil que ya existe: indicadores graficables, orden cronológico, estados.

### Dinero (`components/dinero.tsx`)

- **Izquierda:** «Por partida», barras horizontales plan/real por partida, con las cinco partidas sin el total.
  - Plan fino de 8 px en `--serie-plan`, real grueso de 14 px en `--metrica-verde`.
  - Radio `[0,4,4,0]`, escala compartida y rejilla vertical sólida.
  - Columna derecha con el plan (pequeño, apagado) encima del real (seminegrita).
- **Derecha:** un medidor radial **en SVG propio** (no Recharts), porque así el arco se puede dibujar con DrawSVG.
  - Un arco de unos 240°: pista `--muted` y relleno `--metrica-verde`, con puntas redondeadas y un grosor de unos 14 px.
  - En el centro, el porcentaje recurrente («55 %», Geist seminegrita) y debajo «ya ganado al empezar el mes».
  - Debajo del medidor, la lista Recurrente / Altas / Otros con su importe y su parte.
  - Si no hay real, se usa el plan y se dice.
- **Cabecera de la tarjeta:** la cifra clave es el ingreso real frente al plan en %, con su estado, si eso no duplica la cabecera del mes. Si la duplica, se usa «Por partida» con la leyenda.
- **Entrada:**
  1. El arco del medidor **se dibuja con DrawSVG** mientras el porcentaje cuenta.
  2. Las barras se revelan desde la línea base con un recorte y el plan primero.
  3. Las cifras cuentan hasta su valor.
- **Responsive:** en móvil, el medidor pasa encima de las barras.

### Canales (`components/canales.tsx`)

- **Cabecera:** la cifra clave es el peor coste por lead («$58.60 por lead en Publicidad; plan $32.19»), con su estado. Se usan las filas de `lib/canales.ts`.
- **Gráfico:** una barra redondeada tipo píldora por canal (Publicidad, Prospección, Referidos), de unos 34 px de alto.
  - El largo es proporcional a los **leads reales**, con escala compartida.
  - Va sobre una pista clara que llega hasta los **leads del plan**, con una raya de 2 px que marca la meta.
  - Relleno `var(--canal-N)`.
  - **Dentro de la barra**, el icono Phosphor del canal y su nombre, en blanco o tinta según el contraste. Si el nombre no cabe, va fuera, a la derecha.
  - A la derecha, «63 de 94 leads».
- **Al lado, o debajo en móvil, una lista de tres filas al estilo del Chart 6:**
  - Punto del color del canal y nombre.
  - El coste por lead real en grande, «plan $32.19» en pequeño y el gasto real.
  - La `EtiquetaEstado` del coste.
- **Se elimina el pie de texto** que decía que el plan reserva cuatro canales más y no les asigna nada en 33 meses: es falso y el usuario quiere menos texto.
- **Entrada:** las píldoras crecen desde la izquierda con el nombre apareciendo, las rayas de meta se dibujan con DrawSVG y las cifras cuentan.

## Animación de entrada (común)

- **Mecanismo:** `useEntradaGrafico`. La timeline se reproduce cuando la tarjeta está al menos a la mitad en vista (al cargar o al llegar a su panel) y cuando cambian los datos con la tarjeta visible. Nunca al pasar el ratón.
- **Timeline:** unos 1,2 s en una sola timeline, con `defaults` y el parámetro de posición, sin `delay` encadenados. `clearProps` al final: el DOM final es idéntico al estático.
- **Movimiento reducido:** no se mueve nada.
- **Carácter:** que se lea como un gráfico dibujado a mano, con impacto pero sin ruido.

## Verificación

- `tsc` y `eslint` limpios, y la consola sin errores.
- Capturas en claro y en oscuro a 1440 y 400 px, y los fotogramas de la entrada.
- Alturas del carrusel correctas y sin vacío al final de la página.
