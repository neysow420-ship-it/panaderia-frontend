import { useState, type FormEvent } from 'react';
import {
  esSesionValida,
  guardarSesion,
  type Sesion,
} from '../../auth/sesion';
import './pantallaLogin.css';

interface Props {
  onEntrar: (sesion: Sesion) => void;
}

interface ErrorCampoApi {
  campo?: string;
  motivo?: string;
}

interface ErrorApi {
  codigo?: string;
  errores?: ErrorCampoApi[];
}

function mensajeDeError(datos: ErrorApi | null): string {
  const primero = datos?.errores?.[0];

  if (primero?.motivo) {
    return primero.motivo;
  }

  if (datos?.codigo === 'credenciales_invalidas') {
    return 'Usuario o contraseña incorrectos.';
  }

  return 'No se pudo iniciar sesión. Intenta de nuevo.';
}

export default function PantallaLogin({ onEntrar }: Props) {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const base = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
  const faltaConfiguracion = !base;

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError('');

    if (!base) {
      setError(
        'Falta configurar VITE_API_URL. Revisa el archivo .env del frontend.',
      );
      return;
    }

    if (!usuario.trim() || !contrasena) {
      setError('Escribe tu usuario y contraseña.');
      return;
    }

    setEnviando(true);

    try {
      const respuesta = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: usuario.trim(),
          contrasena,
        }),
      });

      const datos: unknown = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        if (respuesta.status === 401) {
          setError('Usuario o contraseña incorrectos.');
          return;
        }

        if (respuesta.status === 422) {
          setError(mensajeDeError(datos as ErrorApi | null));
          return;
        }

        if (respuesta.status === 503) {
          setError(
            'El servidor no está disponible en este momento. Intenta más tarde.',
          );
          return;
        }

        setError(mensajeDeError(datos as ErrorApi | null));
        return;
      }

      if (!esSesionValida(datos)) {
        setError('El servidor devolvió una sesión inválida.');
        return;
      }

      guardarSesion(datos);
      onEntrar(datos);
    } catch {
      setError(
        'No se pudo conectar con el servidor. Revisa la conexión e intenta de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <section className="login-tarjeta" aria-labelledby="login-titulo">
        <p className="login-marca">Panadería</p>
        <h1 id="login-titulo">Iniciar sesión</h1>
        <p className="login-ayuda">
          Usa tu usuario de caja o de encargado para entrar al sistema.
        </p>

        <form className="login-formulario" onSubmit={(evento) => void entrar(evento)}>
          <label htmlFor="login-usuario">Usuario</label>
          <input
            id="login-usuario"
            name="usuario"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={usuario}
            onChange={(evento) => setUsuario(evento.target.value)}
            disabled={enviando || faltaConfiguracion}
            required
          />

          <label htmlFor="login-contrasena">Contraseña</label>
          <input
            id="login-contrasena"
            name="contrasena"
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(evento) => setContrasena(evento.target.value)}
            disabled={enviando || faltaConfiguracion}
            required
          />

          <button
            type="submit"
            className="login-boton"
            disabled={enviando || faltaConfiguracion}
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        {faltaConfiguracion && (
          <p className="login-error" role="alert">
            Falta configurar <code>VITE_API_URL</code> en el frontend.
          </p>
        )}

        {error && (
          <p className="login-error" role="alert" aria-live="polite">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
