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

/** Devuelve todas las ventas guardadas localmente. */
export async function listarVentas(): Promise<VentaLocal[]> {
  const resultado = await pendientes.allDocs({ include_docs: true });
  return resultado.rows.flatMap((fila) => (fila.doc ? [fila.doc] : []));
}