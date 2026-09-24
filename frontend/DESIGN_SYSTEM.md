# Sistema de Diseño de Alarfly

Este documento es la fuente única de verdad para cómo se ve y se siente
Alarfly. Todo módulo nuevo del frontend lo sigue sin excepción — ver la
regla permanente en `CLAUDE.md`. Prioridad cuando algo entra en
conflicto: **que sea fácil de entender, por encima de que se vea
elegante.**

## Concepto

Alarfly se ve y se siente como un **libro contable oficial, sellado y
en orden** — no como un dashboard genérico de startup. La metáfora es
el sello: cada aprobación, cada asiento cuadrado, cada estado
verificado en el sistema deja una marca clara, como el sello que un
contador estampa sobre un documento ya revisado. Fondo oscuro tipo
"tinta", texto tipo "papel".

**Fase 10 (rediseño visual global)**: el acento de marca cambió de
dorado a un **rojo vino intenso y controlado** — decisión de marca
confirmada explícitamente por quien dueño del proyecto. Lejos de
romper la metáfora del sello, la refuerza: un sello de cera clásico
**es rojo**, no dorado — "Alarfly estampa un sello de cera sobre cada
operación verificada" es, si acaso, una metáfora más literal que la
versión anterior.

Esto es intencional y distinto de un dashboard SaaS genérico
(Tailwind/shadcn azul-sobre-blanco): buscamos transmitir **orden,
permanencia y verificación**, no "producto tecnológico moderno
genérico" — ver también la sección "Criterio especial" más abajo
(precisión, control, velocidad, tecnología, confianza, simplicidad).

## Paleta de color

| Nombre | Hex | Uso |
|---|---|---|
| **Tinta** (fondo) | `#0B0D10` | Fondo de toda la aplicación. Negro mate con un dejo azulado, nunca negro puro. |
| **Papel** (superficie) | `#14171C` | Tarjetas, paneles, filas de tabla. |
| **Papel elevado** | `#1B1F26` | Modales, menús, elementos "por encima" del resto. |
| **Grafito** (bordes) | `#2A2F38` | Bordes, separadores, líneas de tabla. |
| **Hueso** (texto principal) | `#EDEFF2` | Texto de lectura principal. Blanco roto, nunca `#fff` puro. |
| **Plomo** (texto secundario) | `#8B93A1` | Etiquetas, texto de apoyo, marcas de tiempo. |
| **Sello** (acento de marca, `--color-brand`, antes dorado) | `#9C2740` | El único acento cálido-rojo del sistema. Reservado para: el botón de acción principal de cada pantalla, montos destacados, elementos activos (ítem de menú activo), y el Sello de Estado (ver abajo). Nunca decorativo, nunca como color de fondo general — nunca en más de 1-2 lugares por pantalla. |

**Estados** (siempre en tono apagado, nunca el verde/rojo brillante de
semáforo — ver "Sello de Estado" para cómo se comunican sin depender
solo del color). Desde Fase 10, **`--color-negative` es deliberadamente
un matiz distinto de `--color-brand`** (óxido/terracota vs. vino) —
así un botón de marca nunca se puede confundir con un estado de error
a pesar de que los dos están en la familia "rojo":

| Nombre | Hex | Uso |
|---|---|---|
| Verificado (`--color-positive`) | `#6E9B7B` | Aprobado, activo, al día — verde apagado tipo musgo. |
| Alerta (`--color-warning`) | `#C9A227` | Pendiente, requiere atención — el dorado que antes era la marca, ahora libre para su propio significado semántico (advertencia). |
| Objeción (`--color-negative`) | `#B4695E` | Rechazado, vencido, error — terracota/óxido apagado, nunca rojo puro ni el mismo tono que la marca. |
| Información (`--color-info`, nuevo en Fase 10) | `#6B8FAE` | Mensajes informativos que no son éxito, alerta ni error — azul apagado. |

## Tipografía

Dos familias, cada una con un trabajo específico — **nunca la misma
fuente para todo**, es lo que le da carácter de "documento oficial" en
vez de "app genérica":

