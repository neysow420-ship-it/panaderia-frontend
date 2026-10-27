import { useEffect, useState } from 'react';
import {
  EVENTO_SESION_EXPIRADA,
  autenticacionActiva,
  cerrarSesion,
  leerSesion,
  sesionSinLogin,
  type Sesion,
} from './auth/sesion';
import BarraNavegacion, { type Pantalla } from './componentes/barraNavegacion';
import { Icono, type NombreIcono } from './componentes/iconos';
import PantallaLogin from './pantallas/login/pantallaLogin';
import PantallaVenta from './pantallas/venta/pantallaVenta';
import { iniciarReplicaCatalogo } from './sync/catalogo';
import { enviarPendientes, recuperarVentasEnviando } from './sync/cola';
import './App.css';

/** Cada cuánto se reintenta la cola mientras la app está abierta. */
const INTERVALO_ENVIO_MS = 15_000;

export default function App() {
  const exigeLogin = autenticacionActiva();
  const [sesion, setSesion] = useState<Sesion | null>(() =>
    exigeLogin ? leerSesion() : sesionSinLogin(),
  );

  // La cola avisa cuando la API responde 401; volvemos al login sin borrar
  // las ventas pendientes (viven en IndexedDB).
  useEffect(() => {
    const alExpirar = () => setSesion(null);

    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => {
      window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    };
  }, []);

  if (!sesion) {
    return <PantallaLogin onEntrar={setSesion} />;
  }

  return (
    <Aplicacion
      sesion={sesion}
      onSalir={
        exigeLogin
          ? () => {
              cerrarSesion();
              setSesion(null);
            }
          : undefined
      }
    />
  );
}

interface PropsAplicacion {
  sesion: Sesion;
  onSalir?: () => void;
}

function Aplicacion({ sesion, onSalir }: PropsAplicacion) {
  const [pantalla, setPantalla] = useState<Pantalla>('venta');

  useEffect(() => {
    return iniciarReplicaCatalogo();
  }, []);

  // Envía las ventas pendientes al abrir, al recuperar conexión y cada 15 s.
  // Solo se monta con una sesión válida, para no golpear la API sin token.
  useEffect(() => {
    let activo = true;

    const enviar = () => {
      if (!activo) {
        return;
      }

      void enviarPendientes().catch((error: unknown) => {
        console.error('No se pudo procesar la cola de ventas:', error);
      });
    };

    // Si la pestaña se cerró durante un envío, la venta quedó en "enviando".
    void recuperarVentasEnviando()
      .catch((error: unknown) => {
        console.error('No se pudo recuperar la cola de ventas:', error);
      })
      .finally(enviar);

    const intervalo = window.setInterval(enviar, INTERVALO_ENVIO_MS);
    window.addEventListener('online', enviar);

    return () => {
      activo = false;
      window.clearInterval(intervalo);
      window.removeEventListener('online', enviar);
    };
  }, []);

  // Un cajero no puede abrir las secciones de encargado.
  const pantallaVisible =
    sesion.usuario.rol === 'cajero' ? 'venta' : pantalla;

  return (
    <div className="app-shell">
      <BarraNavegacion
        sesion={sesion}
        pantalla={pantallaVisible}
        onCambiar={setPantalla}
        onSalir={onSalir}
      />

      <div className="app-contenido">
        {pantallaVisible === 'venta' && <PantallaVenta />}
        {pantallaVisible === 'produccion' && (
          <PantallaPendiente
            titulo="Producción"
            descripcion="Aquí llevarás el control de las hornadas, la merma y los vencimientos del día."
            detalles={['Hornadas', 'Merma', 'Vencimientos']}
            icono="produccion"
            onVolver={() => setPantalla('venta')}
          />
        )}
        {pantallaVisible === 'cierre' && (
          <PantallaPendiente
            titulo="Cierre"
            descripcion="El resumen de ventas y el cierre de caja estarán disponibles en esta sección."
            detalles={['Ventas del día', 'Arqueo de caja', 'Cierre']}
            icono="cierre"
            onVolver={() => setPantalla('venta')}
          />
        )}
        {pantallaVisible === 'reportes' && (
          <PantallaPendiente
            titulo="Reportes"
            descripcion="Consulta el comportamiento de las ventas, la producción y la merma."
            detalles={['Ventas', 'Merma', 'Tendencias']}
            icono="reportes"
            onVolver={() => setPantalla('venta')}
          />
        )}
      </div>
    </div>
  );
}

function PantallaPendiente({
  titulo,
  descripcion,
  detalles,
  icono,
  onVolver,
}: {
  titulo: string;
  descripcion: string;
  detalles: string[];
  icono: NombreIcono;
  onVolver: () => void;
}) {
  return (
    <main className="pantalla-pendiente">
      <section className="pendiente" aria-labelledby="pendiente-titulo">
        <div className="pendiente__icono">
          <Icono nombre={icono} />
        </div>
        <span className="pendiente__chip">Próximamente</span>
        <h1 id="pendiente-titulo">{titulo}</h1>
        <p className="pendiente__descripcion">{descripcion}</p>

        <ul className="pendiente__lista">
          {detalles.map((detalle) => (
            <li key={detalle}>
              <Icono nombre="check" />
              {detalle}
            </li>
          ))}
        </ul>

        <button type="button" className="boton" onClick={onVolver}>
          Volver a venta
        </button>
      </section>
    </main>
  );
}
