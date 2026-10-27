import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTO_SESION_EXPIRADA, guardarSesion } from '../auth/sesion';
import type { VentaLocal } from '../database/pendientes';

const EVENTO_AVISO = 'panaderia:aviso-envio';

const mocks = vi.hoisted(() => ({
  listarVentas: vi.fn(),
  actualizarEstadoVenta: vi.fn(),
  marcarVentaAceptada: vi.fn(),
}));

vi.mock('../database/pendientes', () => mocks);

const VENTA: VentaLocal = {
  _id: 'venta-1',
  estado: 'pendiente',
  intentos: 0,
  solicitud: {
    operacion_id: '01JPRUEBA',
    creado_local: '2026-10-26T10:00:00-06:00',
    dispositivo_id: 'caja-1',
    lineas: [{ producto_id: 'producto:pan-frances', cantidad: 1 }],
  },
};

function respuesta(status: number, cuerpo: unknown): Response {
  return {
    status,
    json: async () => cuerpo,
  } as Response;
}

describe('cola de ventas con autenticación', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'http://api.prueba');
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    guardarSesion({
      token: 'token-de-prueba',
      tipo: 'Bearer',
      expira_en: new Date(Date.now() + 60_000).toISOString(),
      usuario: { nombre: 'cajero1', rol: 'cajero' },
    });

    mocks.listarVentas.mockResolvedValue([VENTA]);
    mocks.actualizarEstadoVenta.mockImplementation(
      async (_id: string, estado: VentaLocal['estado']) => ({
        ...VENTA,
        estado,
      }),
    );
    mocks.marcarVentaAceptada.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('envía el Bearer y, ante 401, conserva la venta y pide login', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta(401, {}));
    vi.stubGlobal('fetch', fetchMock);
    const alExpirar = vi.fn();
    const alAvisar = vi.fn();
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    window.addEventListener(EVENTO_AVISO, alAvisar);

    const { enviarPendientes } = await import('./cola');
    const resultado = await enviarPendientes();

    expect(resultado).toEqual({ enviadas: 0, rechazadas: 0 });
    expect(mocks.marcarVentaAceptada).not.toHaveBeenCalled();
    expect(mocks.actualizarEstadoVenta).toHaveBeenCalledWith(
      'venta-1',
      'pendiente',
    );
    expect(alExpirar).toHaveBeenCalled();
    expect(
      (alAvisar.mock.calls[0][0] as CustomEvent).detail.tipo,
    ).toBe('auth');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.prueba/ventas',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-de-prueba',
        }),
      }),
    );

    window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    window.removeEventListener(EVENTO_AVISO, alAvisar);
  });

  it('ante 403 conserva la venta y muestra un aviso de permiso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(403, {})));
    const alAvisar = vi.fn();
    window.addEventListener(EVENTO_AVISO, alAvisar);

    const { enviarPendientes } = await import('./cola');
    await enviarPendientes();

    expect(mocks.actualizarEstadoVenta).toHaveBeenCalledWith(
      'venta-1',
      'pendiente',
    );
    expect(
      (alAvisar.mock.calls[0][0] as CustomEvent).detail.tipo,
    ).toBe('prohibido');

    window.removeEventListener(EVENTO_AVISO, alAvisar);
  });

  it('ante 409 marca la venta como rechazada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuesta(409, { codigo: 'conflicto' })),
    );

    const { enviarPendientes } = await import('./cola');
    const resultado = await enviarPendientes();

    expect(resultado).toEqual({ enviadas: 0, rechazadas: 1 });
    expect(mocks.actualizarEstadoVenta).toHaveBeenCalledWith(
      'venta-1',
      'rechazada',
      expect.stringContaining('identificador'),
    );
  });
});
