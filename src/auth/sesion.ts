/**
 * Sesión del usuario en el navegador.
 *
 * El JWT se guarda en `localStorage` (no en PouchDB ni en una cookie) porque la
 * API lo recibe en el encabezado `Authorization`. Nunca se guarda la
 * contraseña. Al leer la sesión se valida que el token no haya vencido.
 */

export type Rol = 'cajero' | 'encargado';

export interface UsuarioSesion {
  nombre: string;
  rol: Rol;
}

export interface Sesion {
  token: string;
  tipo: string;
  expira_en: string;
  usuario: UsuarioSesion;
}

const CLAVE = 'panaderia.sesion';

export const EVENTO_SESION_EXPIRADA = 'panaderia:sesion-expirada';

function esRol(valor: unknown): valor is Rol {
  return valor === 'cajero' || valor === 'encargado';
}

export function esSesionValida(valor: unknown): valor is Sesion {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }

  const sesion = valor as Record<string, unknown>;
  const usuario = sesion.usuario;

  if (
    typeof sesion.token !== 'string' ||
    sesion.token.trim() === '' ||
    typeof sesion.tipo !== 'string' ||
    typeof sesion.expira_en !== 'string' ||
    typeof usuario !== 'object' ||
    usuario === null
  ) {
    return false;
  }

  const datosUsuario = usuario as Record<string, unknown>;

  return (
    typeof datosUsuario.nombre === 'string' &&
    datosUsuario.nombre.trim() !== '' &&
    esRol(datosUsuario.rol)
  );
}

/**
 * Indica si la aplicación debe exigir login.
 * Se puede desactivar con `VITE_AUTH=desactivado` para desarrollo.
 */
export function autenticacionActiva(): boolean {
  const modo = import.meta.env.VITE_AUTH?.trim().toLowerCase();

  return modo !== 'desactivado';
}

/**
 * Convierte la fecha de expiración a milisegundos.
 * El backend puede enviar más de 3 decimales; algunos navegadores solo
 * entienden el formato corto, así que se recorta antes de `Date.parse`.
 */
function milisegundosDeExpiracion(iso: string): number {
  const normalizado = iso.replace(/(\.\d{3})\d+/, '$1');

  return Date.parse(normalizado);
}

/** Lee y valida la sesión guardada. Si venció o está corrupta, la borra. */
export function leerSesion(): Sesion | null {
  let crudo: string | null;

  try {
    crudo = localStorage.getItem(CLAVE);
  } catch {
    return null;
  }

  if (!crudo) {
    return null;
  }

  try {
    const datos: unknown = JSON.parse(crudo);

    if (!esSesionValida(datos)) {
      localStorage.removeItem(CLAVE);
      return null;
    }

    const vence = milisegundosDeExpiracion(datos.expira_en);

    if (!Number.isFinite(vence) || vence <= Date.now()) {
      localStorage.removeItem(CLAVE);
      return null;
    }

    return datos;
  } catch {
    localStorage.removeItem(CLAVE);
    return null;
  }
}

/** Guarda la sesión devuelta por `POST /auth/login`. */
export function guardarSesion(sesion: Sesion): void {
  localStorage.setItem(CLAVE, JSON.stringify(sesion));
}

/** Borra la sesión del navegador. */
export function cerrarSesion(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Si el navegador bloquea localStorage, no hay nada que borrar.
  }
}

/** Token vigente, o `null` si no hay sesión o el login está desactivado. */
export function tokenActual(): string | null {
  const token = leerSesion()?.token.trim();

  return token ? token : null;
}

/** Avisa a `App` que la API respondió 401 y hay que volver al login. */
export function avisarSesionExpirada(): void {
  window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
}

/**
 * Sesión falsa para `VITE_AUTH=desactivado`.
 * Conserva el mismo rol que usaba el backend en ese modo.
 */
export function sesionSinLogin(): Sesion {
  return {
    token: '',
    tipo: 'Bearer',
    expira_en: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    usuario: { nombre: 'encargado', rol: 'encargado' },
  };
}
