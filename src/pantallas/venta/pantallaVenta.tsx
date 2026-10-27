import { useEffect, useMemo, useState } from 'react';
import {
  cargarCatalogo,
  observarCatalogo,
  type Producto,
} from '../../database/catalogo';
import {
  guardarVenta,
  listarVentas,
  observarVentas,
  type VentaLocal,
} from '../../database/pendientes';
import { formatearDinero } from '../../modelos/dinero';
import {
  enviarPendientes,
  EVENTO_AVISO_ENVIO,
  type AvisoEnvio,
} from '../../sync/cola';
import { Icono, IconoProducto } from '../../componentes/iconos';
import { useCarrito } from './useCarrito';
import './pantallaVenta.css';

const ETIQUETA_ESTADO: Record<VentaLocal['estado'], string> = {
  pendiente: 'Pendiente',
  enviando: 'Enviando',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
};

interface ProductoElegido extends Producto {
  cantidad: number;
  subtotal: number;
}

export default function PantallaVenta() {
  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [catalogoRespaldo, setCatalogoRespaldo] = useState(false);
  const [ventas, setVentas] = useState<VentaLocal[]>([]);
  const [aviso, setAviso] = useState('');
  const [avisoError, setAvisoError] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState<AvisoEnvio | null>(null);
  const [guardando, setGuardando] = useState(false);
  const carrito = useCarrito(catalogo);

  const fecha = useMemo(() => {
    const texto = new Intl.DateTimeFormat('es-SV', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());

    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }, []);

  // Nombre legible de cada producto, para la lista de ventas recientes.
  const nombres = useMemo(
    () => new Map(catalogo.map((p) => [p.id, p.nombre])),
    [catalogo],
  );

  const elegidos = useMemo<ProductoElegido[]>(
    () =>
      catalogo.flatMap((producto) => {
        const cantidad = carrito.cantidades[producto.id] ?? 0;

        if (cantidad === 0) {
          return [];
        }

        return [
          {
            ...producto,
            cantidad,
            subtotal: producto.precio_centavos * cantidad,
          },
        ];
      }),
    [catalogo, carrito.cantidades],
  );

  const unidades = useMemo(
    () => elegidos.reduce((total, producto) => total + producto.cantidad, 0),
    [elegidos],
  );

  // 1) Carga el catálogo y se mantiene atento a los cambios del espejo local.
  useEffect(() => {
    let activo = true;

    const refrescarCatalogo = () => {
      void cargarCatalogo()
        .then((resultado) => {
          if (activo) {
            setCatalogo(resultado.productos);
            setCatalogoRespaldo(resultado.esRespaldo);
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

    return () => {
      activo = false;
      dejarDeEscuchar();
    };
  }, []);

  // Avisos de la cola: sesión vencida o rol sin permiso.
  useEffect(() => {
    const alAvisar = (evento: Event) => {
      const detalle = (evento as CustomEvent<AvisoEnvio>).detail;

      if (detalle?.mensaje) {
        setAvisoEnvio(detalle);
      }
    };

    window.addEventListener(EVENTO_AVISO_ENVIO, alAvisar);
    return () => {
      window.removeEventListener(EVENTO_AVISO_ENVIO, alAvisar);
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
      setAvisoError(false);
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
      setAvisoError(true);
      setAviso('No se pudo guardar la venta. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  const vacio = carrito.lineas.length === 0;

  return (
    <main className="venta">
      <header className="venta-cabecera">
        <div>
          <p className="venta-fecha">
            <Icono nombre="reloj" />
            Hoy · {fecha}
          </p>
          <h1>Mostrador</h1>
          <p className="venta-subtitulo">
            Toca un producto para sumarlo a la comanda de hoy.
          </p>
        </div>
        <span className="venta-sello" aria-hidden="true">
          Horneado
          <br />
          hoy
        </span>
      </header>

      {catalogoRespaldo && (
        <div className="venta-avisos">
          <p className="aviso aviso--advertencia" role="alert">
            <Icono nombre="alerta" />
            <span>
              Sin catálogo descargado: se muestran precios de respaldo.
              Conéctate una vez para descargar el catálogo oficial.
            </span>
          </p>
        </div>
      )}

      <section className="vitrina" aria-labelledby="vitrina-titulo">
        <div className="seccion-cabecera">
          <div>
            <p className="etiqueta">La vitrina</p>
            <h2 id="vitrina-titulo">Recién horneado</h2>
          </div>
          <span className="chip">{catalogo.length} productos</span>
        </div>

        {catalogo.length === 0 ? (
          <div className="vacio">
            <span className="vacio__icono">
              <Icono nombre="hogaza" />
            </span>
            <strong>La vitrina está vacía</strong>
            <p>Revisa la conexión o el catálogo del servidor.</p>
          </div>
        ) : (
          <div className="productos" aria-label="Productos">
            {catalogo.map((p, indice) => {
              const cantidad = carrito.cantidades[p.id] ?? 0;
              const elegido = cantidad > 0;

              return (
                <article
                  key={p.id}
                  className={`producto${elegido ? ' producto--elegido' : ''}`}
                >
                  <div className="producto-fila">
                    <button
                      type="button"
                      className="producto-boton"
                      onClick={() => carrito.cambiar(p.id, 1)}
                      aria-label={`Agregar ${p.nombre} al pedido`}
                    >
                      <span className="producto-indice" aria-hidden="true">
                        {String(indice + 1).padStart(2, '0')}
                      </span>
                      <span className="producto-icono">
                        <IconoProducto id={p.id} />
                      </span>
                      <span className="producto-texto">
                        <span className="producto-nombre">{p.nombre}</span>
                        <span className="producto-precio">
                          {formatearDinero(p.precio_centavos)}
                        </span>
                      </span>
                      <span className="producto-accion">
                        {elegido ? (
                          <span className="producto-cantidad">{cantidad}</span>
                        ) : (
                          <span className="producto-mas" aria-hidden="true">
                            <Icono nombre="mas" />
                          </span>
                        )}
                      </span>
                    </button>

                    {elegido && (
                      <button
                        type="button"
                        className="quitar"
                        onClick={() => carrito.cambiar(p.id, -1)}
                        aria-label={`Quitar una unidad de ${p.nombre}`}
                      >
                        <Icono nombre="menos" />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className="resumen" aria-labelledby="resumen-titulo">
        <div className="resumen-cabecera">
          <div>
            <p className="etiqueta">Tu pedido</p>
            <h2 id="resumen-titulo">La comanda</h2>
          </div>
          <span className="resumen-carrito" aria-hidden="true">
            <Icono nombre="carrito" />
          </span>
        </div>

        {elegidos.length === 0 ? (
          <div className="resumen-vacio">
            <Icono nombre="trigo" />
            <p>La comanda está en blanco. Toca un producto para empezar.</p>
          </div>
        ) : (
          <ul className="resumen-lineas">
            {elegidos.map((p) => (
              <li key={p.id}>
                <span className="resumen-linea-icono">
                  <IconoProducto id={p.id} />
                </span>
                <span className="resumen-linea-nombre">{p.nombre}</span>
                <span className="resumen-linea-cantidad">×{p.cantidad}</span>
                <span className="resumen-linea-subtotal">
                  {formatearDinero(p.subtotal)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="resumen-total">
          <span>
            Total estimado
            <small>{unidades} artículos</small>
          </span>
          <strong>{formatearDinero(carrito.totalEstimado)}</strong>
        </div>
        <p className="nota">
          El total oficial lo calcula el servidor al confirmar la venta.
        </p>

        {(avisoEnvio || aviso) && (
          <div className="resumen-avisos">
            {avisoEnvio && (
              <div
                className={`aviso aviso--${avisoEnvio.tipo}`}
                role="alert"
              >
                <Icono nombre="alerta" />
                <span>{avisoEnvio.mensaje}</span>
                <button
                  type="button"
                  onClick={() => setAvisoEnvio(null)}
                  aria-label="Cerrar aviso"
                >
                  Cerrar
                </button>
              </div>
            )}

            {aviso && (
              <p
                className={`aviso ${
                  avisoError ? 'aviso--auth' : 'aviso--estado'
                }`}
                role={avisoError ? 'alert' : 'status'}
                aria-live="polite"
              >
                <Icono nombre={avisoError ? 'alerta' : 'check'} />
                <span>{aviso}</span>
              </p>
            )}
          </div>
        )}

        <div className="acciones">
          <button
            type="button"
            className="boton boton--fantasma"
            onClick={carrito.vaciar}
            disabled={vacio}
          >
            Vaciar
          </button>
          <button
            type="button"
            className="boton boton--principal"
            onClick={() => void registrar()}
            disabled={vacio || guardando}
          >
            {guardando ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Registrando…
              </>
            ) : (
              'Registrar venta'
            )}
          </button>
        </div>
      </aside>

      <section className="recientes" aria-labelledby="recientes-titulo">
        <div className="seccion-cabecera">
          <div>
            <p className="etiqueta">El turno</p>
            <h2 id="recientes-titulo">Ventas recientes</h2>
          </div>
          <span className="chip">{ventas.length} ventas</span>
        </div>

        {ventas.length === 0 ? (
          <div className="vacio">
            <span className="vacio__icono">
              <Icono nombre="reloj" />
            </span>
            <strong>Todavía no hay ventas</strong>
            <p>Los pedidos de hoy aparecerán aquí.</p>
          </div>
        ) : (
          <ul className="ventas">
            {ventas.map((v) => (
              <li key={v._id} className={`venta-item ${v.estado}`}>
                <span className="venta-item__hora">
                  <Icono nombre="reloj" />
                  {new Date(v.solicitud.creado_local).toLocaleTimeString(
                    'es-SV',
                    {
                      hour: '2-digit',
                      minute: '2-digit',
                    },
                  )}
                </span>
                <span className="venta-item__detalle">
                  {v.solicitud.lineas
                    .map(
                      (l) =>
                        `${l.cantidad} × ${
                          nombres.get(l.producto_id) ?? l.producto_id
                        }`,
                    )
                    .join(', ')}
                </span>
                <span className={`chip chip--${v.estado}`}>
                  {ETIQUETA_ESTADO[v.estado]}
                </span>
                {v.estado === 'aceptada' &&
                  v.total_oficial_centavos !== undefined && (
                    <strong className="venta-item__total">
                      Total oficial: {formatearDinero(v.total_oficial_centavos)}
                    </strong>
                  )}
                {v.estado === 'rechazada' && v.motivo && (
                  <em className="venta-item__motivo">{v.motivo}</em>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
