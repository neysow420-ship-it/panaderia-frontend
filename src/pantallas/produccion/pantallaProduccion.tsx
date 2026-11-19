import { navegarPestanas } from '../../componentes/pestanas';
import { Esqueleto } from '../../componentes/retroalimentacion';
import { notificar } from '../../componentes/notificaciones';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ulid } from 'ulid';
import { cantidadMaterial, listarMateriales, listarProductos, type Inventario, type ProductoReceta } from '../../api/materiales';
import { PanelMateriales, PanelRecetas } from './materialesProduccion';
import { ErrorApi } from '../../api/cliente';
import {
  listarDescartes,
  listarHornadas,
  registrarDescarte,
  registrarHornada,
  vencimientos,
  type DescarteApi,
  type EstadoVencimiento,
  type HornadaApi,
  type SolicitudHornada,
  type LoteVencimientoApi,
  type MotivoDescarte,
  type ReporteVencimientosApi,
} from '../../api/panaderia';
import { Icono, IconoProducto } from '../../componentes/iconos';
import {
  creadoAhora,
  fechaHoy,
  fechaLegible,
  fechaLarga,
  horaLocal,
  sumarDias,
} from '../../modelos/fecha';
import { useCatalogo } from '../comunes/useCatalogo';
import '../comunes/encargado.css';

type Pestana = 'hornadas' | 'merma' | 'vencimientos' | 'materiales' | 'recetas';

const ETIQUETA_VENCIMIENTO: Record<EstadoVencimiento, string> = {
  vencido: 'Vencido',
  vence_hoy: 'Vence hoy',
  por_vencer: 'Por vencer',
  vigente: 'Vigente',
};

const CLASE_VENCIMIENTO: Record<EstadoVencimiento, string> = {
  vencido: 'estado--vencido',
  vence_hoy: 'estado--hoy',
  por_vencer: 'estado--proximo',
  vigente: 'estado--vigente',
};

const ETIQUETA_MOTIVO: Record<MotivoDescarte, string> = {
  danado: 'Dañado',
  vencido: 'Vencido',
};

function mensajeDe(error: unknown): string {
  if (error instanceof ErrorApi) {
    return error.message;
  }

  return 'No se pudo completar la operación.';
}

