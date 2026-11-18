import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
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
import { estadoCierre } from '../../api/panaderia';
import { Esqueleto } from '../../componentes/retroalimentacion';
import { notificar } from '../../componentes/notificaciones';
import { fechaHoy, fechaLarga, horaLocal } from '../../modelos/fecha';
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

export default function PantallaVenta({ consultarStock }: { consultarStock: boolean }) {
  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [catalogoRespaldo, setCatalogoRespaldo] = useState(false);
  const [ventas, setVentas] = useState<VentaLocal[]>([]);
  const [avisoEnvio, setAvisoEnvio] = useState<AvisoEnvio | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [cargandoVentas, setCargandoVentas] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [multiplicador, setMultiplicador] = useState('1');
  const [efectivo, setEfectivo] = useState('');
  const [stock, setStock] = useState<Record<string, number>>({});
  const ventasPorConfirmar = useRef(new Set<string>());
  const [movil, setMovil] = useState(() => matchMedia('(max-width: 760px)').matches);
  const dialogo = useRef<HTMLDialogElement>(null);
  const focoCatalogo = useRef<HTMLHeadingElement>(null);
  const bloqueo = useRef(false);
  const carrito = useCarrito(catalogo);

  const fecha = fechaHoy();
  const ultimaAceptada = ventas.find((venta) => venta.estado === 'aceptada')?._id;

  useEffect(() => {
    const consulta = matchMedia('(max-width: 760px)');
    const cambiar = () => setMovil(consulta.matches);
    consulta.addEventListener('change', cambiar);
    return () => consulta.removeEventListener('change', cambiar);
  }, []);

  useEffect(() => {
    if (!consultarStock) return;
    let vigente = true;
    let revision = 0;
    const actualizar = () => {
      const intento = ++revision;
      void estadoCierre(fecha).then((dia) => {
        if (!vigente || intento !== revision) return;
        setStock(dia.cerrado ? {} : Object.fromEntries(dia.por_producto.map((fila) => [
          fila.producto_id, Math.max(0, fila.producidas - fila.vendidas),
        ])));
      }).catch(() => {
        if (vigente && intento === revision) setStock({});
      });
    };
    const sinConexion = () => {
      revision += 1;
      setStock({});
    };
    actualizar();
    window.addEventListener('offline', sinConexion);
    window.addEventListener('focus', actualizar);
    window.addEventListener('online', actualizar);
    return () => {
      vigente = false;
      window.removeEventListener('offline', sinConexion);
      window.removeEventListener('focus', actualizar);
      window.removeEventListener('online', actualizar);
    };
  }, [consultarStock, fecha, ultimaAceptada]);

  useEffect(() => {
    for (const venta of ventas) {
      if (!ventasPorConfirmar.current.has(venta._id)) continue;
      if (venta.estado === 'aceptada' && venta.total_oficial_centavos !== undefined) {
        notificar(`Venta aceptada. Total oficial ${formatearDinero(venta.total_oficial_centavos)}.`);
        ventasPorConfirmar.current.delete(venta._id);
      } else if (venta.estado === 'rechazada') {
        notificar(venta.motivo || 'El servidor rechazó la venta. Revisa las ventas recientes.', 'error');
        ventasPorConfirmar.current.delete(venta._id);
      }
    }
  }, [ventas]);

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
        }).finally(() => { if (activo) setCargandoCatalogo(false); });
    };

    // Escuchar primero, para no perder cambios mientras se carga.
    const dejarDeEscuchar = observarCatalogo(refrescarCatalogo);

    // Cargar también los productos que ya estaban guardados.
    refrescarCatalogo();

    return () => {
      activo = false;
      dejarDeEscuchar();
    };
  }, [recarga]);

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
        }).finally(() => { if (activo) setCargandoVentas(false); });
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

  const vacio = carrito.lineas.length === 0;
  const recibido = Math.round(Number(efectivo) * 100);
  const cambio = recibido - carrito.totalEstimado;
  const excedeStock = carrito.lineas.some(({ producto_id, cantidad }) =>
    cantidad > (stock[producto_id] ?? Infinity));
  const puedeRegistrar = !vacio && !guardando && !excedeStock &&
    (efectivo === '' || (Number.isFinite(recibido) && cambio >= 0));

  function vaciar() {
    carrito.vaciar();
    setEfectivo('');
  }

  async function registrar() {
    if (!puedeRegistrar || bloqueo.current) return;
    bloqueo.current = true;
    setGuardando(true);
    try {
      const venta = await guardarVenta(carrito.lineas);
      ventasPorConfirmar.current.add(venta._id);
      vaciar();
      dialogo.current?.close();
      notificar(navigator.onLine
        ? 'Venta guardada. Confirmando con el servidor…'
        : 'Venta guardada en este dispositivo. Se enviará al recuperar la conexión.');
      void enviarPendientes().catch((error: unknown) => {
        console.error('No se pudo iniciar el envío de la venta:', error);
        notificar('La venta sigue pendiente de envío.', 'error');
      });
    } catch (error) {
      dialogo.current?.close();
      console.error('No se pudo guardar la venta:', error);
      notificar('No se pudo guardar la venta. Intenta de nuevo.', 'error');
    } finally {
      bloqueo.current = false;
      setGuardando(false);
    }
  }

  const atajo = useEffectEvent((evento: KeyboardEvent) => {
    if (evento.defaultPrevented || evento.isComposing || evento.repeat ||
        evento.altKey || evento.ctrlKey || evento.metaKey) return;
    if (evento.key === 'Escape' && !guardando && !vacio) {
      evento.preventDefault();
      vaciar();
    }
    if (evento.key === 'Enter' && !movil &&
        !(evento.target instanceof Element && evento.target.closest('button, a, input, select, textarea, [contenteditable]'))) {
      evento.preventDefault();
      void registrar();
    }
  });
  useEffect(() => {
    const escuchar = (evento: KeyboardEvent) => atajo(evento);
    window.addEventListener('keydown', escuchar);
    return () => window.removeEventListener('keydown', escuchar);
  }, []);

  const comanda = (
    <>
      <div className="resumen-cabecera">
        <h2 id="resumen-titulo">Comanda</h2>
        {movil && <button type="button" className="boton boton--fantasma" onClick={() => dialogo.current?.close()}>Cerrar</button>}
      </div>
      {vacio ? (
        <div className="resumen-vacio">
          <Icono nombre="trigo" />
          <p>Agrega un producto para empezar.</p>
          <button type="button" className="boton boton--fantasma" onClick={() => {
            dialogo.current?.close();
            requestAnimationFrame(() => focoCatalogo.current?.focus());
          }}>Ir a productos</button>
        </div>
      ) : (
        <ul className="resumen-lineas">
          {elegidos.map((p) => (
            <li key={p.id}>
              <strong>{p.nombre}</strong>
              <small>{formatearDinero(p.precio_centavos)} / ud.</small>
              <div className="contador">
                <button type="button" disabled={guardando} aria-label={`Restar una unidad de ${p.nombre}`}
                  onClick={() => carrito.cambiar(p.id, -1)}>−</button>
                <CantidadLinea cantidad={p.cantidad} maximo={Math.min(stock[p.id] ?? 1000, 1000)}
                  nombre={p.nombre} deshabilitado={guardando}
                  onCambiar={(valor) => carrito.cambiar(p.id, valor, stock[p.id], true)} />
                <button type="button" disabled={guardando || p.cantidad >= Math.min(stock[p.id] ?? 1000, 1000)}
                  aria-label={`Sumar una unidad de ${p.nombre}`}
                  onClick={() => carrito.cambiar(p.id, 1, stock[p.id])}>+</button>
              </div>
              <strong className="resumen-linea-subtotal">{formatearDinero(p.subtotal)}</strong>
              <button type="button" className="boton boton--fantasma resumen-quitar" disabled={guardando}
                aria-label={`Quitar ${p.nombre} de la comanda`}
                onClick={() => carrito.cambiar(p.id, 0, undefined, true)}>×</button>
            </li>
          ))}
        </ul>
      )}
      <div className="resumen-total">
        <span>Total estimado <small>{unidades} unidades</small></span>
        <strong>{formatearDinero(carrito.totalEstimado)}</strong>
      </div>
      <form className="pago" onSubmit={(evento) => { evento.preventDefault(); void registrar(); }}>
        <label className="campo">
          <span>Efectivo recibido</span>
          <input className="selector" type="number" inputMode="decimal" min={0} step=".01"
            value={efectivo} disabled={vacio || guardando} onChange={(e) => setEfectivo(e.target.value)} />
        </label>
        <div className="pildanas" aria-label="Importes de efectivo">
          {[1, 5, 10, 20].map((importe) => (
            <button key={importe} type="button" className="boton boton--fantasma"
              disabled={vacio || guardando} onClick={() => setEfectivo(String(importe))}>${importe}</button>
          ))}
          <button type="button" className="boton boton--fantasma" disabled={vacio || guardando}
            onClick={() => setEfectivo((carrito.totalEstimado / 100).toFixed(2))}>Exacto</button>
        </div>
        <div className="pago-cambio" aria-live="polite">
          <span>{efectivo !== '' && cambio < 0 ? 'Efectivo faltante' : 'Cambio estimado'}</span>
          <strong>{efectivo === '' ? '—' : formatearDinero(Math.abs(cambio))}</strong>
        </div>
        {excedeStock && <p className="aviso aviso--advertencia" role="alert">Ajusta las cantidades al stock disponible.</p>}
        <div className="acciones">
          <button type="button" className="boton boton--fantasma" onClick={vaciar} disabled={vacio || guardando}>Vaciar</button>
          <button type="submit" className="boton boton--principal" disabled={!puedeRegistrar}>
            {guardando ? <><span className="spinner" aria-hidden="true" /> Registrando…</> : 'Registrar venta'}
          </button>
        </div>
      </form>
    </>
  );

  return (
    <main className="venta">
      <header className="venta-cabecera">
        <div>
          <p className="venta-fecha"><Icono nombre="reloj" /> {fechaLarga(fecha)}</p>
          <h1>Mostrador</h1>
          <p className="venta-subtitulo">Elige la cantidad y toca un producto para agregarlo a la comanda.</p>
        </div>
      </header>

      {avisoEnvio && (
        <div className="venta-avisos">
          <div className={`aviso aviso--${avisoEnvio.tipo}`} role="alert">
            <Icono nombre="alerta" /><span>{avisoEnvio.mensaje}</span>
            <button type="button" className="boton boton--fantasma" onClick={() => setAvisoEnvio(null)}>Cerrar</button>
          </div>
        </div>
      )}

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
            <h2 id="vitrina-titulo" ref={focoCatalogo} tabIndex={-1}>Productos</h2>
          </div>
          <span className="chip">{catalogo.length} productos</span>
        </div>

        <div className="pildanas cantidad-rapida" role="group" aria-label="Cantidad por toque">
          {[1, 5, 10, 12].map((cantidad) => (
            <button key={cantidad} type="button" className={`pildana ${Number(multiplicador) === cantidad ? 'activa' : ''}`}
              aria-pressed={Number(multiplicador) === cantidad} onClick={() => setMultiplicador(String(cantidad))}>×{cantidad}</button>
          ))}
          <label className="campo campo--en-linea">
            <span>Cantidad</span>
            <input className="entrada-numero" type="number" inputMode="numeric" min={1} max={1000} value={multiplicador}
              onChange={(e) => setMultiplicador(e.target.value)} />
          </label>
        </div>
        {cargandoCatalogo ? <Esqueleto texto="Cargando catálogo…" tarjetas /> : catalogo.length === 0 ? (
          <div className="vacio">
            <span className="vacio__icono"><Icono nombre="hogaza" /></span>
            <strong>La vitrina está vacía</strong>
            <button type="button" className="boton boton--fantasma" onClick={() => {
              setCargandoCatalogo(true);
              setRecarga((valor) => valor + 1);
            }}>Volver a cargar</button>
          </div>
        ) : (
          <div className="productos">
            {catalogo.map((p) => {
              const cantidad = carrito.cantidades[p.id] ?? 0;
              const disponible = stock[p.id];
              const limite = Math.min(disponible ?? 1000, 1000);
              const agregar = Math.min(limite - cantidad, Number(multiplicador));
              return (
                <button type="button" key={p.id}
                  className={`producto producto-boton ${cantidad ? 'producto--elegido' : ''}`}
                  disabled={guardando || !Number.isInteger(agregar) || agregar <= 0 || Number(multiplicador) > 1000}
                  aria-label={`${p.nombre}, ${formatearDinero(p.precio_centavos)}${disponible === undefined ? '' : ', ' + disponible + ' disponibles'}${cantidad ? ', ' + cantidad + ' en comanda' : ''}`}
                  onClick={() => carrito.cambiar(p.id, agregar, disponible)}>
                  <span className="producto-icono"><IconoProducto id={p.id} /></span>
                  <span className="producto-nombre">{p.nombre}</span>
                  <span className="producto-precio">{formatearDinero(p.precio_centavos)}</span>
                  {disponible !== undefined && <span className={`chip ${disponible ? 'chip--aceptada' : 'chip--rechazada'}`}>{disponible ? `${disponible} disponibles` : 'Agotado'}</span>}
                  <span key={cantidad} className="producto-cantidad" aria-hidden="true">{cantidad || '+'}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {movil ? (
        <>
          <button type="button" className="boton boton--principal venta-comanda-movil"
            aria-haspopup="dialog" onClick={() => dialogo.current?.showModal()}>
            <Icono nombre="carrito" /> Comanda · {unidades}
            <strong>{formatearDinero(carrito.totalEstimado)}</strong>
          </button>
          <dialog className="resumen venta-dialogo" ref={dialogo} aria-labelledby="resumen-titulo">{comanda}</dialog>
        </>
      ) : <aside className="resumen" aria-labelledby="resumen-titulo">{comanda}</aside>}

      <section className="recientes" aria-labelledby="recientes-titulo">
        <div className="seccion-cabecera">
          <div>
            <h2 id="recientes-titulo">Ventas recientes</h2>
          </div>
          <span className="chip">{ventas.length} ventas</span>
        </div>

        {cargandoVentas ? <Esqueleto texto="Cargando ventas…" /> : ventas.length === 0 ? (
          <div className="vacio">
            <span className="vacio__icono">
              <Icono nombre="reloj" />
            </span>
            <strong>Todavía no hay ventas</strong>
            <button type="button" className="boton boton--fantasma" onClick={() => focoCatalogo.current?.focus()}>Ir a productos</button>
          </div>
        ) : (
          <ul className="ventas">
            {ventas.map((v) => (
              <li key={v._id} className={`venta-item ${v.estado}`}>
                <span className="venta-item__hora">
                  <Icono nombre="reloj" />
                  {horaLocal(v.solicitud.creado_local)}
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
                <button type="button" hidden>Ver detalle o anular</button>
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

function CantidadLinea({ cantidad, maximo, nombre, deshabilitado, onCambiar }: {
  cantidad: number;
  maximo: number;
  nombre: string;
  deshabilitado: boolean;
  onCambiar: (valor: number) => void;
}) {
  const [edicion, setEdicion] = useState<string | null>(null);
  return (
    <input type="number" inputMode="numeric" min={0} max={maximo}
      aria-label={`Cantidad de ${nombre}`} value={edicion ?? cantidad} disabled={deshabilitado}
      onChange={(evento) => setEdicion(evento.currentTarget.value)}
      onBlur={(evento) => {
        const valor = evento.currentTarget.valueAsNumber;
        if (edicion !== null && Number.isInteger(valor)) onCambiar(valor);
        setEdicion(null);
      }}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter') evento.currentTarget.blur();
      }}
    />
  );
}
