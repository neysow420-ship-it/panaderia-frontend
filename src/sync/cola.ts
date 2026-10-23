
import {
  listarVentas,
  type VentaLocal,
} from '../database/pendientes';

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