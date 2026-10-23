import PouchDB from 'pouchdb-browser';
import { ulid } from 'ulid';

export type EstadoVenta = 'pendiente' | 'enviando' | 'aceptada' | 'rechazada';

export interface LineaVenta {
  producto_id: string;
  cantidad: number;
}

export interface SolicitudVenta {
  operacion_id: string;
  creado_local: string;
  dispositivo_id: string;
  lineas: LineaVenta[];
}

export interface VentaLocal {
  _id: string;
  estado: EstadoVenta;
  intentos: number;
  motivo?: string;
  /** Total oficial calculado por Rust. Solo existe cuando la venta fue aceptada (lo llena el servicio de envío, ítem 4.13). */
  total_oficial_centavos?: number;
  solicitud: SolicitudVenta;
}

/** Base local de ventas sin confirmar. Nunca se replica a CouchDB. */
export const pendientes = new PouchDB<VentaLocal>('pendientes');

/** Guarda una venta de prueba y la deja en estado "pendiente". */
export async function guardarVentaDePrueba(): Promise<VentaLocal> {
  const id = ulid();
  const venta: VentaLocal = {
    _id: id,
    estado: 'pendiente',
    intentos: 0,
    solicitud: {
      operacion_id: id,
      creado_local: new Date().toISOString(),
      dispositivo_id: 'caja-1',
      lineas: [{ producto_id: 'producto:pan-frances', cantidad: 6 }],
    },
  };
  await pendientes.put(venta);
  return venta;
}
/** Identifica esta caja. Por ahora es fijo. */
const DISPOSITIVO_ID = 'caja-1';

/** Guarda una venta real en estado "pendiente". Aún no es oficial. */
export async function guardarVenta(lineas: LineaVenta[]): Promise<VentaLocal> {
  if (lineas.length === 0) {
    throw new Error('La venta no tiene productos.');
  }
  // El ULID es el identificador de la operación: se reutiliza en cada reintento.
  const id = ulid();
  const venta: VentaLocal = {
    _id: id,
    estado: 'pendiente',
    intentos: 0,
    solicitud: {
      operacion_id: id,
      // RFC 3339 con zona (termina en "Z"), como exige el contrato.
      creado_local: new Date().toISOString(),
      dispositivo_id: DISPOSITIVO_ID,
      lineas,
    },
  };
  await pendientes.put(venta);
  return venta;
}

/**
 * Avisa cada vez que cambia algo en `pendientes` (nueva venta, o un cambio de
 * estado hecho luego por el servicio de envío). Devuelve la función para dejar de escuchar.
 */
export function observarVentas(alCambiar: () => void): () => void {
  const escucha = pendientes
    .changes({ since: 'now', live: true })
    .on('change', alCambiar);
  return () => escucha.cancel();
}

/** Devuelve todas las ventas guardadas localmente. */
export async function listarVentas(): Promise<VentaLocal[]> {
  const resultado = await pendientes.allDocs({ include_docs: true });
  return resultado.rows.flatMap((fila) => (fila.doc ? [fila.doc] : []));
}