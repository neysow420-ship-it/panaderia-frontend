import { useEffect, useMemo, useState } from 'react';
import {
  cargarCatalogo,
  observarCatalogo,
  type Producto,
} from '../../database/catalogo';

/**
 * Catálogo local (espejo de CouchDB) compartido por Producción y Cierre.
 * Se mantiene al día con los cambios del espejo.
 */
export function useCatalogo() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    const cargar = () => {
      void cargarCatalogo()
        .then((resultado) => {
          if (activo) {
            setProductos(resultado.productos);
            setCargando(false);
          }
        })
        .catch((error: unknown) => {
          console.error('No se pudo cargar el catálogo:', error);

          if (activo) {
            setCargando(false);
          }
        });
    };

    cargar();
    const dejarDeObservar = observarCatalogo(cargar);

    return () => {
      activo = false;
      dejarDeObservar();
    };
  }, []);

  const nombres = useMemo(
    () => new Map(productos.map((producto) => [producto.id, producto.nombre])),
    [productos],
  );

  const nombreDe = (id: string) => nombres.get(id) ?? id;

  return { productos, cargando, nombres, nombreDe };
}