- **Encabezados y montos importantes:** [Source Serif 4](https://fonts.google.com/specimen/Source+Serif+4)
  (serif, con buen soporte de números). Transmite permanencia y
  seriedad — como el nombre impreso en un estado de cuenta bancario.
- **Todo lo demás (cuerpo, botones, tablas, formularios):**
  [Inter](https://fonts.google.com/specimen/Inter) — sans-serif,
  máxima legibilidad en textos pequeños y densos.

### Escala

| Token | Tamaño | Familia | Peso | Uso |
|---|---|---|---|---|
| `--text-hero` | 34px | Source Serif 4 | 600 | El número más importante de una pantalla (ej. posición de caja en el Panel principal). |
| `--text-h1` | 26px | Source Serif 4 | 600 | Título de pantalla. |
| `--text-h2` | 18px | Source Serif 4 | 600 | Título de panel/sección. |
| `--text-h3` | 13px | Inter | 700, mayúsculas, `letter-spacing: 0.06em` | Subtítulo de agrupación (ej. "ACTIVO" en el árbol de cuentas). |
| `--text-md` | 14px | Inter | 400 | Cuerpo, formularios. |
| `--text-sm` | 13px | Inter | 400 | Tablas, texto secundario. |
| `--text-xs` | 12px | Inter | 400 | Etiquetas, ayudas contextuales. |
| `--text-2xs` | 11px | Inter | 600, mayúsculas | Encabezados de tabla. |

Todas las cifras monetarias usan `font-variant-numeric: tabular-nums`
(alineadas en columna) — en tablas van en Inter; el número "titular" de
una tarjeta de KPI va en Source Serif 4.

## Espaciado, bordes y sombras

Escala de espaciado fija (múltiplos de 4, ya en uso, se mantiene):
`4 · 8 · 12 · 16 · 24 · 32 · 48px`.

Bordes más rectos que el estándar de un dashboard — refuerzan la idea
de "documento", no de "app con esquinas súper redondeadas":

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 4px | Botones, inputs, badges. |
| `--radius-md` | 8px | Tarjetas, paneles. |
| `--radius-lg` | 10px | Modales. |
| `--radius-pill` (nuevo en Fase 10) | 999px | Badges/estados totalmente redondeados — antes cada uno escribía `999px`/`50%` a mano. |

Sombras discretas, nunca "flotantes" — el objetivo es dar la sensación
de una hoja apoyada sobre otra, no de elementos suspendidos en el aire.
Fase 10 agregó un 3er nivel para separar "elevado" (flyouts/dropdowns/
tooltips) de "modal" (diálogos/drawers/toasts — el nivel más alto):

```
--shadow-card:     0 1px 2px rgba(0,0,0,.4), 0 6px 16px rgba(0,0,0,.3);
--shadow-elevated: 0 4px 10px rgba(0,0,0,.5), 0 14px 32px rgba(0,0,0,.4);
--shadow-modal:    0 8px 16px rgba(0,0,0,.5), 0 24px 48px rgba(0,0,0,.45);
```

### z-index (nuevo en Fase 10)

Antes de esta fase, cada componente flotante escribía su propio número
arbitrario (10 valores distintos sin ningún orden documentado: 5, 20,
30, 40, 50, 60, 100, 140, 150, 200). Se les puso nombre sin cambiar el
orden relativo entre ellos (para no alterar qué elemento queda encima
de cuál):

| Token | Valor | Uso |
|---|---|---|
| `--z-index-dropdown` | 20 | Tooltips y popovers dentro de un componente. |
| `--z-index-dropdown-elevated` | 30 | Listas de autocompletado. |
| `--z-index-flyout` | 40 | Flyout del sidebar, menú del botón de creación rápida. |
| `--z-index-panel` | 50 | Panel de notificaciones. |
| `--z-index-popover` | 60 | Popovers de vista previa (`RecordLink`, menú de acciones de documento). |
| `--z-index-modal-backdrop` | 100 | Fondo oscuro detrás de un diálogo de confirmación. |
| `--z-index-drawer` | 140 | Panel deslizable de detalle. |
| `--z-index-fab` | 150 | Botón flotante de ayuda contextual. |
| `--z-index-overlay-top` | 200 | Toasts, modales de creación rápida, barra de progreso global. |

### Breakpoints (nuevo en Fase 10)

Las CSS custom properties no pueden usarse dentro de la condición de un
`@media` (limitación real de CSS) — estos son los valores literales que
cualquier `@media` nuevo debe repetir:

| Nombre | Valor | Uso |
|---|---|---|
| `--breakpoint-tablet` | 768px | Punto donde el sidebar se angosta y el topbar oculta nombre/rol. |
| `--breakpoint-desktop-sm` | 1024px | Mismo punto de quiebre usado hoy (`AppLayout.css`). |
| `--breakpoint-desktop` | 1280px | Ancho de referencia de las capturas/pruebas de este documento. |

## Elemento de firma: el Sello de Estado

En vez de una simple etiqueta de color (badge) para decir "Aprobado /
Pendiente / Rechazado" — que es el recurso más genérico y menos
accesible que existe — Alarfly usa un **sello**: un círculo de doble
anillo con un glifo adentro, igual en todos los módulos (asientos,
periodos, órdenes de pago, gastos de caja chica, alertas).

```
  ╭───╮
 ╭│ ✓ │╮   Aprobado — anillo Verificado (#6E9B7B)
 ╰│   │╯
  ╰───╯

  ╭───╮
 ╭│ ⏵ │╮   Pendiente — anillo Alerta (#C9A227)
 ╰│   │╯
  ╰───╯

  ╭───╮
 ╭│ ✕ │╮   Rechazado — anillo Objeción (#B4695E)
 ╰│   │╯
  ╰───╯
```

Reglas del Sello de Estado:
- Siempre va **con texto al lado** ("Aprobado"), nunca solo el ícono —
  para que no dependa únicamente del color ni de reconocer un símbolo.
- Mismo componente en todos los módulos — un asiento aprobado y un
  periodo cerrado usan visualmente la misma idea de "sello", aunque el
  texto cambie.
- El acento de marca (`--color-brand`, rojo vino) se usa en TODO el
  sistema únicamente para: el botón de acción principal de cada
  formulario, montos destacados, elementos activos, y el número
  "titular" de una tarjeta de KPI — nunca como decoración ni como color
  de un estado del propio Sello (el Sello usa sus 3 anillos semánticos
  — Verificado/Alerta/Objeción — nunca el color de marca).

## Auditoría de duplicaciones (Fase 10)

- **Botón**: existen DOS implementaciones visualmente idénticas —
  `core/ui/Button.jsx` (componente React, clases `.ui-btn*`) y las
  clases planas `.btn`/`.btn-primary`/`.btn-danger` de `module.css`,
  usadas directo en 78 archivos `.jsx` (contra 1 solo archivo que usa
  `<Button>`). Ya comparten exactamente los mismos tokens/valores
  (verificado línea por línea) — la duplicación es de código, no de
  apariencia. Consolidar las 78 pantallas a `<Button>` es un refactor
  mecánico de bajo riesgo pero de tamaño considerable — **pendiente
  para una fase futura**, documentado a propósito en vez de apurarlo.
- **Modal/diálogo**: `ConfirmContext`, `QuickCreateModal` e
  `ImportWizard` reimplementan cada uno su propio overlay + panel en
  vez de compartir un `core/ui/Modal.jsx` — pero los 3 ya usan
  exactamente los mismos tokens (`--color-overlay`, `--shadow-modal`
  desde esta fase, `--radius-lg`), así que ya son visualmente idénticos.
  Extraer un `Modal` compartido queda como mejora de mantenibilidad,
  no de apariencia — **pendiente para una fase futura**.
- **Badge/Estado**: `StatusSeal` ya es el patrón dominante (41 archivos)
  contra apenas 1 uso de la clase `.badge` suelta — sin duplicación real
  que consolidar.
- **Bug real encontrado y corregido**: `.ui-btn-primary` (el componente
  `Button`) usaba `color: var(--color-bg)` para el texto — una
  coincidencia del dorado anterior, donde `--color-bg` y el texto
  "correcto" sobre el botón daban por casualidad el mismo tono oscuro.
  Con el rojo nuevo eso se volvió **texto casi negro sobre fondo vino**,
  prácticamente ilegible (confirmado con el color computado real:
  `rgb(11,13,16)` sobre `rgb(156,39,64)`). Mismo bug encontrado en 4
  lugares más (`AppLayout` — el logo "A", `QuickCreateFab`, `FilterBuilder`,
  `::selection`) — los 5 corregidos a `--color-on-accent`, el token que
  ya existía justo para este caso.
- **Bug real encontrado y corregido, preexistente (no introducido por
  esta fase)**: cualquier `<input>`/`<select>` suelto dentro de una
  celda de `<table className="data-table">` (ej. las líneas de una
  factura) nunca estaba envuelto en `.field` — la única regla que le
  daba fondo/borde oscuro — así que cada uno caía en el blanco por
  defecto del navegador, con el texto casi blanco del tema encima
  (prácticamente invisible). Corregido con una regla nueva y aditiva
  (`.data-table input/select/textarea`), sin tocar ningún `.jsx` —
  arregla el patrón en cualquier tabla del proyecto que lo tuviera,
  no solo la que lo hizo evidente.

## Componentes base (`frontend/src/core/ui`)

Toda pantalla de módulo construye ÚNICAMENTE con estos componentes —
no se crean estilos de botón/tabla/formulario nuevos por módulo:

- `Button` (`primary` rojo vino sólido, `secondary` con borde grafito, `danger` terracota, tamaños `md`/`sm`)
- `StatusSeal` (el sello de estado descrito arriba, props `status` + `label`)
- `DataTable` (encabezado en mayúsculas Inter 11px, números con `tabular-nums`, fila con hover sutil)
- `FormField` (label + input/select + `HelpTooltip` opcional + mensaje de error en línea, nunca solo el borde en rojo)
- `Card` / `Panel` (contenedor con `--shadow-card`, título en `--text-h2`)
- `ConfirmDialog` (ya existe como `ConfirmContext`, se mantiene igual)
- `EmptyState` (icono + frase que invita a la acción + botón, nunca solo "No hay datos")
- `StatHero` (la cifra grande de un KPI, en Source Serif 4, con línea de marca fina debajo cuando es el número principal de la tarjeta)

## Iconografía (`frontend/src/core/ui/Icon.jsx`)

Un solo set de íconos para toda la aplicación — dibujados a mano en
SVG trazado, sin librería externa (mismo criterio ya usado para los
gráficos del proyecto: nada de dependencias nuevas solo para esto).
Ningún componente nuevo elige su propio ícono suelto (emoji, glifo
Unicode) — si hace falta un ícono que todavía no existe, se agrega su
`path` al registro de `Icon.jsx`, en un solo lugar.

- **Trazo**: `strokeWidth="1.75"`, sin relleno (`fill="none"`),
  `strokeLinecap`/`strokeLinejoin` en `"round"` — mismo grosor y
  terminación en los 24 puntos del `viewBox` (`0 0 24 24`), sin
  excepción por ícono.
- **Tamaño base**: 20px (`size` por defecto de `<Icon>`), con la opción
  de pasar un `size` mayor solo cuando el propio botón que lo contiene
  ya es más grande (ej. el botón flotante de creación rápida, 24px).
- **Accesibilidad**: el SVG en sí siempre queda decorativo
  (`aria-hidden="true"`) — el nombre accesible lo da el elemento que lo
  envuelve (`aria-label`/`title` del botón), nunca el ícono solo.
- **Modo "principiante"** (`UserPreference.beginnerIconLabels`,
  configurable en Mi Cuenta > Preferencias, empieza en `true`):
  mientras está activo, `<Icon name="..." label="...">` muestra también
  la etiqueta de texto visible al lado del ícono — el mismo componente,
  sin ninguna condición que escribir en cada pantalla que lo usa. Un
  ícono dentro de un contenedor de tamaño fijo (ej. un botón flotante
  circular) puede omitir `label` a propósito si agregar texto rompería
  su forma — documentado caso por caso en el código, no una regla
  general.

## Layout de la aplicación y responsive (Fase 10)

`AppLayout.jsx`/`.css` es el shell de toda la app (sidebar + topbar +
contenido). Desde Fase 10:

- **Sidebar de altura fija** (`position: sticky; top: 0; height: 100vh`),
  con una única zona de scroll interno (`.app-nav-main`, la lista de
  módulos) — el encabezado (marca) y el pie (Cerrar sesión + hint) se
  quedan siempre visibles, nunca se pierden detrás de contenido que
  no entra. Corrige un hallazgo real de Fase 9 (el botón flotante de
  ayuda contextual se superponía visualmente al último ítem del menú).
- **Áreas conceptuales del sidebar** (Fase 9, sin cambios en Fase 10):
  OPERACIONES/FINANZAS/CONTROL/ANALÍTICA/CONFIGURACIÓN como encabezados
  de sección sobre los módulos reales — Inicio queda sin encabezado.
- **Responsive**: auditado con Playwright a 1280/1024/768px. Hallazgo
  real: por debajo de 1024px había scroll horizontal (827px de
  contenido en un viewport de 768px), causado por el sidebar fijo de
  240px más el bloque de usuario del topbar sin comprimir. Corregido
  con un único `@media (max-width: 1024px)`: el sidebar se angosta a
  200px y el nombre/rol de texto del topbar se oculta (el avatar y
  todos los botones reales — moneda, incógnito, notificaciones, cerrar
  sesión — siguen intactos). **Alcance reconocido**: esto resuelve el
  chrome de la aplicación (siempre visible); no se auditó ni se
  rediseñó el contenido interno de cada una de las ~150 pantallas para
  mobile — documentado como pendiente honesto, no silencioso.

## Principios de UX (además de la paleta/tipografía)

Estos ya son regla permanente en `CLAUDE.md`, se listan aquí para que
queden junto a su implementación visual:

1. **Lenguaje simple y humano en toda la interfaz.** Nunca jerga
   técnica/contable en botones, títulos o mensajes — la jerga contable
   solo aparece dentro de un `HelpTooltip`, nunca en el texto principal.
2. **Un mismo nombre de acción en todo su flujo.** Si el botón dice
   "Registrar gasto", la confirmación y el mensaje de éxito también
   dicen "gasto registrado" — nunca cambia a sinónimos a mitad de
   camino ("gasto", "movimiento", "transacción" para lo mismo).
3. **Errores explicados con solución, nunca un error técnico crudo.**
   "No se puede eliminar esta cuenta porque ya tiene movimientos" en
   vez de "Error 409: ACCOUNT_HAS_MOVEMENTS".
4. **Estados vacíos que invitan a la acción.** "Todavía no registraste
   ninguna cuenta — crea la primera" con su botón, no una tabla en
   blanco.
5. **Formularios que validan en tiempo real**, no solo al enviar (ej.
   el cuadre de un asiento ya se ve mientras se escribe).
6. **Accesibilidad básica**: contraste mínimo AA sobre el fondo tinta,
   foco visible (anillo de marca, `--color-brand`) en todo elemento interactivo,
   texto nunca menor a 11px, el Sello de Estado nunca depende solo del
   color.

## Checklist antes de dar por terminado un módulo

Antes de pasar al recorrido guiado de cualquier pantalla nueva:

- [ ] Usa solo componentes de `frontend/src/core/ui`, ningún estilo aislado
- [ ] Paleta y tipografía de este documento, sin colores ni fuentes sueltas
- [ ] Todo estado (aprobado/pendiente/rechazado/activo/inactivo) usa `StatusSeal`
- [ ] Cero jerga técnica fuera de un `HelpTooltip`
- [ ] Mismo nombre de acción en botón → confirmación → mensaje de éxito
- [ ] Errores en lenguaje simple con la solución, no el error crudo del backend
- [ ] Estados vacíos con invitación a la acción
- [ ] Validación en tiempo real donde aplique
- [ ] Contraste y foco visible revisados
