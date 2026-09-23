# Arquitectura Maestra — Alarfly

> Este documento es el "plano del edificio". Se escribe una sola vez al inicio
> y se actualiza solo si cambia una decisión estructural grande. El detalle de
> cada módulo (submódulos, pantallas, reglas) se documenta aparte, módulo por
> módulo, a medida que se construye.

## 1. Qué es Alarfly

Plataforma de gestión financiera integral para empresas físicas y digitales
(pequeñas, medianas y grandes). Un solo sistema donde todo lo que pasa con el
dinero de la empresa —ventas, compras, bancos, impuestos, inventario,
presupuestos— queda registrado y conectado, sin que el usuario tenga que
entender de programación ni de contabilidad técnica para usarlo.

Los 8 módulos:

1. **Contabilidad** — el libro mayor. El corazón del sistema.
2. **Tesorería** — bancos, caja, flujo de efectivo.
3. **Cuentas por Cobrar (AR)** — lo que los clientes le deben a la empresa.
4. **Cuentas por Pagar (AP)** — lo que la empresa le debe a proveedores.
5. **Inventario** — productos, existencias, costos.
6. **Fiscal** — impuestos y obligaciones ante el gobierno.
7. **FP&A** — planificación y análisis financiero (presupuestos, proyecciones).
8. **Reportes** — tableros y reportes para tomar decisiones.

## 2. Filosofía de diseño

- **Simple para el usuario, ordenado por dentro.** La complejidad técnica se
  esconde en el "core"; el usuario solo ve formularios y botones claros.
- **Un solo dueño de la verdad por dato.** Cada dato vive en un módulo dueño;
  los demás lo consultan o reaccionan a él, nunca lo duplican a mano.
- **Todo lo que mueve dinero termina en Contabilidad.** Es la regla de oro:
  ninguna transacción queda "suelta"; todo módulo que genera una operación
  financiera termina generando un asiento contable, automáticamente.
- **Construir en capas, de adentro hacia afuera.** Primero la base
  (core + Contabilidad), luego los módulos operativos, luego los módulos de
  análisis que dependen de que ya haya datos que analizar.

## 3. El Core (núcleo compartido)

El Core es la base común que todos los módulos usan. No es un módulo de
negocio, es la "cimentación del edificio". Vive en `/core` y contiene:

| Pieza | Para qué sirve (explicado simple) |
|---|---|
| **Base de datos** | Un único lugar donde vive toda la información, organizado por empresa (multi-empresa). |
| **Empresas y usuarios** | Quién usa el sistema, a qué empresa pertenece, qué le está permitido hacer (roles y permisos). |
| **Plan de Cuentas** | La "lista maestra de cajones" donde se clasifica cada movimiento de dinero (ej: Caja, Bancos, Ventas, Impuestos por pagar). Vive en el core porque **todos** los módulos lo usan para saber dónde registrar sus operaciones. |
| **Motor de Asientos Contables** | El servicio único que sabe "escribir" en el libro contable. Ningún módulo escribe directo en Contabilidad: todos le piden a este motor que registre el movimiento, y él garantiza que quede balanceado y correcto. |
| **Bus de Eventos** | El "sistema de mensajería interna" entre módulos (ver sección 4). |
| **Multi-moneda y periodos** | Manejo de monedas y de los periodos contables (meses/años) que abre y cierra la empresa. |
| **Servicios comunes** | Autenticación (login), permisos, auditoría (quién hizo qué y cuándo), manejo de archivos/adjuntos. |

Regla práctica: si dos o más módulos necesitan lo mismo, eso vive en el core.
Si es propio de un solo módulo, vive dentro de ese módulo.

## 4. Cómo se comunican los módulos entre sí

Dos mecanismos, cada uno para un caso distinto — como el correo interno de
una empresa:

### a) Llamada directa a un servicio del Core (para lo indispensable)
Cuando un módulo **necesita una respuesta inmediata** para poder continuar.
Ejemplo: Cuentas por Pagar registra una factura de proveedor → le pide **en
el momento** al Motor de Asientos Contables que registre el movimiento, y
espera confirmación de que quedó bien registrado antes de decir "factura
guardada" al usuario.

