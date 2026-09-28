# INTEGRATIONS_ARCHITECTURE.md — Fase 13: Integraciones y Ecosistema

> Este documento es el equivalente de `AI_ARCHITECTURE.md` pero para
> integraciones externas (bancos, sistemas fiscales, APIs de terceros,
> webhooks, importadores/exportadores). Igual que aquel, es
> **mayoritariamente documental**: la auditoría de esta fase encontró
> que Alarfly hoy no tiene ninguna integración externa real que
> conectar (ningún banco, proveedor fiscal, marketplace o desarrollador
> externo concreto fue nombrado por el usuario) — así que construir
> infraestructura "genérica" (motor de webhooks, gateway de API,
> servidor OAuth, motor de sincronización universal) sin un caso de uso
> real detrás sería exactamente la "sobre-ingeniería especulativa" que
> esta fase prohíbe explícitamente. En vez de eso, este documento dejó
> el terreno **mapeado y decidido en principio**, para que el día que
> aparezca un caso real (ej. "conectar con el banco X", "necesitamos
> que el sistema Y nos avise por webhook"), la decisión de diseño ya
> esté tomada y solo falte construir el caso concreto.

## 0. Resultado resumido de la auditoría

Antes de diseñar nada, se auditó todo el código en busca de cualquier
integración externa ya existente o parcialmente construida. Resultado:

**Ya existe (y es correcto, no se duplicó nada):**
- `core/import` + `core/import-templates`: importación genérica de
  CSV/Excel (arrastrar archivo → mapear columnas → vista previa →
  ejecutar), **manual, iniciada por el usuario**, nunca un feed
  automático. El archivo viaja en base64 dentro del body JSON (mismo
  patrón que los feeds bancarios), nunca se guarda en disco.
- `modules/treasury/services/parsers/` (CSV/OFX/MT940): mismo patrón
  adapter, para extractos bancarios — también manual/"pull" (el
  usuario sube el archivo), no una conexión en vivo con un banco.
- `modules/fiscal/services/electronic-invoicing/providers/`: patrón
  adapter con un único adaptador `MOCK` — nunca se conectó un
  proveedor fiscal real (DIAN, SAT, etc.), documentado como pendiente
  desde que se construyó.
- `core/utils/exporters/` (CSV/Excel/PDF): motor de exportación
  genérico, ya reutilizado por Reportes y Análisis Avanzados — no se
  encontró ninguna razón para tocarlo en esta fase.
- `PaymentMethod` (Prisma): una tabla simple de etiquetas
  (`code`/`name`/`isActive`) por empresa — **no es una pasarela de
  pago ni una integración con un procesador real**, es solo la forma
  en que AR/AP clasifican un cobro/pago (ej. "Efectivo", "Transferencia").
- Exactamente 2 campos `externalId` en todo el schema:
  `BankTransaction.externalId` (dedup al reimportar un extracto,
  único por `treasuryAccountId`) y
  `FiscalElectronicDocument.externalDocumentId` (folio que devolvería
  un proveedor fiscal real). Ambos ya resuelven bien su propio caso
  puntual — no hay necesidad de generalizarlos.
- `core/alerts.createAlertIfNotExists`: idempotencia por fila activa,
  ya reutilizada por 12 tipos de alerta distintos — es el patrón de
  idempotencia de facto del proyecto.
- `core/jobs` (`runJob`, rutas `/jobs/status`/`/jobs/runs`,
  solo ADMIN): observabilidad real de los 9 cron jobs — cuándo corrió
  cada uno, con qué resultado.
- `core/audit`: sistema único de auditoría, ya reutilizado por todos
  los módulos.

**No existe (confirmado por búsqueda exhaustiva en todo `src/`):**
- Cero webhooks, entrantes o salientes (`grep -i webhook` → 0
  resultados reales).
- Cero rate limiting (`grep -i "rate.?limit\|throttle"` → 0
  resultados; no hay ninguna dependencia de rate-limiting en
  `package.json`).
- Cero versión de API (`/v1`, `/api/`, etc. — todas las rutas se
  montan directo en la raíz, ver `src/app.js`).
- Cero mecanismo de autenticación para terceros (API keys, OAuth,
  HMAC) — solo existe `core/auth` (JWT de sesión humana con login por
  contraseña/2FA).
- Cero cliente HTTP saliente instalado (`package.json` no tiene
  `axios`/`node-fetch`/similar) — el proyecto nunca ha llamado a un
  servicio externo desde el backend.
- Cero conexión bancaria en tiempo real (Open Banking/Plaid) — decisión
  ya documentada explícitamente en `CLAUDE.md` desde Tesorería punto 2.
- Cero proveedor fiscal real conectado — solo el adaptador `MOCK`.
- CORS configurado sin restricción de origen (`app.use(cors())`, sin
  lista blanca) — no es un hallazgo nuevo de esta fase ni algo que se
  vaya a tocar sin conocer los orígenes reales de producción (ver
  sección 10).

Con esta base, la conclusión de esta fase es: **no hay ninguna
integración externa concreta que construir hoy**. Lo que sigue es el
mapa de decisiones para cuando sí la haya.

## 1. Fuente de la verdad por dominio (Source of Truth)

Alarfly **nunca** debe tratarse como una copia de datos externos —
sigue siendo la autoridad de sus propios registros contables/fiscales,
aunque en el futuro se conecte con un sistema externo que también
tenga su propia versión de "la verdad" sobre algo:

| Dominio | Quién es la autoridad | Por qué |
|---|---|---|
| Asientos contables (`JournalEntry`) | **Alarfly, siempre** | `core/ledger.postEntry` es el único punto de escritura del sistema (regla de oro de la arquitectura). Ninguna integración futura puede escribir un asiento sin pasar por ahí — ni siquiera una conexión bancaria en vivo. |
| Movimiento bancario individual (`BankTransaction`) | **El banco**, hasta que se concilia | El banco es la fuente de qué pasó realmente en la cuenta. Alarfly registra el movimiento importado tal cual, pero decidir **qué significa contablemente** ese movimiento (a qué asiento corresponde, si genera uno nuevo) sigue siendo autoridad de Alarfly vía `core/ledger`, nunca automático. Ver sección 8. |
| Impuestos/retenciones aplicables (`TaxRate`) | **Alarfly** (configurado a mano hoy) | Si se conecta un proveedor fiscal real, el folio/aceptación del comprobante sí sería autoridad del proveedor (`FiscalElectronicDocument.externalDocumentId`), pero el cálculo del impuesto en sí sigue siendo el motor fiscal ya existente — un proveedor de facturación electrónica timbra, no recalcula impuestos. |
| Catálogo de clientes/proveedores (`Customer`/`Vendor`) | **Alarfly** | No existe hoy ninguna sincronización con un CRM/ERP externo. Si se conecta uno, Alarfly seguiría siendo la autoridad de "qué cliente puede facturar" (límite de crédito, bloqueos) — un CRM externo podría alimentar datos de contacto, nunca las reglas de negocio de crédito. |
| Tasa de cambio (`ExchangeRate`) | **Fuente externa** (hoy cargada a mano) | Es el único dominio donde Alarfly ya reconoce que el dato "vive afuera" — por diseño no inventa una tasa si no hay una registrada. |

**Principio general para cualquier integración futura**: una integración
externa puede **alimentar** datos hacia Alarfly (ej. un extracto
bancario, un catálogo de productos de un e-commerce), pero nunca puede
**saltarse** un motor de dominio ya existente (Ledger, motor fiscal,
límite de crédito, bloqueo de periodo, RBAC). Esto ya se cumple hoy
porque ningún importador escribe tablas de dominio directo — todos
pasan por el servicio de dominio correspondiente (`createFiscalTransaction`,
`core/ledger.postEntry`, etc.).

## 2. Autenticación para terceros: API Keys, no OAuth

Se evaluaron 3 mecanismos, siguiendo la instrucción explícita de "no
introducir OAuth solo porque es un estándar":

| Mecanismo | Evaluación |
|---|---|
| **OAuth2** | Requiere un servidor de autorización completo (pantallas de consentimiento, refresh tokens, client registration) — apropiado cuando un tercero actúa **en nombre de un usuario humano** que inicia sesión con sus credenciales de Alarfly. Ningún caso de uso de este tipo existe hoy (no hay "iniciar sesión con Alarfly" desde una app externa). Construir esto ahora sería el servidor OAuth completo que esta fase prohíbe explícitamente construir sin justificación. |
| **JWT de sesión humana (`core/auth`, ya existente)** | Correcto para usuarios humanos en el navegador; incorrecto para un sistema-a-sistema sin usuario humano detrás (un JWT de sesión expira en 8h y depende de un login con contraseña/2FA, que no aplica a un servidor externo). |
| **API Keys por empresa, con scopes (recomendado, NO implementado todavía)** | El patrón correcto para "un sistema externo llama a la API de Alarfly en nombre de una empresa concreta, sin un usuario humano de por medio" — mismo criterio que la mayoría de APIs financieras B2B (Stripe, Plaid, etc.). Diseño conceptual: una tabla `ApiCredential` (companyId, hash de la key — nunca la key en texto plano, mismo criterio que ya usa `passwordHash` —, `scopes: string[]`, `isActive`, `lastUsedAt`, `createdByUserId`, auditado en `core/audit`), un middleware `requireApiKey` paralelo a `requireAuth` (no lo reemplaza) que resuelve `req.auth = {companyId, scopes, isApiKey: true}` y un principio ya anticipado en `AI_ARCHITECTURE.md`: **`permisos del tercero ⊆ scopes otorgados ⊆ autorización de la empresa`** — igual patrón que `AI permissions ⊆ USER permissions` de F12-B. |

**Decisión**: no se implementa `ApiCredential` en esta fase — no hay
ningún tercero real que vaya a consumir la API todavía (ningún
desarrollador externo, ninguna integración de e-commerce/marketplace
fue nombrada). El diseño queda listo para construirse en cuanto
aparezca el primer consumidor real, sin necesitar rediseñar nada.

## 3. Webhooks — diseño conceptual (NO implementado)

### 3.1 Entrantes (un sistema externo notifica a Alarfly)

```
SISTEMA EXTERNO → AUTENTICACIÓN → VALIDACIÓN DE FIRMA → IDEMPOTENCIA
                → VALIDACIÓN DE PAYLOAD → SERVICIO DE DOMINIO → AUDITORÍA → RESPUESTA
```

Principios ya decididos para cuando se construya:
- **Nunca confiar solo en `companyId` + un secreto estático en la URL**
  (patrón inseguro común) — cada empresa tendría su propio secreto de
  firma (`WebhookEndpoint.signingSecret`, cifrado en reposo con el
  mismo `core/utils/crypto.js` que ya cifra el secreto TOTP de 2FA —
  reutilizado, no un cifrado nuevo), y el payload se valida con HMAC-SHA256
  sobre el cuerpo crudo + un timestamp (para descartar "replay" de una
  petición capturada y reenviada más tarde — ventana de tolerancia,
  ej. 5 minutos).
- **Idempotencia obligatoria**: cada evento entrante trae un
  `eventId` propio del sistema externo; se guarda en una tabla de
  eventos procesados (`WebhookEvent.externalEventId`, único por
  `webhookEndpointId`) ANTES de ejecutar cualquier efecto — mismo
  principio que `BankTransaction.externalId` ya aplica hoy a los
  extractos bancarios, generalizado.
- **Nunca escribe tablas de dominio directo**: el handler de un
  webhook siempre llama a un servicio de dominio ya existente
  (`core/ledger.postEntry`, `createFiscalTransaction`, etc.), igual
  que ya hace `core/import`.
- **Se audita como cualquier otra escritura** (`core/audit.log`, con
  `userId: null` y una nota de que el origen fue un webhook — el mismo
  patrón que los cron jobs ya atribuyen a un usuario ADMIN cuando no
  hay un actor humano).

### 3.2 Salientes (Alarfly notifica a un sistema externo)

```
ALARFLY → EVENTO DE DOMINIO → CONSTRUCCIÓN DE PAYLOAD → FIRMA → ENTREGA (HTTP POST)
        → REINTENTO CON BACKOFF (si falla) → REGISTRO DE ESTADO DE ENTREGA
```

**Decisión explícita**: no se construye ninguna infraestructura de
entrega (colas, reintentos con backoff exponencial, dead-letter) en
esta fase — la propia instrucción de la fase lo dice literalmente
("no construir infraestructura enterprise completa si todavía no
existe un consumidor real"). Hoy no existe ningún sistema externo que
Alarfly deba notificar. El punto de extensión más parecido que ya
existe en el proyecto es `core/alerts` (que genera un evento de dominio
ante una condición) — el día que se necesite un webhook saliente real,
lo más simple y coherente es que sea un nuevo "canal de notificación"
del lado de `AlertRule`/`UserNotificationPreference` (que ya modelan
"in-app / email / push" por tipo de alerta), agregando "webhook" como
un cuarto canal — no un motor de eventos nuevo y paralelo.

## 4. Importación financiera: contrato de 7 pasos, ya cumplido

Se verificó el flujo real de `core/import` + `customers.service.importCustomers`
(el único importador de datos de negocio construido hasta ahora)
contra el contrato exigido por esta fase:

1. **Recibir el archivo** — `POST /import/parse` (base64 en JSON). ✅
2. **Validar estructura** — `parseTabularFile` exige extensión
   csv/xlsx/xls y al menos una fila de datos, o rechaza con `AppError`
   claro (nunca un stack trace). ✅
3. **Validar datos** — el asistente (`ImportWizard`, frontend) valida
   tipo por columna antes de dejar avanzar (ej. una columna numérica
   con texto bloquea el avance). ✅
4. **Mostrar errores claros** — confirmado (bug ya corregido en una
   sesión anterior: `friendlyImportError()` traduce cualquier error de
   Prisma, nunca expone el texto crudo). ✅
5. **Permitir revisión antes de confirmar** — el asistente muestra una
   vista previa de las primeras 5 filas ya transformadas antes de
   ejecutar. ✅
6. **Ejecutar dentro de una transacción de dominio** — aquí hay un
   matiz ya documentado a propósito en `CLAUDE.md`: `importCustomers`
   crea **fila por fila, no en una única transacción global**, para
   que una fila mala no tumbe las que sí eran válidas — cada fila
   reporta su propio resultado. Es una decisión consciente, no un
   descuido: una importación de clientes no tiene una regla de "todo o
   nada" real (a diferencia de un asiento contable, que si necesita
   atomicidad total vía `core/ledger`). Documentado aquí para que
   quede explícito que este paso del contrato se cumple con una
   variante intencional, no que se salta.
7. **Auditar la importación** — cada `Customer.create` pasa por el
   servicio normal de dominio, que ya audita su propia creación
   (`core/audit`) — no hay un registro adicional de "se importó un
   lote de N clientes" como evento propio. **Oportunidad real,
   menor, no implementada**: agregar una entrada de auditoría a nivel
   de LOTE (no solo por fila) haría más fácil auditar "quién importó
   qué archivo y cuándo" de un vistazo. Se documenta como mejora
   pendiente, no se implementó en esta fase porque no es un problema
   de seguridad ni de integridad de datos — es una mejora de
   trazabilidad de conveniencia.

**Ninguna importación financiera existe todavía** (solo el catálogo de
Clientes) — no hay una importación de facturas, asientos o pagos en
lote. Si se construyera una, debe cumplir los mismos controles que ya
exige el resto del sistema (bloqueo de periodo, motor fiscal, límite
de crédito, RBAC) — nunca un atajo por CSV, tal como exige
explícitamente esta fase. Documentado como principio, no como código,
porque no existe todavía ese importador.

## 5. Bancos: por qué no se conecta un banco real en esta fase

Se evaluó explícitamente conectar un banco real (Open Banking/Plaid) y
se descartó, por el mismo motivo ya documentado desde 2026-07-12 en
`CLAUDE.md`: **el usuario nunca nombró un banco, país o proveedor
concreto**. Conectar "un banco genérico" sin esos datos sería
inventar un proveedor — exactamente lo que esta fase prohíbe
("no inventar proveedores... documentar 'NO VALIDADO' en vez de
simular").

**Distinción de autoridad ya aplicada correctamente** (ver sección 1):
un movimiento bancario importado (`BankTransaction`) nunca genera un
asiento contable automáticamente solo por existir — siempre pasa por
`reconciliation.service` (emparejamiento manual o automático con
tolerancia, nunca "adivina" ante ambigüedad) antes de convertirse en un
asiento vía `core/ledger`. Si se conectara un banco en tiempo real
mañana, este mismo principio seguiría aplicando sin cambios: la
diferencia sería solo *cómo llega* el `BankTransaction` (empujado por
el banco en vez de subido a mano), nunca *qué se hace* con él después.

## 6. Sistemas fiscales: gap ya conocido, sin cambios en esta fase

El adaptador `MOCK` de facturación electrónica (Fiscal, punto 4) sigue
siendo el único. No se conecta un proveedor real (DIAN, SAT, etc.) sin
que el usuario indique país/proveedor/credenciales/sandbox —
exactamente como pide esta fase. El patrón adapter ya existente
(`providers/index.js`) ya es la forma correcta de agregarlo el día que
se decida: un archivo nuevo, sin rediseñar `electronic-invoicing.service.js`.

## 7. Evaluación de abstracciones de conector (`*Provider`)

Se evaluó crear interfaces abstractas (`BankProvider`, `FiscalProvider`,
`EmailProvider`, `StorageProvider`) — mismo veredicto que ya se dio a
`AIProvider` en F12-B: **no se crea ninguna**. Regla aplicada: una
abstracción se justifica cuando hay 2+ implementaciones reales o una
necesidad concreta e inminente de una segunda. Hoy:
- Bancos: 0 proveedores reales (solo parsers de archivo, que ya
  comparten su propio patrón adapter — `parsers/index.js` — sin
  necesitar una interfaz más abstracta encima).
- Fiscal: 1 implementación (`MOCK`) — el patrón adapter ya existe,
  agregar un `AIProvider`-equivalente encima sería una capa vacía.
- Email: 0 implementaciones (`core/alerts.notifyAlert()` sigue vacío,
  documentado como pendiente desde Tesorería).
- Storage: 0 implementaciones (todo archivo se guarda en base64 en la
  base de datos — decisión consciente ya documentada varias veces).

## 8. Reintentos: nunca ciegos en operaciones financieras

Principio documentado para cualquier llamada saliente futura (ninguna
existe hoy — el proyecto no tiene cliente HTTP saliente instalado):
un timeout en una operación financiera (ej. una orden de pago enviada
a un procesador externo) **nunca debe reintentarse asumiendo que
falló** — el procesador puede haberla recibido y estar procesándola.
El patrón correcto (ya usado conceptualmente por el maker-checker de
`PaymentOrder`/`core/workflow`) sería: antes de reintentar, **consultar
el estado real** (idempotency key + endpoint de consulta del propio
proveedor) y solo reintentar si se confirma que nunca llegó. No se
implementa código para esto porque no hay ningún proveedor de pagos
real conectado — es un principio para cuando lo haya.

## 9. Observability: correlationId, no implementado (gap real menor)

`core/audit` no tiene hoy un campo `correlationId`/`requestId` (ya
anticipado como pendiente en `AI_ARCHITECTURE.md`, sección de
Auditoría). Para integraciones puramente internas (todo lo que existe
hoy) esto no es un problema real — cada escritura ya se audita con
`userId`/`companyId`/`entityType`/`entityId` suficientes para
trazarla. **Se vuelve necesario el día que exista un webhook entrante
o una llamada de un tercero real**, para poder correlacionar "esta
fila de auditoría vino de esta petición externa concreta". Se
documenta como requisito de diseño para esa futura pieza (agregar
`correlationId` opcional a `AuditLog`, poblado solo cuando el actor no
es un usuario humano de sesión), no se implementa ahora sin un
consumidor real que lo necesite.

## 10. Seguridad: hallazgos de esta auditoría (documentados, no corregidos sin justificación clara)

- **CORS sin restricción de origen** (`app.use(cors())`): no es un
  hallazgo nuevo de esta fase, y no se corrige aquí — restringir
  orígenes sin conocer el dominio real de producción podría romper la
  aplicación en vivo (el mismo tipo de "no adivinar" que rige toda esta
  fase). Documentado para que, si se define un dominio de producción
  fijo, se restrinja con una lista blanca explícita
  (`cors({ origin: [...] })`) en ese momento.
- **Sin límite de tamaño específico por endpoint de importación**: el
  único límite hoy es el global `express.json({limit:'5mb'})` — un
  archivo de importación más grande es rechazado por Express antes de
  llegar al validador (con un error genérico 500, no uno amigable, ya
  que `PayloadTooLargeError` no es una `AppError` ni un código Prisma
  conocido — cae al branch genérico de `errorHandler`). **Hallazgo
  real, de severidad baja**: no se corrige en esta fase porque no es
  un problema de seguridad (el límite global sigue aplicando, nada se
  desborda) — es una mejora de experiencia de usuario (un mensaje más
  claro que "error inesperado" cuando el archivo es muy grande), fuera
  del alcance estricto de "integraciones y ecosistema".
- **Extensión de archivo validada, contenido no escaneado**:
  `parseTabularFile` ya rechaza cualquier extensión que no sea
  csv/xlsx/xls (sin necesidad de un escáner de contenido malicioso
  aparte) y nunca escribe el archivo a disco (todo en memoria) — no
  hay riesgo de path traversal ni de ejecución de contenido. Evaluado
  como correcto, sin cambios necesarios.
- **Ningún endpoint expone información sensible en error 500**:
  confirmado, `errorHandler` nunca reenvía `err.stack`/SQL crudo al
  cliente — solo lo hace `console.error` (log del servidor).
- **No hay ningún mecanismo de autenticación de terceros que auditar
  todavía** (ver sección 2) — no hay superficie de API-key/OAuth que
  revisar por ahora.

## 11. Rate limiting: NO justificado todavía

No existe ningún endpoint expuesto a terceros no autenticados como
usuario humano (no hay API pública, no hay webhook entrante). El
único endpoint sin `requireAuth` es `POST /auth/login`
(y `/auth/verify-2fa`, `/auth/accept-invitation`) — ya protegidos por
la propia naturaleza de requerir credenciales válidas. Agregar
rate-limiting ahora sería una dependencia nueva y una superficie de
configuración (límites por IP/usuario/endpoint) sin ningún endpoint
público real que proteger — se documenta como necesario **el día que
exista una API para terceros o un webhook entrante** (sección 2/3),
no antes.

## 12. Versionado de API: NO justificado todavía

No hay ningún consumidor externo de la API (todo consumidor hoy es el
propio frontend de Alarfly, que se despliega junto con el backend). Un
prefijo `/v1` no aporta nada sin un segundo consumidor que dependa de
la forma actual de la API — se agregaría en el momento de introducir
un cambio que rompa compatibilidad para un consumidor real que ya
exista, no antes ("no versionar por estética").

## 13. Catálogo de ecosistema futuro (solo documentado, sin construir)

| Categoría | Ejemplos | Estado |
|---|---|---|
| Bancos | Open Banking, Plaid, conexión directa por país | Sin proveedor definido — no se construye |
| Fiscal | DIAN, SAT, u otro timbrado electrónico real | Solo `MOCK`, patrón adapter listo |
| E-commerce/Marketplaces | Shopify, MercadoLibre, etc. | Ninguna integración — no se ha pedido |
| CRM | HubSpot, Salesforce, etc. | Ninguna integración — el catálogo de `Customer` es propio |
| Nómina | Cualquier proveedor de payroll | Fuera de alcance del proyecto hasta ahora |
| Procesadores de pago | Stripe, PayPal, etc. | `PaymentMethod` es solo una etiqueta, no una pasarela |
| BI/Analítica externa | Power BI, Looker, etc. | Los exportadores (CSV/Excel/PDF) ya cubren "sacar datos", no hay pedido de conexión en vivo |
| Almacenamiento | S3, Google Drive, etc. | Todo archivo vive en base64 en la base de datos, decisión consciente ya documentada |
| Comunicación | Email/SMS/push reales | `notifyAlert()` sigue vacío, documentado desde Tesorería |
| IA | Ver `AI_ARCHITECTURE.md` (F12-B) | Explícitamente pospuesto (F12-C), fuera de alcance de F13 |

Ninguna de estas se construye en esta fase — es un catálogo de "qué
podría conectarse algún día", no un plan de trabajo.

## 14. Cosas explícitamente NO construidas en esta fase (y por qué)

Siguiendo la lista de 8 prohibiciones explícitas de esta fase, más las
propias conclusiones de la auditoría:

1. **Marketplace de integraciones** — no hay ninguna integración real
   que listar todavía.
2. **Motor universal de conectores** — cada adaptador existente
   (parsers bancarios, proveedor fiscal) ya tiene su propio patrón
   adapter simple; no hay 2+ necesidades reales que justifiquen
   generalizar más.
3. **Motor universal de webhooks** — cero consumidores reales.
4. **Motor universal de sincronización** — cero fuentes externas en
   vivo que sincronizar (todo es importación manual hoy).
5. **ESB/message broker/event bus** — el proyecto ya evaluó y descartó
   esto para uso interno (ver la nota ya documentada sobre
   `core/events/eventBus.js`, sin usar, en el registro de 2026-07-16) —
   con más razón no se justifica para integraciones externas
   inexistentes.
6. **API gateway complejo** — no hay múltiples servicios ni un tercero
   real que gatee.
7. **Servidor OAuth completo** — ver sección 2.
8. **Cualquier proveedor bancario/fiscal real** — ninguno fue nombrado
   por el usuario con país/credenciales/sandbox concretos.

## 15. Compatibilidad con la futura integración de IA (F12-C)

Esta fase no introduce nada que bloquee `AI_ARCHITECTURE.md`. Al
contrario, dos piezas de este documento son directamente reutilizables
para cuando se construya la Capa de Contexto de IA:
- El diseño de API Keys por empresa con scopes (sección 2) es el mismo
  principio que F12-B ya exige para las herramientas de IA
  (`AI permissions ⊆ USER permissions`) — si el día de mañana un
  asistente de IA necesita actuar como "tercero autenticado" en vez de
  código interno, este mismo mecanismo serviría sin rediseño.
- El principio de nunca saltarse un servicio de dominio (sección 1)
  es exactamente la misma regla que ya rige el catálogo de
  herramientas de IA de F12-B ("todo Read/Action Tool llama a un
  servicio existente, nunca a Prisma directo").

## 16. Conclusión

Esta fase no encontró ninguna integración externa real que construir.
El trabajo consistió en auditar exhaustivamente lo que ya existe
(confirmando que es correcto y no se duplica nada), documentar
explícitamente qué NO se construye y por qué, y dejar las decisiones
de diseño (autenticación de terceros, webhooks entrantes/salientes,
idempotencia, multiempresa, reintentos, observabilidad) ya tomadas y
listas para el día que aparezca un proveedor/banco/tercero concreto.
**No se modificó ningún código en esta fase.**
