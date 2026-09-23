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
"tinta", texto tipo "papel", y un solo acento dorado reservado para lo
que de verdad importa — nunca decorativo.

Esto es intencional y distinto de un dashboard SaaS genérico
(Tailwind/shadcn azul-sobre-blanco): buscamos transmitir **orden,
permanencia y verificación**, no "producto tecnológico moderno".

## Paleta de color

| Nombre | Hex | Uso |
|---|---|---|
| **Tinta** (fondo) | `#0B0D10` | Fondo de toda la aplicación. Negro mate con un dejo azulado, nunca negro puro. |
| **Papel** (superficie) | `#14171C` | Tarjetas, paneles, filas de tabla. |
| **Papel elevado** | `#1B1F26` | Modales, menús, elementos "por encima" del resto. |
| **Grafito** (bordes) | `#2A2F38` | Bordes, separadores, líneas de tabla. |
| **Hueso** (texto principal) | `#EDEFF2` | Texto de lectura principal. Blanco roto, nunca `#fff` puro. |
| **Plomo** (texto secundario) | `#8B93A1` | Etiquetas, texto de apoyo, marcas de tiempo. |
| **Sello** (acento de marca) | `#C9A227` | El único acento cálido del sistema. Reservado para: el botón de acción principal de cada pantalla, montos destacados, y el Sello de Estado (ver abajo). Nunca decorativo, nunca en más de 1-2 lugares por pantalla. |

**Estados** (siempre en tono apagado, nunca el verde/rojo brillante de
semáforo — ver "Sello de Estado" para cómo se comunican sin depender
solo del color):

| Nombre | Hex | Uso |
|---|---|---|
| Verificado | `#6E9B7B` | Aprobado, activo, al día — verde apagado tipo musgo. |
| Alerta | `#C9A227` (mismo Sello) | Pendiente, requiere atención — reutiliza el dorado de marca. |
| Objeción | `#B4695E` | Rechazado, vencido, error — terracota apagado, nunca rojo puro. |

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

Sombras discretas, nunca "flotantes" — el objetivo es dar la sensación
de una hoja apoyada sobre otra, no de elementos suspendidos en el aire:

```
--shadow-card: 0 1px 2px rgba(0,0,0,.4), 0 6px 16px rgba(0,0,0,.3);
--shadow-elevated: 0 4px 10px rgba(0,0,0,.5), 0 14px 32px rgba(0,0,0,.4);
```

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
 ╭│ ⏵ │╮   Pendiente — anillo Sello (#C9A227)
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
- El color dorado del Sello (`#C9A227`) se usa en TODO el sistema
  únicamente para: este sello en estado pendiente, el botón de acción
  principal de cada formulario, y el número "titular" de una tarjeta
  de KPI — nunca como decoración.

## Componentes base (`frontend/src/core/ui`)

Toda pantalla de módulo construye ÚNICAMENTE con estos componentes —
no se crean estilos de botón/tabla/formulario nuevos por módulo:

- `Button` (`primary` dorado sólido, `secondary` con borde grafito, `danger` terracota, tamaños `md`/`sm`)
- `StatusSeal` (el sello de estado descrito arriba, props `status` + `label`)
- `DataTable` (encabezado en mayúsculas Inter 11px, números con `tabular-nums`, fila con hover sutil)
- `FormField` (label + input/select + `HelpTooltip` opcional + mensaje de error en línea, nunca solo el borde en rojo)
- `Card` / `Panel` (contenedor con `--shadow-card`, título en `--text-h2`)
- `ConfirmDialog` (ya existe como `ConfirmContext`, se mantiene igual)
- `EmptyState` (icono + frase que invita a la acción + botón, nunca solo "No hay datos")
- `StatHero` (la cifra grande de un KPI, en Source Serif 4, con línea dorada fina debajo cuando es el número principal de la tarjeta)

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
   foco visible (anillo dorado sutil) en todo elemento interactivo,
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
