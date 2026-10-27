
import {
  espejo,
  type DocumentoCatalogo,
} from './espejo';

export interface Producto {
  id: string;
  nombre: string;
  precio_centavos: number;
}

export interface ResultadoCatalogo {
  productos: Producto[];
  /** `true` cuando se usan los precios de respaldo porque el espejo está vacío. */
  esRespaldo: boolean;
}

// Respaldo temporal mientras CouchDB no esté disponible.
const PRODUCTOS_TEMPORALES: Producto[] = [
  {
    id: 'producto:pan-frances',
    nombre: 'Pan francés',
    precio_centavos: 10,
  },
  {
    id: 'producto:semita',
    nombre: 'Semita',
    precio_centavos: 25,
  },
  {
    id: 'producto:hojitas',
    nombre: 'Hojitas',
    precio_centavos: 15,
  },
  {
    id: 'producto:cachos',
    nombre: 'Cachos',
    precio_centavos: 30,
  },
  {
    id: 'producto:donas',
    nombre: 'Donas',
    precio_centavos: 35,
  },
];

export async function cargarCatalogo(): Promise<ResultadoCatalogo> {
  const resultado = await espejo.allDocs({
    include_docs: true,
  });

  const productos = resultado.rows.flatMap((fila) => {
    const documento = fila.doc as DocumentoCatalogo | undefined;

    if (
      !documento ||
      documento._id.startsWith('_design/') ||
      (documento.tipo !== undefined && documento.tipo !== 'producto') ||
      documento.activo === false
    ) {
      return [];
    }

    const nombre = documento.nombre?.trim();
    const precio = documento.precio_centavos;

    if (
      !nombre ||
      typeof precio !== 'number' ||
      !Number.isSafeInteger(precio) ||
      precio <= 0
    ) {
      return [];
    }

    return [
      {
        id: documento._id,
        nombre,
        precio_centavos: precio,
      },
    ];
  });

  if (productos.length === 0) {
    console.warn(
      'El espejo está vacío. Se utiliza el catálogo temporal de desarrollo.',
    );

    return { productos: PRODUCTOS_TEMPORALES, esRespaldo: true };
  }

  return {
    productos: productos.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    ),
    esRespaldo: false,
  };
}

export function observarCatalogo(
  alCambiar: () => void,
): () => void {
  const escucha = espejo
    .changes({ since: 'now', live: true })
    .on('change', alCambiar);

  return () => escucha.cancel();
}
