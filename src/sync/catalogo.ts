
import PouchDB from 'pouchdb-browser';
import {
  espejo,
  type DocumentoCatalogo,
} from '../database/espejo';

export type EstadoReplicaCatalogo =
  | 'configuracion'
  | 'iniciando'
  | 'activo'
  | 'al_dia'
  | 'cambios'
  | 'reintentando'
  | 'denegado'
  | 'error';

type Notificador = (
  estado: EstadoReplicaCatalogo,
  detalle?: string,
) => void;

function mensajeDeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return String(error);
}

function registrarEstado(
  estado: EstadoReplicaCatalogo,
  detalle?: string,
): void {
  const mensaje = `[Réplica del catálogo] ${estado}`;

  if (
    estado === 'configuracion' ||
    estado === 'reintentando' ||
    estado === 'denegado' ||
    estado === 'error'
  ) {
    console.warn(mensaje, detalle ?? '');
    return;
  }

  console.info(mensaje, detalle ?? '');
}

/**
 * Inicia una réplica continua desde CouchDB catalogo
 * hacia PouchDB espejo.
 *
 * Nunca replica en dirección espejo -> catalogo.
 * Devuelve una función para detener la réplica.
 */
export function iniciarReplicaCatalogo(
  notificar: Notificador = registrarEstado,
): () => void {
  const url = import.meta.env.VITE_CATALOGO_URL?.trim();
  const usuario = import.meta.env.VITE_CATALOGO_USER?.trim();
  const contrasena = import.meta.env.VITE_CATALOGO_PASSWORD;

  if (!url) {
    notificar(
      'configuracion',
      'Falta configurar VITE_CATALOGO_URL.',
    );
    return () => {};
  }

  // El catálogo vive en CouchDB y siempre usa el usuario `cliente`, aunque la
  // API esté en modo sin login. No se depende de VITE_AUTH para esto.
  if (!usuario || !contrasena) {
    notificar(
      'configuracion',
      'Faltan las credenciales de lectura del catálogo.',
    );
    return () => {};
  }

  const opcionesRemotas = {
    auth: {
      username: usuario,
      password: contrasena,
    },
  };

  try {
    const catalogoRemoto = new PouchDB<DocumentoCatalogo>(
      url,
      opcionesRemotas,
    );

    notificar('iniciando');

    // Única dirección: catálogo remoto -> espejo local.
    const replicacion = catalogoRemoto.replicate.to(espejo, {
      live: true,
      retry: true,
    });

    replicacion
      .on('change', () => {
        notificar('cambios', 'Se recibieron documentos del catálogo.');
      })
      .on('active', () => {
        notificar('activo', 'La réplica está procesando cambios.');
      })
      .on('paused', (error) => {
        if (error) {
          // Con retry: true, PouchDB intentará reconectarse.
          notificar('reintentando', mensajeDeError(error));
        } else {
          notificar('al_dia', 'El catálogo está actualizado por ahora.');
        }
      })
      .on('denied', (error) => {
        notificar('denegado', mensajeDeError(error));
      })
      .on('error', (error) => {
        notificar('error', mensajeDeError(error));
      });

    return () => {
      replicacion.cancel();
    };
  } catch (error) {
    notificar('error', mensajeDeError(error));
    return () => {};
  }
}
