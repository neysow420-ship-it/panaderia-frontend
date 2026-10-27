import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Sesion } from '../../auth/sesion';
import PantallaLogin from './pantallaLogin';

const SESION: Sesion = {
  token: 'jwt-de-prueba',
  tipo: 'Bearer',
  expira_en: new Date(Date.now() + 60_000).toISOString(),
  usuario: { nombre: 'cajero1', rol: 'cajero' },
};

function respuestaJson(status: number, cuerpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
  } as Response;
}

describe('pantalla de login', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('guarda la sesión y avisa a App cuando el login es correcto', async () => {
    vi.stubEnv('VITE_API_URL', 'http://api.prueba');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respuestaJson(200, SESION));
    vi.stubGlobal('fetch', fetchMock);
    const alEntrar = vi.fn();

    render(<PantallaLogin onEntrar={alEntrar} />);

    await userEvent.type(screen.getByLabelText('Usuario'), 'cajero1');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(alEntrar).toHaveBeenCalledWith(SESION);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.prueba/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(localStorage.getItem('panaderia.sesion')).toContain(
      'jwt-de-prueba',
    );
  });

  it('muestra un error claro con credenciales incorrectas', async () => {
    vi.stubEnv('VITE_API_URL', 'http://api.prueba');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuestaJson(401, {})),
    );
    const alEntrar = vi.fn();

    render(<PantallaLogin onEntrar={alEntrar} />);

    await userEvent.type(screen.getByLabelText('Usuario'), 'cajero1');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText('Usuario o contraseña incorrectos.'),
    ).toBeInTheDocument();
    expect(alEntrar).not.toHaveBeenCalled();
  });

  it('avisa si no se puede conectar con la API', async () => {
    vi.stubEnv('VITE_API_URL', 'http://api.prueba');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('sin red')),
    );

    render(<PantallaLogin onEntrar={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Usuario'), 'cajero1');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText(/No se pudo conectar con el servidor/),
    ).toBeInTheDocument();
  });
});