### b) Eventos (para reacciones que pueden pasar "después")
Cuando un módulo hace algo y **otros módulos deben enterarse y reaccionar**,
pero no es necesario esperar la respuesta al instante.
Ejemplo: Inventario registra la salida de un producto por una venta → emite
el evento `inventario.salida_registrada` → Contabilidad lo escucha y genera
el asiento de costo de venta; FP&A lo escucha y actualiza sus proyecciones.
Inventario no necesita saber quién más está escuchando ni esperar por ellos.

**Regla para decidir cuál usar:** si el flujo se rompe sin esa respuesta
inmediata → llamada directa. Si es una consecuencia que puede procesarse en
segundo plano → evento.

### c) Módulos de solo lectura (Reportes y FP&A)
Estos dos módulos **no generan movimientos de dinero**, solo leen y analizan
lo que ya registraron los demás. Nunca escriben en otros módulos; solo
consultan. Esto evita que un reporte "contamine" los datos operativos.

## 5. Mapa de dependencias (quién necesita a quién)

```
Core (empresas, usuarios, plan de cuentas, motor de asientos, eventos)
   │
   └── Contabilidad  (usa el motor de asientos del core; es el libro mayor)
         │
         ├── Tesorería            (registra en Contabilidad: bancos y caja)
         ├── Cuentas por Cobrar   (registra en Contabilidad: facturas de venta y cobros)
         ├── Cuentas por Pagar    (registra en Contabilidad: facturas de compra y pagos)
         ├── Inventario           (registra en Contabilidad: costo de venta e inventario)
         ├── Fiscal               (lee Contabilidad + AR/AP para calcular impuestos)
         │
         ├── FP&A       (solo lectura: usa datos históricos de todos los anteriores)
         └── Reportes   (solo lectura: usa datos de todos los anteriores, incluido FP&A)
```

## 6. Orden de construcción por fases

No se construyen los 8 módulos a la vez ni en orden arbitrario: cada fase
deja lista la base que necesita la siguiente.

- **Fase 0 — Core:** proyecto base, base de datos, empresas/usuarios/roles,
  plan de cuentas, motor de asientos contables, bus de eventos.
- **Fase 1 — Contabilidad:** libro mayor, asientos, estados financieros
  básicos. (Sin esto, ningún otro módulo tiene dónde registrar nada.)
- **Fase 2 — Tesorería:** bancos, caja, conciliación, flujo de efectivo.
- **Fase 3 — Cuentas por Cobrar y Cuentas por Pagar:** facturación,
  cobros y pagos (se construyen en paralelo porque son espejo uno del otro).
- **Fase 4 — Inventario:** productos, existencias, costos (se conecta con
  AR al vender y con AP al comprar).
- **Fase 5 — Fiscal:** impuestos, calculados sobre lo que ya generaron
  Contabilidad, AR, AP e Inventario.
- **Fase 6 — FP&A:** presupuestos y proyecciones, ya con datos reales
  históricos disponibles para comparar.
- **Fase 7 — Reportes:** tableros y reportes finales, integrando todo.

## 7. Tecnología (decisiones técnicas, resumidas)

- **Node.js + Express** para el servidor y la API. Se eligió Express sobre
  NestJS porque el sistema ya tiene su propia arquitectura de módulos y
  comunicación definida en este documento; Express da control directo sin
  imponer otro sistema de módulos/inyección de dependencias encima del
  nuestro, con menos conceptos que aprender y menos código de "andamiaje".
- **PostgreSQL** como base de datos (robusta, escalable, estándar en fintech).
- **Prisma** como ORM (permite trabajar con la base de datos sin escribir
  SQL a mano en cada módulo, con un esquema único y legible en
  `prisma/schema.prisma`).
- **Zod** para validar los datos que entran a la API (ej: que un monto sea
  numérico y positivo) antes de procesarlos.
- **JWT** para sesiones de usuario (login seguro).
- **EventEmitter interno** como bus de eventos entre módulos (sección 4b).
- Cada módulo vive en su propia carpeta con la misma estructura interna
  (rutas, controladores, servicios, modelos), para que aprender uno sea
  aprender a todos.

## 8. Dónde queda registrado el avance

El detalle vivo de qué se ha construido en cada módulo, sus submódulos y
decisiones específicas se lleva en `CLAUDE.md` (raíz del proyecto), que se
actualiza cada vez que se cierra una pieza de trabajo. Este archivo
(`ARQUITECTURA_MAESTRA.md`) es el plano estable; `CLAUDE.md` es la bitácora
que evoluciona con el proyecto.
