
import PouchDB from 'pouchdb-browser';

/**
 * Forma de los documentos de producto descargados desde CouchDB.
 */
export interface DocumentoCatalogo {
  _id: string;
  _rev?: string;
  slug?: string;
  nombre?: string;
  precio_centavos?: number;
  costo_unitario_centavos?: number;
  vigente_desde?: string;
}

/**
 * Espejo local del catálogo central.
 * La aplicación consulta esta base; la réplica la alimenta.
 */
export const espejo = new PouchDB<DocumentoCatalogo>('espejo');
