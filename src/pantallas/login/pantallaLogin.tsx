import { useState, type FormEvent } from 'react';
import {
  esSesionValida,
  guardarSesion,
  type Sesion,
} from '../../auth/sesion';
import { Icono } from '../../componentes/iconos';
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
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
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
      <section className="login-presentacion" aria-label="Panadería">
        <div className="login-presentacion__marca">
          <span className="login-sello" aria-hidden="true">
            <Icono nombre="hogaza" />
          </span>
          <span>
            <strong>Panadería</strong>
            <small>Horno de barrio</small>
          </span>
        </div>

        <div className="login-presentacion__cuerpo">
          <p className="etiqueta">Panadería de barrio · 01</p>
          <p className="login-presentacion__titular">
            El pan de cada día, <em>en su punto.</em>
          </p>
          <p>
            Un punto de venta sencillo para el ritmo del mostrador: rápido,
            cálido y sin complicaciones.
          </p>
        </div>

        <div className="login-presentacion__pie">
          <ul className="login-beneficios">
            <li>
              <Icono nombre="venta" />
              Mostrador rápido
            </li>
            <li>
              <Icono nombre="reloj" />
              Sigue sin conexión
            </li>
            <li>
              <Icono nombre="cierre" />
              Acceso por rol
            </li>
          </ul>
          <span className="login-presentacion__folio">
            Horneado para el barrio
          </span>
        </div>

        <span className="login-sol" aria-hidden="true">
          <Icono nombre="trigo" />
        </span>
      </section>

      <section className="login-tarjeta" aria-labelledby="login-titulo">
        <span className="login-tarjeta__numero" aria-hidden="true">
          01 / Acceso
        </span>
        <header className="login-cabecera">
          <span className="login-marca-pequena">
            <Icono nombre="hogaza" />
            Panadería
            <small>· Horno de barrio</small>
          </span>
          <p className="etiqueta">Acceso al mostrador</p>
          <h1 id="login-titulo">
            Entra al <em>mostrador.</em>
          </h1>
          <p className="login-ayuda">
            Usa tu usuario de caja o de encargado para empezar el turno.
          </p>
        </header>

        <form
          className="login-formulario"
          onSubmit={(evento) => void entrar(evento)}
        >
          <div className="campo">
            <label htmlFor="login-usuario">Usuario</label>
            <div className="campo__control">
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
                placeholder="cajero1"
                required
              />
            </div>
          </div>

          <div className="campo">
            <label htmlFor="login-contrasena">Contraseña</label>
            <div className="campo__control">
              <Icono nombre="cierre" />
              <input
                id="login-contrasena"
                name="contrasena"
                type={mostrarContrasena ? 'text' : 'password'}
                autoComplete="current-password"
                value={contrasena}
                onChange={(evento) => setContrasena(evento.target.value)}
                disabled={enviando || faltaConfiguracion}
                placeholder="Tu contraseña"
                required
              />
              <button
                type="button"
                className="login-ojo"
                onClick={() => setMostrarContrasena((valor) => !valor)}
                disabled={enviando || faltaConfiguracion}
                aria-label={
                  mostrarContrasena
                    ? 'Ocultar contraseña'
                    : 'Mostrar contraseña'
                }
              >
                <Icono
                  nombre={mostrarContrasena ? 'ojo-cerrado' : 'ojo'}
                />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="boton boton--principal login-boton"
            disabled={enviando || faltaConfiguracion}
          >
            {enviando ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Entrando…
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {faltaConfiguracion && (
          <p className="login-error" role="alert">
            <Icono nombre="alerta" />
            <span>
              Falta configurar <code>VITE_API_URL</code> en el frontend.
            </span>
          </p>
        )}

        {error && (
          <p className="login-error" role="alert" aria-live="polite">
            <Icono nombre="alerta" />
            <span>{error}</span>
          </p>
        )}

        <p className="login-pie">
          ¿Problemas para entrar? Consulta con el encargado del turno.
        </p>
      </section>
    </main>
  );
}
