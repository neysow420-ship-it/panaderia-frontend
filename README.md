# Sistema de gestión para panaderías — Frontend

Interfaz de usuario y almacenamiento local de un sistema de gestión para panaderías, desarrollado como proyecto académico de Ingeniería de Sistemas.

## Objetivo

Proporcionar una interfaz que permita registrar y consultar operaciones del sistema, con soporte para almacenamiento local y sincronización cuando exista conectividad.

## Tecnologías

- **TypeScript:** desarrollo de la lógica de la interfaz.
- **PouchDB:** almacenamiento local de documentos y gestión de datos para el funcionamiento offline-first.
- **API Rust:** comunicación con el backend para validar y procesar las operaciones.
- **Apache CouchDB:** base de datos central, gestionada a través del backend según la arquitectura acordada.

## Arquitectura

La aplicación utiliza PouchDB para almacenar información localmente. Las operaciones que requieren persistencia central se envían al backend Rust para su validación.

Flujo general:

`Interfaz → PouchDB → API Rust → Validación → CouchDB`

El comportamiento de la sincronización, la resolución de conflictos y los estados de las operaciones se definirá mediante los contratos del proyecto.

## Estado

En desarrollo. Las funcionalidades y los resultados experimentales se documentarán a medida que se implementen y validen.

## Desarrollo

Las instrucciones de instalación, configuración y ejecución se completarán cuando estén definidas la estructura del proyecto y las dependencias.

## Calidad del código

El proyecto utilizará integración continua para ejecutar el linter y las pruebas automatizadas configuradas.

## Trabajo colaborativo

Los cambios se propondrán mediante Pull Requests hacia `main` y deberán cumplir las reglas de revisión y las comprobaciones automatizadas establecidas en el repositorio.
