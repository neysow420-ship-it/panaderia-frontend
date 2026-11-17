// =============================================================================
// Cliente HTTP de la API Rust
// =============================================================================
//
// Un solo lugar para: URL base, token JWT, JSON, y traducción de errores.
// Todas las pantallas de encargado (Producción, Cierre y Reportes) lo usan.
//
// Si la API responde 401 se avisa a la aplicación para volver al login, igual
// que hace la cola de ventas. Los errores del contrato tienen la forma
// `{ codigo, errores: [{ campo, motivo }] }`.

import { avisarSesionExpirada, tokenActual } from '../auth/sesion';

export interface ErrorCampoApi {
  campo: string;
  motivo: string;
}

/** Error de la API con el código HTTP y los campos que fallaron. */
export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  readonly errores: ErrorCampoApi[];

  constructor(
    estado: number,
    codigo: string,
    mensaje: string,
    errores: ErrorCampoApi[] = [],
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.errores = errores;
  }
}

interface RespuestaError {
  codigo?: string;
  errores?: ErrorCampoApi[];
}

/** URL absoluta de una ruta de la API, o `null` si falta `VITE_API_URL`. */
export function urlApi(ruta: string): string | null {
  const base = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');

  if (!base) {
    return null;
  }

  return `${base}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
}

interface OpcionesPeticion {
  metodo?: 'GET' | 'POST' | 'PUT';
  cuerpo?: unknown;
}

/** Hace una petición autenticada y devuelve el JSON ya convertido a `T`. */
export async function pedir<T>(
  ruta: string,
  opciones: OpcionesPeticion = {},
): Promise<T> {
  const url = urlApi(ruta);

  if (!url) {
    throw new ErrorApi(
      0,
      'sin_configuracion',
      'Falta configurar VITE_API_URL en el archivo .env.',
    );
  }

  const token = tokenActual();
  const cabeceras: Record<string, string> = { Accept: 'application/json' };

  if (opciones.cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
  }

  if (token) {
    cabeceras.Authorization = `Bearer ${token}`;
  }

  let respuesta: Response;

  try {
    respuesta = await fetch(url, {
      method: opciones.metodo ?? 'GET',
      headers: cabeceras,
      body:
        opciones.cuerpo === undefined
          ? undefined
          : JSON.stringify(opciones.cuerpo),
    });
  } catch {
    throw new ErrorApi(
      0,
      'sin_conexion',
      'No se pudo conectar con el servidor. Revisa la red e inténtalo de nuevo.',
    );
  }

  const datos = await leerJson(respuesta);

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      avisarSesionExpirada();
    }

    const error = (datos ?? {}) as RespuestaError;

    throw new ErrorApi(
      respuesta.status,
      error.codigo ?? 'error',
      describir(error, respuesta.status),
      Array.isArray(error.errores) ? error.errores : [],
    );
  }

  return datos as T;
}

async function leerJson(respuesta: Response): Promise<unknown> {
  try {
    return await respuesta.json();
  } catch {
    return null;
  }
}

function describir(error: RespuestaError, estado: number): string {
  const errores = error.errores ?? [];

  if (errores.length > 0) {
    return errores
      // Los campos con índice (descartadas[0].unidades) se leen mejor sin el prefijo.
      .map((campo) => `${limpiarCampo(campo.campo)}: ${campo.motivo}`)
      .join(' · ');
  }

  switch (estado) {
    case 401:
      return 'La sesión venció. Vuelve a iniciar sesión.';
    case 403:
      return 'Tu usuario no tiene permiso para esta acción.';
    case 409:
      return 'El servidor ya tiene un registro con otro contenido.';
    case 503:
      return 'La base de datos no está disponible. Inténtalo más tarde.';
    default:
      return `El servidor respondió con un error (HTTP ${estado}).`;
  }
}

function limpiarCampo(campo: string): string {
  return campo.replace(/\[\d+\]/g, '').replace(/_/g, ' ');
}
