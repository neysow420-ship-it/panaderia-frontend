import { beforeEach, describe, expect, it } from 'vitest';
import {
  cerrarSesion,
  guardarSesion,
  leerSesion,
  sesionSinLogin,
  tokenActual,
  type Sesion,
} from './sesion';

function sesionValida(): Sesion {
  return {
    token: 'token-de-prueba',
    tipo: 'Bearer',
    expira_en: new Date(Date.now() + 60_000).toISOString(),
    usuario: { nombre: 'cajero1', rol: 'cajero' },
  };
}

describe('sesión del navegador', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('guarda y recupera una sesión vigente', () => {
    const sesion = sesionValida();

    guardarSesion(sesion);

    expect(leerSesion()).toEqual(sesion);
    expect(tokenActual()).toBe('token-de-prueba');
  });

  it('acepta la fecha con nanosegundos que envía la API', () => {
    const sesion = {
      ...sesionValida(),
      expira_en: '2099-01-01T00:00:00.123456789+00:00',
    };

    guardarSesion(sesion);

    expect(leerSesion()).toEqual(sesion);
  });

  it('borra una sesión vencida', () => {
    const sesion = {
      ...sesionValida(),
      expira_en: new Date(Date.now() - 1_000).toISOString(),
    };

    guardarSesion(sesion);

    expect(leerSesion()).toBeNull();
    expect(localStorage.getItem('panaderia.sesion')).toBeNull();
  });

  it('borra una sesión corrupta', () => {
    localStorage.setItem('panaderia.sesion', '{no-es-json');

    expect(leerSesion()).toBeNull();
    expect(tokenActual()).toBeNull();
  });

  it('cerrarSesion deja el almacenamiento limpio', () => {
    guardarSesion(sesionValida());

    cerrarSesion();

    expect(leerSesion()).toBeNull();
  });

  it('la sesión sin login usa el rol encargado y no tiene token', () => {
    const sesion = sesionSinLogin();

    expect(sesion.usuario.rol).toBe('encargado');
    expect(sesion.token).toBe('');
  });
});