export default function PantallaProduccion() {
  const { productos, nombreDe } = useCatalogo();
  const [fecha] = useState(() => fechaHoy());
  const [pestana, setPestana] = useState<Pestana>('hornadas');
  const [hornadas, setHornadas] = useState<HornadaApi[]>([]);
  const [descartes, setDescartes] = useState<DescarteApi[]>([]);
  const [reporteVencimientos, setReporteVencimientos] =
    useState<ReporteVencimientosApi | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorDia, setErrorDia] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [inventario, setInventario] = useState<Inventario | null>(null);
  const [productosApi, setProductosApi] = useState<ProductoReceta[] | null>(null);
  const [errorMateriales, setErrorMateriales] = useState('');
  const [recargaMateriales, setRecargaMateriales] = useState(0);
  const actualizarMateriales = useCallback(() => setRecargaMateriales((n) => n + 1), []);

  useEffect(() => {
    if (pestana !== 'materiales' && pestana !== 'hornadas' && pestana !== 'recetas') return;
    let activo = true;
    let consultando = false;
    const consultar = async () => {
      if (consultando) return;
      consultando = true;
      try {
        const [stock, catalogo] = await Promise.all([listarMateriales(), listarProductos()]);
        if (!activo) return;
        setInventario(stock.materiales);
        setProductosApi(catalogo);
        setErrorMateriales('');
      } catch (fallo) {
        if (activo) setErrorMateriales(mensajeDe(fallo));
      } finally {
        consultando = false;
      }
    };
    void consultar();
    const intervalo = window.setInterval(() => void consultar(), 30_000);
    return () => {
      activo = false;
      window.clearInterval(intervalo);
    };
  }, [pestana, recargaMateriales]);

  // Carga del día: lotes, merma y vencimientos.
  useEffect(() => {
    let activo = true;

    void Promise.allSettled([
      listarHornadas(fecha),
      listarDescartes(fecha),
      vencimientos(fecha),
    ]).then(([lotes, mermas, vence]) => {
      if (!activo) {
        return;
      }

      const fallos: string[] = [];

      if (lotes.status === 'fulfilled') {
        setHornadas(lotes.value);
      } else {
        fallos.push(mensajeDe(lotes.reason));
      }

      if (mermas.status === 'fulfilled') {
        setDescartes(mermas.value);
      } else {
        fallos.push(mensajeDe(mermas.reason));
      }

      if (vence.status === 'fulfilled') {
        setReporteVencimientos(vence.value);
      } else {
        fallos.push(mensajeDe(vence.reason));
      }

      setErrorDia(fallos[0] ?? '');
      setCargando(false);
    });

    return () => {
      activo = false;
    };
  }, [fecha, recarga]);

  const recargar = (texto?: string) => {
    setCargando(true);
    setErrorDia('');
    if (texto) notificar(texto);
    setRecarga((valor) => valor + 1);
  };

  const totalProducido = useMemo(
    () => hornadas.reduce((total, hornada) => total + hornada.unidades, 0),
    [hornadas],
  );

  return (
    <main className="encargado">
      <header className="encargado__cabecera">
        <div className="encargado__titulo">
          <p className="encargado__fecha">
            <Icono nombre="trigo" />
            {fechaLarga(fecha)}
          </p>
          <h1>Producción</h1>
        </div>

        <div className="encargado__acciones">
          <span className="chip">
            {hornadas.length} lotes · {totalProducido} unidades
          </span>

          <div className="segmentado" role="tablist" onKeyDown={navegarPestanas} aria-label="Secciones de producción">
            {(
              [
                ['hornadas', 'Hornadas'],
                ['merma', 'Merma'],
                ['vencimientos', 'Vencimientos'],
                ['materiales', 'Materiales'],
                ['recetas', 'Recetas'],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={pestana === valor}
                tabIndex={pestana === valor ? 0 : -1}
                id={`produccion-tab-${valor}`}
                aria-controls="produccion-contenido"
                className={pestana === valor ? 'activo' : ''}
                onClick={() => setPestana(valor)}
              >
                {etiqueta}
                {(valor === 'hornadas' || valor === 'merma' || valor === 'vencimientos') && <span className="segmentado__cuenta">{{
                  hornadas: hornadas.length,
                  merma: descartes.length,
                  vencimientos: reporteVencimientos?.lotes.length ?? 0,
                }[valor]}</span>}
              </button>
            ))}
          </div>
        </div>
      </header>

      {errorDia && (
        <p className="aviso aviso--auth" role="alert">
          <Icono nombre="alerta" />
          {errorDia}
          <button type="button" className="boton boton--fantasma" onClick={() => recargar()}>Reintentar</button>
        </p>
      )}

      <div className="contenido-pestana" id="produccion-contenido" role="tabpanel"
        aria-labelledby={`produccion-tab-${pestana}`} tabIndex={0}>
        {errorMateriales && (pestana === 'materiales' || pestana === 'recetas' || pestana === 'hornadas') && (
          <p role="alert" className="aviso aviso--auth">{errorMateriales}
            <button className="boton boton--fantasma" type="button" onClick={actualizarMateriales}>Reintentar</button>
          </p>
        )}
        {pestana === 'materiales' && <PanelMateriales inventario={inventario} onActualizar={actualizarMateriales} />}
        {pestana === 'recetas' && productosApi !== null &&
          <PanelRecetas productos={productosApi} inventario={inventario} onGuardada={() => {
            actualizarMateriales();
            notificar('Producto y receta guardados.');
          }} />
        }
        {pestana === 'recetas' && productosApi === null && !errorMateriales && <p role="status">Cargando productos…</p>}
        {pestana === 'hornadas' && (
          <section className="dos-columnas">
            <PanelLotes
              cargando={cargando}
              hornadas={hornadas}
              nombreDe={nombreDe}
              hoy={fecha}
            />
            <FormularioHornada
              productos={productosApi?.filter((producto) => producto.activo).map((producto) => ({
                id: producto._id, nombre: producto.nombre, precio_centavos: producto.precio_centavos,
                receta: producto.receta,
              })) ?? productos}
              recetasCargadas={productosApi !== null}
              inventario={inventario}
              fecha={fecha}
              onRegistrada={(texto) => {
                recargar(texto);
                actualizarMateriales();
              }}
            />
          </section>
        )}

        {pestana === 'merma' && (
          <section className="dos-columnas">
            <PanelMerma
              cargando={cargando}
              descartes={descartes}
              nombreDe={nombreDe}
            />
            <FormularioMerma
              fecha={fecha}
              hornadas={hornadas}
              descartes={descartes}
              nombreDe={nombreDe}
              onRegistrada={recargar}
            />
          </section>
        )}

        {pestana === 'vencimientos' && (
          <PanelVencimientos
            cargando={cargando}
            reporte={reporteVencimientos}
            nombreDe={nombreDe}
            onHornadas={() => setPestana('hornadas')}
            onRecargar={() => recargar()}
          />
        )}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hornadas
// ─────────────────────────────────────────────────────────────────────────────

function PanelLotes({
  cargando,
  hornadas,
  nombreDe,
  hoy,
}: {
  cargando: boolean;
  hornadas: HornadaApi[];
  nombreDe: (id: string) => string;
  hoy: string;
}) {
  return (
    <section className="panel" aria-labelledby="lotes-titulo">
      <header className="panel__cabecera">
        <div>
          <h2 id="lotes-titulo">Lotes de hoy</h2>
          <p className="nota">
            Lo producido en cada hornada. El vencimiento lo calcula el servidor
            con la vida útil del producto.
          </p>
        </div>
      </header>

      {cargando ? (
        <Esqueleto texto="Cargando lotes…" />
      ) : hornadas.length === 0 ? (
        <div className="vacio">
          <span className="vacio__icono">
            <Icono nombre="trigo" />
          </span>
          <strong>Todavía no hay hornadas</strong>
          <a className="boton boton--fantasma" href="#nueva-hornada-titulo">Nueva hornada</a>
        </div>
      ) : (
        <ul className="lotes">
          {hornadas.map((hornada) => {
            const estado = estadoDeVencimiento(hornada.fecha_vencimiento, hoy);
            return (
              <li key={hornada._id} className="lote">
                <span className="producto-icono"><IconoProducto id={hornada.producto_id} /></span>
                <div>
                  <strong>{nombreDe(hornada.producto_id)}</strong>
                  <p>{hornada.unidades} unidades · {horaLocal(hornada.creado_en)}</p>
                </div>
                <span className={`estado ${CLASE_VENCIMIENTO[estado]}`}>
                  {ETIQUETA_VENCIMIENTO[estado]} · {fechaLegible(hornada.fecha_vencimiento)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FormularioHornada({
  productos,
  recetasCargadas,
  inventario,
  fecha,
  onRegistrada,
}: {
  productos: { id: string; nombre: string; precio_centavos: number; receta?: ProductoReceta['receta'] }[];
  recetasCargadas: boolean;
  inventario: Inventario | null;
  fecha: string;
  onRegistrada: (texto: string) => void;
}) {
  const [productoElegido, setProductoElegido] = useState<string | null>(null);
  const [unidades, setUnidades] = useState(0);
  const [hora, setHora] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const [autorizacion, setAutorizacion] = useState<string | null>(null);
  const [faltanteServidor, setFaltanteServidor] =
    useState<{ clave: string; inventario: Inventario | null } | null>(null);
  const [reintento, setReintento] = useState<string | null>(null);
  const intento = useRef<{ clave: string; solicitud: SolicitudHornada } | null>(null);

  // Sin selección explícita se usa el primer producto del catálogo.
  const productoId = productos.some((item) => item.id === productoElegido)
    ? productoElegido ?? '' : productos[0]?.id ?? '';
  const producto = productos.find((item) => item.id === productoId);
  const claveHornada = JSON.stringify([productoId, unidades, hora, fecha]);
  const necesidades = producto?.receta?.map((item) => ({
    sku: item.sku,
    requerido: item.millonesimas * unidades,
    saldo: inventario?.[item.sku]?.saldo_millonesimas ?? 0,
  })) ?? [];
  const esReintento = reintento === claveHornada;
  const faltanSegunServidor = faltanteServidor?.clave === claveHornada && faltanteServidor.inventario === inventario;
  const faltantes = unidades > 0 && (faltanSegunServidor ||
    (inventario !== null && necesidades.some((item) => item.saldo < item.requerido)));
  const permiteFaltantes = faltantes && autorizacion === claveHornada;
  const puedeGuardar =
    Boolean(producto) && (esReintento ||
      ((!recetasCargadas || necesidades.length > 0) && (!faltantes || permiteFaltantes))) &&
    unidades > 0 && unidades <= 100_000 &&
    (hora === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) && !guardando;

  const registrar = async () => {
    if (!producto || !puedeGuardar) {
      return;
    }

    setGuardando(true);
    setError('');

    try {
      const claveIntento = JSON.stringify([claveHornada, permiteFaltantes]);
      const solicitud = intento.current && (esReintento || intento.current.clave === claveIntento)
        ? intento.current.solicitud : {
        operacion_id: ulid(),
        producto_id: producto.id,
        unidades,
        creado_local: hora ? new Date(`${fecha}T${hora}:00-06:00`).toISOString() : creadoAhora(),
        ...(permiteFaltantes ? { permitir_faltantes: true } : {}),
      };
      intento.current = { clave: claveIntento, solicitud };
      await registrarHornada(solicitud);
      intento.current = null;
      setAutorizacion(null);
      setFaltanteServidor(null);
      setReintento(null);

      setUnidades(0);
      setHora('');
      onRegistrada(
        `Hornada registrada: ${unidades} × ${producto.nombre}.`,
      );
    } catch (fallo) {
      if (fallo instanceof ErrorApi && fallo.estado >= 400 && fallo.estado < 500) {
        intento.current = null;
        setReintento(null);
        if (fallo.codigo === 'materiales_insuficientes') {
          setFaltanteServidor({ clave: claveHornada, inventario });
        }
      } else {
        setReintento(claveHornada);
      }
      setError(mensajeDe(fallo));
      notificar(mensajeDe(fallo), 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <aside
      className="panel panel--lateral panel--miel"
      aria-labelledby="nueva-hornada-titulo"
    >
      <header className="panel__cabecera">
        <div>
          <h2 id="nueva-hornada-titulo" tabIndex={-1}>Nueva hornada</h2>
          <p className="nota">Registra lo que acaba de salir del horno.</p>
        </div>
        <Icono nombre="produccion" />
      </header>

      <div className="panel__cuerpo formulario">
        {productos.length === 0 ? (
          <p className="nota">
            No hay productos en el catálogo local. Revisa la conexión.
          </p>
        ) : (
          <>
            <div>
              <p className="kpi__etiqueta">Producto</p>
              <div className="selector-productos">
                {productos.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`seleccion-producto ${item.id === productoId ? 'activa' : ''}`}
                    aria-pressed={item.id === productoId}
                    onClick={() => setProductoElegido(item.id)}
                  >
                    <IconoProducto id={item.id} />
                    {item.nombre}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="kpi__etiqueta">Unidades</p>
              <div style={{ marginTop: 8 }}>
                <Contador
                  valor={unidades}
                  onCambio={setUnidades}
                  max={100_000}
                  etiqueta="Unidades de la hornada"
                />
              </div>
            </div>

            <div className="pildanas" aria-label="Sumar unidades">
              {[6, 12, 24].map((cantidad) => (
                <button type="button" key={cantidad} className="pildana"
                  onClick={() => setUnidades((actual) => Math.min(100_000, actual + cantidad))}>+{cantidad}</button>
              ))}
            </div>
            <label className="campo">
              <span>Hora de la hornada (El Salvador)</span>
              <input type="time" className="selector" value={hora} onChange={(e) => setHora(e.target.value)} />
              {!hora && <small>Si dejas la hora en blanco, se usará la hora del registro.</small>}
            </label>
            <p className="resumen-hornada" aria-live="polite">
              {producto ? `${unidades} unidades de ${producto.nombre} · ${fechaLegible(fecha)} · ${hora || 'hora del registro'}`
                : 'Elige un producto para continuar.'}
            </p>

            {producto && recetasCargadas && necesidades.length === 0 && (
              <p className="aviso aviso--auth">Configura la receta de este producto en Recetas.</p>
            )}
            {unidades > 0 && necesidades.length > 0 && inventario !== null && (
              <ul aria-label="Materiales necesarios">
                {necesidades.map(({ sku, requerido, saldo }) => (
                  <li key={sku}>{sku}: {cantidadMaterial(requerido)} requeridas, {cantidadMaterial(saldo)} disponibles</li>
                ))}
              </ul>
            )}
            {faltantes && !esReintento && <label className="campo">
              <span><input type="checkbox" checked={permiteFaltantes} disabled={guardando}
                onChange={(evento) => setAutorizacion(evento.target.checked ? claveHornada : null)} />
                Registrar con faltantes y dejar el material pendiente</span>
            </label>}
            {error && (
              <p className="aviso aviso--auth" role="alert">
                <Icono nombre="alerta" />
                {error}
              </p>
            )}

            <button
              type="button"
              className="boton boton--principal"
              disabled={!puedeGuardar}
              onClick={() => void registrar()}
            >
              <Icono nombre="mas" />
              {guardando ? 'Registrando…' : esReintento ? 'Reintentar la misma hornada' : 'Registrar hornada'}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Merma
// ─────────────────────────────────────────────────────────────────────────────

function PanelMerma({
  cargando,
  descartes,
  nombreDe,
}: {
  cargando: boolean;
  descartes: DescarteApi[];
  nombreDe: (id: string) => string;
}) {
  const total = descartes.reduce((suma, descarte) => suma + descarte.unidades, 0);

  return (
    <section className="panel" aria-labelledby="merma-titulo">
      <header className="panel__cabecera">
        <div>
          <h2 id="merma-titulo">Merma de hoy</h2>
          <p className="nota">
            Unidades retiradas de un lote. El cierre vuelve a pedir el total del
            día.
          </p>
        </div>
        <span className="chip">{total} unidades</span>
      </header>

      {cargando ? (
        <Esqueleto texto="Cargando descartes…" />
      ) : descartes.length === 0 ? (
        <div className="vacio">
          <span className="vacio__icono">
            <Icono nombre="check" />
          </span>
          <strong>Sin merma registrada</strong>
          <a className="boton boton--fantasma" href="#registrar-merma-titulo">Registrar merma</a>
        </div>
      ) : (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Motivo</th>
                <th scope="col" className="tabla__num">
                  Unidades
                </th>
                <th scope="col">Hora</th>
              </tr>
            </thead>
            <tbody>
              {descartes.map((descarte) => (
                <tr key={descarte._id}>
                  <td>
                    <span className="tabla__producto">
                      <IconoProducto id={descarte.producto_id} />
                      <span>{nombreDe(descarte.producto_id)}</span>
                    </span>
                  </td>
                  <td>{ETIQUETA_MOTIVO[descarte.motivo] ?? descarte.motivo}</td>
                  <td className="tabla__num tabla__fuerte">
                    {descarte.unidades}
                  </td>
                  <td>{horaLocal(descarte.creado_en)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FormularioMerma({
  fecha,
  hornadas,
  descartes,
  nombreDe,
  onRegistrada,
}: {
  fecha: string;
  hornadas: HornadaApi[];
  descartes: DescarteApi[];
  nombreDe: (id: string) => string;
  onRegistrada: (texto: string) => void;
}) {
  const [loteElegido, setLoteElegido] = useState<string | null>(null);
  const [unidades, setUnidades] = useState(1);
  const [motivo, setMotivo] = useState<MotivoDescarte>('danado');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Sin selección explícita se usa el lote más reciente del día.
  const loteId = loteElegido ?? hornadas[0]?._id ?? '';
  const lote = hornadas.find((item) => item._id === loteId);
  const yaDescartado = useMemo(
    () =>
      descartes
        .filter((descarte) => descarte.lote_id === loteId)
        .reduce((suma, descarte) => suma + descarte.unidades, 0),
    [descartes, loteId],
  );
  const restantes = lote ? lote.unidades - yaDescartado : 0;
  const puedeGuardar =
    Boolean(lote) && unidades > 0 && unidades <= restantes && !guardando;

  const registrar = async () => {
    if (!lote || !puedeGuardar) {
      return;
    }

    setGuardando(true);
    setError('');

    try {
      await registrarDescarte({
        fecha,
        lote_id: lote._id,
        producto_id: lote.producto_id,
        unidades,
        motivo,
        creado_en: creadoAhora(),
      });

      setUnidades(1);
      onRegistrada(
        `Merma registrada: ${unidades} × ${nombreDe(lote.producto_id)}.`,
      );
    } catch (fallo) {
      setError(mensajeDe(fallo));
      notificar(mensajeDe(fallo), 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <aside
      className="panel panel--lateral panel--miel"
      aria-labelledby="registrar-merma-titulo"
    >
      <header className="panel__cabecera">
        <div>
          <h2 id="registrar-merma-titulo" tabIndex={-1}>Registrar merma</h2>
          <p className="nota">Solo sobre lotes de hoy.</p>
        </div>
        <Icono nombre="alerta" />
      </header>

      <div className="panel__cuerpo formulario">
        {hornadas.length === 0 ? (
          <p className="nota">
            Primero registra una hornada: la merma se descuenta de un lote.
          </p>
        ) : (
          <>
            <label className="campo">
              <span>Lote</span>
              <select
                className="selector"
                value={loteId}
                onChange={(evento) => setLoteElegido(evento.target.value)}
              >
                {hornadas.map((item) => (
                  <option key={item._id} value={item._id}>
                    {nombreDe(item.producto_id)} · {item.unidades} u. ·{' '}
                    {horaLocal(item.creado_en)}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="kpi__etiqueta">Motivo</p>
              <div className="pildanas" style={{ marginTop: 8 }}>
                {(['danado', 'vencido'] as const).map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    className={`pildana ${motivo === valor ? 'activa' : ''}`}
                    aria-pressed={motivo === valor}
                    onClick={() => setMotivo(valor)}
                  >
                    {ETIQUETA_MOTIVO[valor]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="kpi__etiqueta">Unidades</p>
              <div style={{ marginTop: 8 }}>
                <Contador
                  valor={unidades}
                  onCambio={setUnidades}
                  max={Math.max(restantes, 1)}
                  etiqueta="Unidades descartadas"
                />
              </div>
              <p className="nota" style={{ marginTop: 6 }}>
                {lote
                  ? `Quedan ${restantes} de ${lote.unidades} unidades en el lote.`
                  : ''}
              </p>
            </div>

            {unidades > restantes && restantes >= 0 && (
              <p className="aviso aviso--advertencia" role="alert">
                <Icono nombre="alerta" />
                No puedes descartar más de las unidades disponibles.
              </p>
            )}

            {error && (
              <p className="aviso aviso--auth" role="alert">
                <Icono nombre="alerta" />
                {error}
              </p>
            )}

            <button
              type="button"
              className="boton boton--principal"
              disabled={!puedeGuardar}
              onClick={() => void registrar()}
            >
              <Icono nombre="menos" />
              {guardando ? 'Registrando…' : 'Registrar merma'}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vencimientos
// ─────────────────────────────────────────────────────────────────────────────

function PanelVencimientos({
  cargando,
  reporte,
  nombreDe,
  onHornadas,
  onRecargar,
}: {
  cargando: boolean;
  reporte: ReporteVencimientosApi | null;
  nombreDe: (id: string) => string;
  onHornadas: () => void;
  onRecargar: () => void;
}) {
  if (cargando) {
    return (
      <section className="panel">
        <Esqueleto texto="Calculando vencimientos…" />
      </section>
    );
  }

  if (!reporte) {
    return (
      <section className="panel">
        <div className="vacio">
          <span className="vacio__icono">
            <Icono nombre="alerta" />
          </span>
          <strong>No se pudo leer el reporte</strong>
          <button type="button" className="boton boton--fantasma" onClick={onRecargar}>Reintentar</button>
        </div>
      </section>
    );
  }

  const resumen = reporte.resumen;

  return (
    <section className="panel panel--verde" aria-labelledby="vencimientos-titulo">
      <header className="panel__cabecera">
        <div>
          <h2 id="vencimientos-titulo">Vencimientos por lote</h2>
          <p className="nota">
            Calculado el {horaLocal(reporte.actualizado_en)} · los lotes
            vencidos deben descartarse como merma.
          </p>
        </div>
      </header>

      <div className="panel__cuerpo" style={{ display: 'grid', gap: 20 }}>
        <div className="kpis">
          <TarjetaKpi
            clase="kpi--rojo"
            etiqueta="Vencidos"
            valor={resumen.vencido}
            nota="Retirar del mostrador"
          />
          <TarjetaKpi
            clase="kpi--miel"
            etiqueta="Vencen hoy"
            valor={resumen.vence_hoy}
            nota="Vender primero"
          />
          <TarjetaKpi
            clase="kpi--verde"
            etiqueta="Por vencer"
            valor={resumen.por_vencer}
            nota="Próximos días"
          />
          <TarjetaKpi
            clase="kpi--verde"
            etiqueta="Vigentes"
            valor={resumen.vigente}
            nota="Sin riesgo"
          />
        </div>

        {reporte.lotes.length === 0 ? (
          <div className="vacio">
            <span className="vacio__icono">
              <Icono nombre="check" />
            </span>
            <strong>No hay lotes activos</strong>
            <button type="button" className="boton boton--fantasma" onClick={onHornadas}>Ver hornadas</button>
          </div>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col" className="tabla__num">
                    Unidades
                  </th>
                  <th scope="col">Vence</th>
                  <th scope="col" className="tabla__num">
                    Días
                  </th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {reporte.lotes.map((lote) => (
                  <FilaVencimiento
                    key={lote.lote_id}
                    lote={lote}
                    nombre={nombreDe(lote.producto_id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function FilaVencimiento({
  lote,
  nombre,
}: {
  lote: LoteVencimientoApi;
  nombre: string;
}) {
  return (
    <tr>
      <td>
        <span className="tabla__producto">
          <IconoProducto id={lote.producto_id} />
          <span>{nombre}</span>
        </span>
      </td>
      <td className="tabla__num tabla__fuerte">{lote.unidades}</td>
      <td>{fechaLegible(lote.fecha_vencimiento)}</td>
      <td
        className={`tabla__num ${lote.dias_restantes < 0 ? 'tabla__negativo' : ''}`}
      >
        {lote.dias_restantes}
      </td>
      <td>
        <span className={`estado ${CLASE_VENCIMIENTO[lote.estado]}`}>
          {ETIQUETA_VENCIMIENTO[lote.estado]}
        </span>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Piezas pequeñas
// ─────────────────────────────────────────────────────────────────────────────

function TarjetaKpi({
  clase,
  etiqueta,
  valor,
  nota,
}: {
  clase: string;
  etiqueta: string;
  valor: number;
  nota: string;
}) {
  return (
    <div className={`kpi ${clase}`}>
      <span className="kpi__etiqueta">{etiqueta}</span>
      <strong className="kpi__valor">{valor}</strong>
      <span className="kpi__nota">{nota}</span>
    </div>
  );
}

function Contador({
  valor,
  onCambio,
  max,
  etiqueta,
}: {
  valor: number;
  onCambio: (valor: number) => void;
  max: number;
  etiqueta: string;
}) {
  const limitar = (numero: number) => Math.min(Math.max(numero, 0), max);

  return (
    <div className="contador">
      <button
        type="button"
        aria-label={`Quitar una unidad a ${etiqueta}`}
        disabled={valor <= 0}
        onClick={() => onCambio(limitar(valor - 1))}
      >
        <Icono nombre="menos" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={valor}
        aria-label={etiqueta}
        onChange={(evento) => {
          const numero = Number.parseInt(evento.target.value, 10);
          onCambio(limitar(Number.isNaN(numero) ? 0 : numero));
        }}
      />
      <button
        type="button"
        aria-label={`Añadir una unidad a ${etiqueta}`}
        disabled={valor >= max}
        onClick={() => onCambio(limitar(valor + 1))}
      >
        <Icono nombre="mas" />
      </button>
    </div>
  );
}

/** Estado de un lote según su fecha de vencimiento y el día de negocio. */
function estadoDeVencimiento(
  fechaVencimiento: string,
  hoy: string,
): EstadoVencimiento {
  if (fechaVencimiento < hoy) {
    return 'vencido';
  }

  if (fechaVencimiento === hoy) {
    return 'vence_hoy';
  }

  if (fechaVencimiento <= sumarDias(hoy, 1)) {
    return 'por_vencer';
  }

  return 'vigente';
}
