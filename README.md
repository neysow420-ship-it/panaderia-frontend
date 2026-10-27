# Sistema de gestión para panaderías — Frontend

Interfaz de usuario y almacenamiento local de un sistema de gestión para
panaderías, desarrollado como proyecto académico de Ingeniería de Sistemas.

## Objetivo

Proporcionar una interfaz que permita registrar y consultar operaciones del
sistema, con soporte para almacenamiento local y sincronización cuando exista
conectividad.

## Tecnologías

- **TypeScript + React:** interfaz y lógica del cliente.
- **PouchDB:** almacenamiento local de ventas y espejo del catálogo.
- **API Rust:** autenticación, validación y procesamiento de operaciones.
- **Apache CouchDB:** base de datos central del catálogo.

## Arquitectura

`Interfaz → PouchDB → API Rust → Validación → CouchDB`

Las ventas se guardan primero en PouchDB. La cola las envía a la API con el JWT
del usuario; si no hay red o la sesión vence, no se pierden.

## Estado

Fase 4 en desarrollo. Ya están implementados:

- Login con JWT y roles `cajero`/`encargado`.
- Cierre de sesión y vuelta al login ante `401`, conservando la cola.
- Aviso visible ante `403` y ventas pendientes.
- Navegación por rol: el cajero solo ve Venta; el encargado ve además
  Producción, Cierre y Reportes (pantallas pendientes de la siguiente fase).
- Catálogo de respaldo con aviso visible en la primera conexión.
- Pruebas de sesión, login y manejo de `401`/`403`/`409` en la cola.

## Desarrollo

1. Copia la plantilla y edítala:
   ```bash
   cp .env.example .env
   ```
   Define `VITE_API_URL`, la URL y credenciales de lectura del catálogo y
   `VITE_AUTH=activado`.
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Arranca el frontend:
   ```bash
   npm run dev
   ```
   Abre http://localhost:5173.
4. Para omitir el login solo en desarrollo, usa `VITE_AUTH=desactivado`.

El backend debe tener `AUTH_MODE=activo` y los usuarios `cajero1` /
`encargado1` sembrados. Si se prueba en el servidor, `CORS_ORIGINS` del backend
debe incluir el dominio del frontend. Ese mismo origen debe estar en
`infra/couchdb/local.d/10-cors.ini` del backend, porque PouchDB lee el catálogo
directamente desde CouchDB.

## Pruebas y calidad

```bash
npm test
npm run build
npm run lint
```

Las pruebas usan Vitest, Testing Library y jsdom. No necesitan CouchDB.

## Trabajo colaborativo

Los cambios se propondrán mediante Pull Requests hacia `main` y deberán cumplir
las reglas de revisión y las comprobaciones automatizadas del repositorio.
