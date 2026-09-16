# Tasas, Embudo ampliado, Canales por canal y color del Dinero

Fecha: 2026-09-16. Pedido del usuario en siete puntos; este documento recoge
cómo se entendieron y qué se decidió en cada uno.

## 0. De dónde salen las tasas del plan

Las tasas no están en «Plan de Ventas»: están en la hoja **Variables** del
libro, y el libro les da **nombre definido**. Se leen por nombre (no por
celda), así que mover una celda en el Excel no rompe nada.

| Nombre definido | Qué es | De → a |
|---|---|---|
| `CVR_Llamada` | Tasa de conversión a llamada (60 %) | Engaged leads → Llamadas |
| `CVR_Cualificación` | Tasa de cualificación (30 %) | Llamadas → Discoveries |
| `CVR_Propuestas` | Tasa de propuestas (50 %) | Discoveries → Propuestas |
| `CVR_Cierre` | Tasa de cierre (40 %) | Propuestas → Ventas |
| `CVR_LinkCTR` | Link CTR (1 %) | Impresiones → Clics |
| `CVR_Publicidad` | CVR Publicidad (10 %) | Clics → Leads de Publicidad |
| `CVR_Prospección` | CVR Prospección (6 %) | Contactos → Leads de Prospección |
| `CVR_Referidos` | CVR Referidos (20 %) | Contactos → Leads de Referidos |
| `CVR_Afiliados` | CVR Afiliados (20 %) | Contactos → Leads de Afiliados |
| `CVR_Contenido` | CVR Contenido (2 %) | Visitas → Leads de Contenido |
| `CVR_Apertura` | CVR Apertura (50 %) | Envíos → Aperturas |
| `CVR_Newsletter` | CVR Newsletter (2 %) | Aperturas → Leads de Newsletter |

Además, por canal: leads del canal → llamadas del canal con `CVR_Llamada`
(ELeads_Publicidad × 60 % = Llamadas_Publicidad).

Solo se usan tasas que el Excel tiene como tales. Hubo una «De llamada a
venta» por canal (cualificación × propuestas × cierre, 6 %) y el usuario la
quitó el 2026-09-16: si no está en el Excel, no se usa.

Las tasas son constantes del plan (la hoja no tiene una por mes). La tasa
real de un periodo es `real(hacia) / real(desde)` de ese periodo; sin
denominador o con denominador 0 no hay tasa.

- `lib/plan/tasas.ts`: el catálogo de tasas (nombre definido, nombre visible,
  desde, hacia) y cómo se construyen a partir de los valores leídos.
- `lib/plan/excel.ts`: lee también la hoja Variables y sus nombres. Un nombre
  que falte es una incidencia, no un fallo.
- `FuenteDatos.tasas()`; la página las pasa al tablero.
- `lib/tasas.ts`: la tasa real, pura y con pruebas.

## 1. Captura: tasas entre etapas

Entre los bloques del embudo, una fila de tasa con las columnas de la tabla:
tasa real de cada quincena visible, tasa real del mes (en «Total mes») y la
del plan (en «Plan mes»). Se recalculan al teclear: una tasa del 300 % delata
una cifra mal escrita.

- Tras Engaged Leads: Tasa de conversión a llamada, **desplegable por canal**.
- Tras Llamadas iniciales: Tasa de cualificación.
- Tras Discoveries y propuestas: Tasa de propuestas y Tasa de cierre.

Los canales que se listan son los que tienen plan o real en el mes.

## 2. Captura: variables previas

- «Insumos por canal» pasa a llamarse **«Variables previas por canal»**.
- Bajo las filas de cada canal, sus tasas con el nombre del Excel (Link CTR,
  CVR Publicidad…), mismas columnas que arriba.

## 3. Embudo: el periodo siguiente y la ficha en grande

- La ventana de cada ficha añade **el periodo siguiente** (mes o quincena):
  solo plan, con su punto hueco a la vista. La lectura al señalarlo ya dice
  «previsto para octubre, sin resultado».
- **Pulsar una ficha la abre en grande** (cuadro nativo, Esc cierra):
  - la misma ficha a lo alto, con doce periodos (nueve hasta el elegido y
    tres por delante) y eje con cifras;
  - debajo, **por canal** (si la etapa se reparte): real, plan y estado de
    cada canal en el periodo elegido;
  - **la tasa desde la etapa anterior**, real frente a plan;
  - ← y → pasan a la etapa vecina sin cerrar.

## 4. Canales: General / Por canal

Un conmutador en la cabecera de la hoja: **General** es el diagrama de hoy
(el gasto de todos los canales y los leads que trae cada uno). **Por canal**
elige un canal y enseña lo suyo:

- su gasto, sus leads y su coste por lead, real frente a plan;
- su cadena, como el diagrama de la hoja Variables: cada paso con su cifra
  real y su plan, y en cada flecha la tasa real y la del plan.
  Publicidad: Impresiones → Clics → Leads → Llamadas → Ventas.
  Prospección y Referidos: Contactos → Leads → Llamadas → Ventas.

## 5. Dinero: del rojo al verde

El usuario delegó la decisión. **El anillo entero toma el color de lo cerca
que está el mes de su plan**: rojo por debajo del 80 %, ámbar hasta el 95 %,
verde después y un verde más intenso al cumplirlo entero. Con los umbrales
del semáforo, el color coincide siempre con la palabra del centro. Con la
captura quincena a quincena, el anillo cambia de color a medida que entra el
dinero: arranca en rojo y se va poniendo verde.

- Se probó antes un degradado a lo largo del recorrido del anillo y se
  descartó al verlo con datos: un mes al 130 % pintaba de rojo más de la
  mitad del anillo y un buen mes se leía como una alarma.
- Las transiciones entre franjas son suaves (dos puntos tras cada umbral).
- Las barras de cumplimiento del libro toman el color de la franja de su
  propia fila (misma función). Las pastillas quedan en el verde de la familia.
- `lib/color-cumplimiento.ts`: la franja y el color de cada cumplimiento, con
  los umbrales del semáforo (`UMBRALES_POR_DEFECTO`), con pruebas.
- Token nuevo `--estado-ok-fuerte` (claro y oscuro) para el «más verde».

## Verificación

Pruebas de las funciones puras (lectura de nombres, tasa real, color por
cumplimiento, ventana con periodo siguiente); tsc y eslint; capturas en
claro, oscuro y móvil de la captura, el Embudo con la ficha abierta, Canales
por canal y el Dinero; el recorrido de guardado. Sin commit hasta que el
usuario lo pida.
