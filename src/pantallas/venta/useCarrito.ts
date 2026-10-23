import { useMemo, useState } from 'react';
import type { Producto } from '../../database/catalogo';
import type { LineaVenta } from '../../database/pendientes';

/** Límite por línea que fija el contrato (1 a 1000). */
const MAX_CANTIDAD = 1000;

export function useCarrito(catalogo: Producto[]) {
  // Cantidades por producto: { "producto:donas": 2, ... }. Los productos en 0 no se guardan.
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  /** Suma o resta unidades, sin pasar de 0 ni de MAX_CANTIDAD. */
  function cambiar(productoId: string, delta: number) {
    setCantidades((actual) => {
      const nueva = Math.min(
        MAX_CANTIDAD,
        Math.max(0, (actual[productoId] ?? 0) + delta),
      );
      const copia = { ...actual };
      if (nueva === 0) {
        delete copia[productoId];
      } else {
        copia[productoId] = nueva;
      }
      return copia;
    });
  }

  function vaciar() {
    setCantidades({});
  }

  // Formato exacto que espera la solicitud de venta.
  const lineas: LineaVenta[] = useMemo(
    () =>
      Object.entries(cantidades).map(([producto_id, cantidad]) => ({
        producto_id,
        cantidad,
      })),
    [cantidades],
  );

  // Estimación en centavos enteros. El precio oficial lo calcula el servidor.
  const totalEstimado = useMemo(
    () =>
      catalogo.reduce(
        (suma, p) => suma + p.precio_centavos * (cantidades[p.id] ?? 0),
        0,
      ),
    [catalogo, cantidades],
  );

  return { cantidades, lineas, totalEstimado, cambiar, vaciar };
}