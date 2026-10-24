
import {
  actualizarEstadoVenta,
  listarVentas,
  marcarVentaAceptada,
  type VentaLocal,
} from '../database/pendientes';

/**
 * Forma de la respuesta de `POST /ventas` cuando el servidor acepta la venta.
 * El servidor calcula los precios; el cliente solo recibe el total oficial.
 */
interface RespuestaVentaApi {
  ya_procesada: boolean;
  venta: {
    total_centavos: number;
  };
}

interface ErrorCampoApi {
  campo: string;
  motivo: string;
}

/** Forma de la respuesta de error del contrato de la API. */
interface ErrorApi {
  codigo?: string;
  errores?: ErrorCampoApi[];
}

export interface ResultadoEnvio {
  enviadas: number;
  rechazadas: number;
}

/** Evita que dos envíos (intervalo, evento online y venta nueva) se pisen. */
let envioEnCurso = false;
let avisoSinUrlMostrado = false;

/**
 * URL del endpoint de ventas, o `null` si falta la configuración.
 */
function urlVentas(): string | null {
  const base = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');

  return base ? `${base}/ventas` : null;
}

async function leerJson<T>(respuesta: Response): Promise<T | null> {
  try {
    return (await respuesta.json()) as T;
  } catch {
    return null;
  }
}

function totalOficial(datos: RespuestaVentaApi | null): number | null {
  const total = datos?.venta?.total_centavos;

  return typeof total === 'number' && Number.isSafeInteger(total)
    ? total
    : null;
}

function describirError(
  datos: ErrorApi | null,
  estadoHttp: number,
): string {
  const errores = datos?.errores ?? [];

  if (errores.length > 0) {
    return errores
      .map((error) => `${error.campo}: ${error.motivo}`)
      .join('; ');
  }

  if (estadoHttp === 409) {
    return 'El servidor ya tiene una venta con este identificador y otro contenido.';
  }

  return `El servidor rechazó la venta (HTTP ${estadoHttp}).`;
}

/**
 * Consulta la cola local.
 * No realiza peticiones HTTP ni replica a CouchDB.
 */
export async function listarColaPendiente(): Promise<VentaLocal[]> {
  const ventas = await listarVentas();

  return ventas.filter((venta) => venta.estado === 'pendiente');
}

/**
 * Devuelve cuántas ventas esperan envío.
 */
export async function contarColaPendiente(): Promise<number> {
  const ventas = await listarColaPendiente();

  return ventas.length;
}

/**
 * Devuelve a la cola las ventas que quedaron en `enviando` porque la pestaña
 * se cerró a mitad del envío. Es seguro reenviarlas: la API es idempotente
 * por `operacion_id`.
 */
export async function recuperarVentasEnviando(): Promise<number> {
  const ventas = await listarVentas();
  const atascadas = ventas.filter(
    (venta) => venta.estado === 'enviando',
  );

  for (const venta of atascadas) {
    try {
      await actualizarEstadoVenta(venta._id, 'pendiente');
    } catch (error) {
      console.error(
        `No se pudo devolver la venta ${venta._id} a la cola:`,
        error,
      );
    }
  }

  return atascadas.length;
}

/**
 * Envía a la API todas las ventas pendientes, en orden.
 *
 * - `200`/`201`: la API confirmó la venta y devolvió el total oficial.
 * - `409`/`422`: la venta no es válida; queda rechazada con el motivo.
 * - Cualquier otro código o fallo de red: vuelve a `pendiente` y se detiene
 *   el envío para no insistir contra un servidor caído.
 */
export async function enviarPendientes(): Promise<ResultadoEnvio> {
  const sinCambios: ResultadoEnvio = { enviadas: 0, rechazadas: 0 };

  if (envioEnCurso) {
    return sinCambios;
  }

  const url = urlVentas();

  if (!url) {
    if (!avisoSinUrlMostrado) {
      console.warn(
        'Falta configurar VITE_API_URL: las ventas se quedan en la cola local.',
      );
      avisoSinUrlMostrado = true;
    }

    return sinCambios;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return sinCambios;
  }

  envioEnCurso = true;

  try {
    const ventas = await listarColaPendiente();
    let enviadas = 0;
    let rechazadas = 0;

    for (const pendiente of ventas) {
      let venta = pendiente;

      try {
        venta = await actualizarEstadoVenta(venta._id, 'enviando');

        const respuesta = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(venta.solicitud),
        });

        if (respuesta.status === 200 || respuesta.status === 201) {
          const datos = await leerJson<RespuestaVentaApi>(respuesta);
          const total = totalOficial(datos);

          if (total === null) {
            throw new Error(
              'La respuesta de la API no trae el total oficial.',
            );
          }

          await marcarVentaAceptada(venta._id, total);
          enviadas += 1;
          continue;
        }

        if (respuesta.status === 409 || respuesta.status === 422) {
          const datos = await leerJson<ErrorApi>(respuesta);

          await actualizarEstadoVenta(
            venta._id,
            'rechazada',
            describirError(datos, respuesta.status),
          );
          rechazadas += 1;
          continue;
        }

        console.warn(
          `No se pudo enviar la venta ${venta._id} (HTTP ${respuesta.status}).`,
        );
        await actualizarEstadoVenta(venta._id, 'pendiente');
        break;
      } catch (error) {
        console.error(
          `No se pudo enviar la venta ${venta._id}:`,
          error,
        );

        try {
          await actualizarEstadoVenta(venta._id, 'pendiente');
        } catch (errorReintento) {
          console.error(
            `No se pudo devolver la venta ${venta._id} a la cola:`,
            errorReintento,
          );
        }

        break;
      }
    }

    return { enviadas, rechazadas };
  } finally {
    envioEnCurso = false;
  }
}
