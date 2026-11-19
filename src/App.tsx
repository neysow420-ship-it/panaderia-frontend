import { Toasts } from './componentes/retroalimentacion';
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
import PantallaFacturas from './pantallas/facturas/pantallaFacturas';
import PantallaCierre from './pantallas/cierre/pantallaCierre';
import PantallaLogin from './pantallas/login/pantallaLogin';
import PantallaProduccion from './pantallas/produccion/pantallaProduccion';
import PantallaReportes from './pantallas/reportes/pantallaReportes';
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

      <Toasts />
      <div className="app-contenido">
        {pantallaVisible === 'venta' && <PantallaVenta consultarStock={sesion.usuario.rol === 'encargado'} />}
        {pantallaVisible === 'produccion' && <PantallaProduccion />}
        {pantallaVisible === 'facturas' && <PantallaFacturas />}
        {pantallaVisible === 'cierre' && <PantallaCierre />}
        {pantallaVisible === 'reportes' && <PantallaReportes />}
      </div>
    </div>
  );
}
