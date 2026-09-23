# Alarfly — Frontend

Panel web de Alarfly (React + Vite). Consume la API que vive en `../src`.

## Puesta en marcha

1. Instalar dependencias:
   ```
   npm install
   ```
2. Con el backend corriendo en `http://localhost:3000` (ver el `README.md` de la
   raíz del proyecto), levantar el frontend:
   ```
   npm run dev
   ```
3. Abrir `http://localhost:5173`. Las peticiones a `/api/*` se redirigen
   automáticamente al backend (ver `vite.config.js`), así que no hace falta
   configurar ninguna URL a mano.
4. Iniciar sesión con cualquier usuario del seed (`npm run prisma:seed` en la
   raíz), por ejemplo `admin@demo.alarfly.com` / `Demo1234!`.

## Estructura

```
src/
  api/          # cliente HTTP (fetch + token JWT en localStorage)
  components/   # piezas reutilizables (layout, tarjetas)
  context/      # AuthContext (sesión del usuario)
  pages/        # una pantalla completa por archivo
  styles/       # theme.css: variables de color, tipografía, espaciados
  utils/        # formato de moneda/fechas
```

## Sistema visual

Paleta corporativa fija (ver `src/styles/theme.css`): negro mate de fondo,
blanco roto para texto, gris plata como acento de marca — sin colores vivos,
salvo tonos apagados de éxito/alerta/error en los KPIs. Todo el estilo se
controla con variables CSS (`--color-*`, `--space-*`, `--radius-*`) para que
cambiar la paleta más adelante sea editar un solo archivo.

## Pantallas construidas

- **Acceso** (`/acceso`): login contra `POST /auth/login`.
- **Panel principal** (`/`): saludo, KPIs reales (posición de caja, EBITDA,
  Burn Rate, Runway) y accesos a los 3 módulos.
- **Contabilidad / Tesorería / FP&A**: pantallas "Próximamente" — se
  construyen módulo por módulo en las siguientes sesiones.
