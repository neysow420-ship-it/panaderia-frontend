
import { useEffect } from 'react';
import PantallaVenta from './pantallas/venta/pantallaVenta';
import { iniciarReplicaCatalogo } from './sync/catalogo';
import { enviarPendientes, recuperarVentasEnviando } from './sync/cola';

/** Cada cuánto se reintenta la cola mientras la app está abierta. */
const INTERVALO_ENVIO_MS = 15_000;

export default function App() {
  useEffect(() => {
    return iniciarReplicaCatalogo();
  }, []);

  // Envía las ventas pendientes al abrir, al recuperar conexión y cada 15 s.
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

  return <PantallaVenta />;
}
