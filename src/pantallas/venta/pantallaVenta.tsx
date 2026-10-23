import { useEffect, useMemo, useState } from 'react';
import { cargarCatalogo, type Producto } from '../../database/catalogo';
import {
  guardarVenta,
  listarVentas,
  observarVentas,
  type VentaLocal,
} from '../../database/pendientes';
import { formatearDinero } from '../../modelos/dinero';
import { useCarrito } from './useCarrito';
import './PantallaVenta.css';

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
    cargarCatalogo().then(setCatalogo);
  }, []);

  // 2) Lee las ventas locales (las más recientes primero) y se mantiene al día:
  //    escucha los cambios de la base local para refrescar la lista sola.
  useEffect(() => {
    let activo = true;

    const refrescar = () =>
      listarVentas().then((todas) => {
        if (!activo) return;
        // El ULID se ordena por hora de creación: el mayor es el más reciente.
        todas.sort((a, b) => b._id.localeCompare(a._id));
        setVentas(todas.slice(0, 10));
      });

    refrescar();
    const dejarDeEscuchar = observarVentas(refrescar);

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
        'Venta guardada en este dispositivo. Está pendiente: todavía no es una venta oficial.',
      );
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