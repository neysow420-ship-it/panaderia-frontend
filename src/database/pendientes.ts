import PouchDB from 'pouchdb-browser';
import { ulid } from 'ulid';

export type EstadoVenta =
  | 'pendiente'
  | 'enviando'
  | 'aceptada'
  | 'rechazada';

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
  _rev?: string;
  estado: EstadoVenta;
  intentos: number;
  motivo?: string;
  total_oficial_centavos?: number;
  solicitud: SolicitudVenta;
}

export interface NuevaVentaLocal {
  dispositivo_id: string;
  lineas: LineaVenta[];
  creado_local?: string;
}

/**
 * Base local de ventas.
 * No usa una dirección remota ni replica automáticamente.
 */
export const pendientes = new PouchDB<VentaLocal>('pendientes');

/**
 * Guarda una nueva venta local en estado pendiente.
 */
export async function guardarVentaLocal(
  entrada: NuevaVentaLocal,
): Promise<VentaLocal> {
  const dispositivoId = entrada.dispositivo_id.trim();

  if (!dispositivoId) {
    throw new Error('El identificador del dispositivo es obligatorio.');
  }

  if (!Array.isArray(entrada.lineas) || entrada.lineas.length === 0) {
    throw new Error('La venta debe contener al menos un producto.');
  }

  const lineas = entrada.lineas.map((linea, indice) => {
    if (!linea.producto_id.trim()) {
      throw new Error(
        `La línea ${indice + 1} no tiene identificador de producto.`,
      );
    }

    if (!Number.isSafeInteger(linea.cantidad) || linea.cantidad <= 0) {
      throw new Error(
        `La cantidad de la línea ${indice + 1} debe ser un entero positivo.`,
      );
    }

    return {
      producto_id: linea.producto_id.trim(),
      cantidad: linea.cantidad,
    };
  });

  // El mismo ULID identifica la venta local y la operación.
  const operacionId = ulid();

  const venta: VentaLocal = {
    _id: operacionId,
    estado: 'pendiente',
    intentos: 0,
    solicitud: {
      operacion_id: operacionId,
      creado_local: entrada.creado_local ?? new Date().toISOString(),
      dispositivo_id: dispositivoId,
      lineas,
    },
  };

  await pendientes.put(venta);

  return venta;
}

/**
 * Devuelve las ventas guardadas, de la más reciente a la más antigua.
 */
export async function listarVentas(): Promise<VentaLocal[]> {
  const resultado = await pendientes.allDocs({
    include_docs: true,
  });

  const ventas = resultado.rows.flatMap((fila) =>
    fila.doc ? [fila.doc] : [],
  );

  return ventas.sort((a, b) =>
    b.solicitud.creado_local.localeCompare(a.solicitud.creado_local),
  );
}

/**
 * Cambia el estado de una venta sin contactar con ningún servidor.
 */
export async function actualizarEstadoVenta(
  id: string,
  nuevoEstado: EstadoVenta,
  motivo?: string,
): Promise<VentaLocal> {
  const venta = await pendientes.get(id);

  // Transiciones permitidas para controlar el ciclo de vida local.
  const transiciones: Record<EstadoVenta, EstadoVenta[]> = {
    pendiente: ['enviando'],
    enviando: ['pendiente', 'aceptada', 'rechazada'],
    aceptada: [],
    rechazada: [],
  };

  if (venta.estado === nuevoEstado) {
    return venta;
  }

  if (!transiciones[venta.estado].includes(nuevoEstado)) {
    throw new Error(
      `No se permite cambiar el estado de ${venta.estado} a ${nuevoEstado}.`,
    );
  }

  const actualizada: VentaLocal = {
    ...venta,
    estado: nuevoEstado,
    intentos:
      nuevoEstado === 'enviando'
        ? venta.intentos + 1
        : venta.intentos,
  };

  if (nuevoEstado === 'rechazada') {
    actualizada.motivo = motivo?.trim() || 'La venta fue rechazada.';
  } else {
    delete actualizada.motivo;
  }

  const resultado = await pendientes.put(actualizada);

  return {
    ...actualizada,
    _rev: resultado.rev,
  };
}

/**
 * Función temporal para conservar la prueba de almacenamiento anterior.
 */
export async function guardarVentaDePrueba(): Promise<VentaLocal> {
  return guardarVentaLocal({
    dispositivo_id: 'caja-1',
    lineas: [
      {
        producto_id: 'producto:pan-frances',
        cantidad: 6,
      },
    ],
  });
}
const DISPOSITIVO_ID = 'caja-1';

/**
 * Guarda la venta que recibe la pantalla.
 */
export async function guardarVenta(
  lineas: LineaVenta[],
): Promise<VentaLocal> {
  return guardarVentaLocal({
    dispositivo_id: DISPOSITIVO_ID,
    lineas,
  });
}

/**
 * Permite que la pantalla detecte cambios en la base local.
 */
export function observarVentas(
  alCambiar: () => void,
): () => void {
  const escucha = pendientes
    .changes({ since: 'now', live: true })
    .on('change', alCambiar);

  return () => escucha.cancel();
}