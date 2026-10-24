import { useEffect, useMemo, useState } from 'react';
import {
  cargarCatalogo,
  observarCatalogo,
  type Producto,
} from '../../database/catalogo';import {
  guardarVenta,
  listarVentas,
  observarVentas,
  type VentaLocal,
} from '../../database/pendientes';
import { formatearDinero } from '../../modelos/dinero';
import { enviarPendientes } from '../../sync/cola';
import { useCarrito } from './useCarrito';
import './pantallaVenta.css';

const ETIQUETA_ESTADO: Record<VentaLocal['estado'], string> = {
  pendiente: 'Pendiente: aún no es oficial',
  enviando: 'Enviando…',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
};

export default function PantallaVenta() {
  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [ventas, setVentas] = useState<VentaLocal[]>([]);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const carrito = useCarrito(catalogo);

  // Nombre legible de cada producto, para la lista de ventas recientes.
  const nombres = useMemo(
    () => new Map(catalogo.map((p) => [p.id, p.nombre])),
    [catalogo],
  );

  // 1) Carga el catálogo una sola vez.
 useEffect(() => {
  let activo = true;

  const refrescarCatalogo = () => {
    void cargarCatalogo()
      .then((productos) => {
        if (activo) {
          setCatalogo(productos);
        }
      })
      .catch((error: unknown) => {
        console.error('No se pudo leer el catálogo local:', error);
      });
  };

  // Escuchar primero, para no perder cambios mientras se carga.
  const dejarDeEscuchar = observarCatalogo(refrescarCatalogo);

  // Cargar también los productos que ya estaban guardados.
  refrescarCatalogo();
  //segundo use effect 
  



  return () => {
    activo = false;
    dejarDeEscuchar();
  };
}, []);

useEffect(() => {
  let activo = true;

  function refrescarVentas() {
    void listarVentas()
      .then((resultado) => {
        if (activo) {
          setVentas(resultado);
        }
      })
      .catch((error: unknown) => {
        console.error('No se pudieron cargar las ventas:', error);
      });
  }

  // Escuchar cambios en la base local de ventas.
  const dejarDeEscuchar = observarVentas(refrescarVentas);

  // Cargar también las ventas que ya estaban guardadas.
  refrescarVentas();

  return () => {
    activo = false;
    dejarDeEscuchar();
  };
}, []);

  async function registrar() {
    setGuardando(true);
    try {
      await guardarVenta(carrito.lineas);
      carrito.vaciar();
      setAviso(
        navigator.onLine
          ? 'Venta guardada. Confirmando con el servidor…'
          : 'Venta guardada en este dispositivo. Se enviará cuando vuelva la conexión.',
      );

      // Intenta confirmarla de inmediato; el total oficial lo calcula la API.
      void enviarPendientes().catch((error: unknown) => {
        console.error('No se pudo iniciar el envío de la venta:', error);
      });
    } catch (error) {
      console.error('No se pudo guardar la venta:', error);
      setAviso('No se pudo guardar la venta. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  const vacio = carrito.lineas.length === 0;

  return (
    <main className="venta">
      <h1>Venta rápida</h1>

      <section className="productos" aria-label="Productos">
        {catalogo.map((p) => {
          const cantidad = carrito.cantidades[p.id] ?? 0;
          return (
            <div key={p.id} className="producto">
              {/* Tocar el botón grande suma una unidad. */}
              <button
                type="button"
                className={`producto-boton${cantidad > 0 ? ' elegido' : ''}`}
                onClick={() => carrito.cambiar(p.id, 1)}
              >
                <span className="nombre">{p.nombre}</span>
                <span className="precio">{formatearDinero(p.precio_centavos)}</span>
                {cantidad > 0 && <span className="cantidad">{cantidad}</span>}
              </button>
              {cantidad > 0 && (
                <button
                  type="button"
                  className="quitar"
                  onClick={() => carrito.cambiar(p.id, -1)}
                  aria-label={`Quitar una unidad de ${p.nombre}`}
                >
                  −
                </button>
              )}
            </div>
          );
        })}
      </section>

      <section className="resumen">
        <p className="total">
          Total estimado: <strong>{formatearDinero(carrito.totalEstimado)}</strong>
        </p>
        <p className="nota">El total oficial lo calcula el servidor al confirmar la venta.</p>
        <div className="acciones">
          <button type="button" onClick={carrito.vaciar} disabled={vacio}>
            Vaciar
          </button>
          <button
            type="button"
            className="principal"
            onClick={() => void registrar()}
            disabled={vacio || guardando}
          >
            Registrar venta
          </button>
        </div>
        {aviso && (
          <p role="status" className="aviso">
            {aviso}
          </p>
        )}
      </section>

      <section aria-label="Ventas recientes">
        <h2>Ventas recientes</h2>
        {ventas.length === 0 ? (
          <p>Aún no hay ventas.</p>
        ) : (
          <ul className="ventas">
            {ventas.map((v) => (
              <li key={v._id} className={`venta-item ${v.estado}`}>
                <span className="hora">
                  {new Date(v.solicitud.creado_local).toLocaleTimeString('es-SV', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="detalle">
                  {v.solicitud.lineas
                    .map((l) => `${l.cantidad} × ${nombres.get(l.producto_id) ?? l.producto_id}`)
                    .join(', ')}
                </span>
                <span className="estado">{ETIQUETA_ESTADO[v.estado]}</span>
                {/* Solo aparece cuando el servidor aceptó la venta (lo llena el ítem 4.13). */}
                {v.estado === 'aceptada' && v.total_oficial_centavos !== undefined && (
                  <strong>Total oficial: {formatearDinero(v.total_oficial_centavos)}</strong>
                )}
                {v.estado === 'rechazada' && v.motivo && <em>{v.motivo}</em>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}