import { Esqueleto } from '../../componentes/retroalimentacion';
import { notificar } from '../../componentes/notificaciones';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorApi } from '../../api/cliente';
import {
  cerrarDia,
  estadoCierre,
  listarDescartes,
  type CierreApi,
  type EstadoCierreApi,
} from '../../api/panaderia';
import { Icono, IconoProducto } from '../../componentes/iconos';
import { formatearDinero } from '../../modelos/dinero';
import {
  fechaHoy,
  fechaLarga,
  fechaLegible,
  horaLocal,
} from '../../modelos/fecha';
import { useCatalogo } from '../comunes/useCatalogo';
import '../comunes/encargado.css';

interface FilaCierre {
  producto_id: string;
  producidas: number;
  vendidas: number;
  descartadas: number;
  diferencia: number;
  costo: number | null;
  merma: number;
}

function mensajeDe(error: unknown): string {
  if (error instanceof ErrorApi) {
    return error.message;
  }

  return 'No se pudo completar la operación.';
}

export default function PantallaCierre() {
  const { nombreDe } = useCatalogo();
  const [fecha] = useState(() => fechaHoy());
  const [estado, setEstado] = useState<EstadoCierreApi | null>(null);
  const [descartadas, setDescartadas] = useState<Record<string, number>>({});
  const [confirmo, setConfirmo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const bloqueo = useRef(false);
  const inicializado = useRef(false);

  // Estado del día + merma ya registrada (para precargar el formulario).
  useEffect(() => {
    let activo = true;

    void Promise.allSettled([estadoCierre(fecha), listarDescartes(fecha)]).then(
      ([dia, mermas]) => {
        if (!activo) {
          return;
        }

        if (dia.status === 'fulfilled') {
          setEstado(dia.value);
        } else {
          setError(mensajeDe(dia.reason));
        }

        if (!inicializado.current) {
          const inicial: Record<string, number> = {};

          if (mermas.status === 'fulfilled') {
            for (const descarte of mermas.value) {
              inicial[descarte.producto_id] =
                (inicial[descarte.producto_id] ?? 0) + descarte.unidades;
            }
          }

          setDescartadas(inicial);
          inicializado.current = true;
        }

        setCargando(false);
      },
    );

    return () => {
      activo = false;
    };
  }, [fecha, recarga]);

  const filas = useMemo<FilaCierre[]>(() => {
    if (!estado) {
      return [];
    }

    return estado.por_producto.map((producto) => {
      const unidades = Math.min(
        Math.max(descartadas[producto.producto_id] ?? 0, 0),
        100_000,
      );
      const diferencia =
        producto.producidas - producto.vendidas - unidades;
      const costo = producto.costo_unitario_centavos;

      return {
        producto_id: producto.producto_id,
        producidas: producto.producidas,
        vendidas: producto.vendidas,
        descartadas: unidades,
        diferencia,
        costo,
        merma: costo === null ? 0 : unidades * costo,
      };
    });
  }, [estado, descartadas]);

  const totalMerma = filas.reduce((total, fila) => total + fila.merma, 0);
  const totalDescartadas = filas.reduce(
    (total, fila) => total + fila.descartadas,
    0,
  );
  const hayDiferencia = filas.some((fila) => fila.diferencia > 0);
  const hayNegativa = filas.some((fila) => fila.diferencia < 0);
  const cerrado = Boolean(estado?.cerrado && estado.cierre);

  const puedeCerrar =
    !cerrado && !guardando &&
    filas.length > 0 &&
    !hayNegativa &&
    (!hayDiferencia || confirmo);

  const cerrar = async () => {
    if (!puedeCerrar || bloqueo.current) {
      return;
    }

    bloqueo.current = true;
    setGuardando(true);
    setError('');

    try {
      const respuesta = await cerrarDia({
        fecha,
        descartadas: filas
          .filter((fila) => fila.descartadas > 0)
          .map((fila) => ({
            producto_id: fila.producto_id,
            unidades: fila.descartadas,
          })),
        confirmo_diferencia: confirmo,
      });

      dialogo.current?.close();
      setEstado((actual) => ({
        fecha,
        cerrado: true,
        cierre: respuesta.cierre,
        por_producto: actual?.por_producto ?? [],
      }));
      titulo.current?.focus();
      notificar('Día cerrado. El resumen está disponible para consulta.');
    } catch (fallo) {
      dialogo.current?.close();
      setError(mensajeDe(fallo));
      notificar(mensajeDe(fallo), 'error');
    } finally {
      bloqueo.current = false;
      setGuardando(false);
    }
  };

  const resumen = estado?.cierre?.por_producto ?? filas;
  const indicadores = [
    ['Producidas', resumen.reduce((total, fila) => total + fila.producidas, 0)],
    ['Vendidas', resumen.reduce((total, fila) => total + fila.vendidas, 0)],
    ['Descartadas', resumen.reduce((total, fila) => total + fila.descartadas, 0)],
    [cerrado ? 'Merma oficial' : 'Merma estimada',
      formatearDinero(estado?.cierre?.total_merma_centavos ?? totalMerma)],
  ];
  const resumenDia = (
    <div className="kpis" aria-label="Resumen del día">
      {indicadores.map(([etiqueta, valor]) => (
        <div className="kpi kpi--acento" key={etiqueta}>
          <span className="kpi__etiqueta">{etiqueta}</span>
          <strong className="kpi__valor">{valor}</strong>
        </div>
      ))}
    </div>
  );

  return (
    <main className="encargado">
      <header className="encargado__cabecera">
        <div className="encargado__titulo">
          <p className="encargado__fecha">
            <Icono nombre="reloj" />
            {fechaLarga(fecha)}
          </p>
          <h1 ref={titulo} tabIndex={-1}>Cierre</h1>
        </div>

        <div className="encargado__acciones">
          <span className={`estado ${cerrado ? 'estado--cerrado' : 'estado--abierto'}`}>
            {cargando ? 'Consultando día' : cerrado ? 'Día cerrado' : estado ? 'Día abierto' : 'Estado sin confirmar'}
          </span>
          {cerrado && estado?.cierre && (
            <span className="chip">
              Responsable: {estado.cierre.responsable}
            </span>
          )}
        </div>
      </header>

      {error && (
        <p className="aviso aviso--auth" role="alert">
          <Icono nombre="alerta" />
          {error}
        </p>
      )}

      {!cargando && estado && resumenDia}

      {cargando ? (
        <section className="panel"><Esqueleto texto="Calculando el día…" /></section>
      ) : cerrado && estado?.cierre ? (
        <ResumenCerrado cierre={estado.cierre} nombreDe={nombreDe} />
      ) : (
        <section className="dos-columnas">
          <section className="panel" aria-labelledby="tabla-cierre-titulo">
            <header className="panel__cabecera">
              <div>
                <h2 id="tabla-cierre-titulo">Conteo del día</h2>
                <p className="nota">
                  Las descartadas se completan con la merma registrada en
                  Producción; puedes ajustarlas antes de cerrar.
                </p>
              </div>
            </header>

            {filas.length === 0 ? (
              <div className="vacio">
                <span className="vacio__icono">
                  <Icono nombre="hogaza" />
                </span>
                <strong>No hay datos para cerrar</strong>
                <p>Registra hornadas y ventas antes de cerrar el día.</p>
                <button type="button" className="boton boton--fantasma" onClick={() => {
                  setError('');
                  setCargando(true);
                  setRecarga((valor) => valor + 1);
                }}>Actualizar conteo</button>
              </div>
            ) : (
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col" className="tabla__num">
                        Producidas
                      </th>
                      <th scope="col" className="tabla__num">
                        Vendidas
                      </th>
                      <th scope="col" className="tabla__num">
                        Descartadas
                      </th>
                      <th scope="col" className="tabla__num">
                        Diferencia
                      </th>
                      <th scope="col" className="tabla__num">
                        Merma
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((fila) => (
                      <tr key={fila.producto_id} className={fila.diferencia ? 'fila-diferencia' : undefined}>
                        <td>
                          <span className="tabla__producto">
                            <IconoProducto id={fila.producto_id} />
                            <span>{nombreDe(fila.producto_id)}</span>
                          </span>
                        </td>
                        <td className="tabla__num">{fila.producidas}</td>
                        <td className="tabla__num">{fila.vendidas}</td>
                        <td className="tabla__num">
                          <input
                            className="entrada-numero"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100_000}
                            value={fila.descartadas}
                            aria-label={`Unidades descartadas de ${nombreDe(
                              fila.producto_id,
                            )}`}
                            onChange={(evento) => {
                              const numero = Number.parseInt(
                                evento.target.value,
                                10,
                              );

                              setDescartadas((actual) => ({
                                ...actual,
                                [fila.producto_id]: Number.isNaN(numero)
                                  ? 0
                                  : numero,
                              }));
                            }}
                          />
                        </td>
                        <td
                          className={`tabla__num ${
                            fila.diferencia !== 0 ? 'tabla__negativo' : 'tabla__cuadra'
                          }`}
                        >
                          {fila.diferencia}
                        </td>
                        <td className="tabla__num">
                          {fila.costo === null
                            ? 'Sin costo'
                            : formatearDinero(fila.merma)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="panel panel--lateral" aria-labelledby="confirmar-cierre">
            <header className="panel__cabecera">
              <div>
                <h2 id="confirmar-cierre">Cerrar el día</h2>
                <p className="nota">
                  El cierre es definitivo: guarda el conteo y calcula la merma.
                </p>
              </div>
              <Icono nombre="cierre" />
            </header>

            <div className="panel__cuerpo formulario">
              <div className="resumen-linea">
                <span>Unidades descartadas</span>
                <strong>{totalDescartadas}</strong>
              </div>
              <div className="resumen-linea">
                <span>Merma del día</span>
                <strong>{formatearDinero(totalMerma)}</strong>
              </div>

              {hayNegativa && (
                <p className="aviso aviso--auth" role="alert">
                  <Icono nombre="alerta" />
                  Hay productos donde lo vendido y descartado supera lo
                  producido. Corrige las unidades antes de cerrar.
                </p>
              )}

              {hayDiferencia && !hayNegativa && (
                <label className="casilla">
                  <input
                    type="checkbox"
                    checked={confirmo}
                    onChange={(evento) => setConfirmo(evento.target.checked)}
                  />
                  <span>
                    Confirmo las diferencias de inventario (lo producido que no
                    se vendió ni se descartó).
                  </span>
                </label>
              )}

              <button
                type="button"
                className="boton boton--principal"
                disabled={!puedeCerrar}
                onClick={() => dialogo.current?.showModal()}
              >
                <Icono nombre="cierre" />
                {guardando ? 'Cerrando…' : 'Confirmar cierre del día'}
              </button>

              <p className="nota">
                Un día cerrado no se puede reabrir. Las ventas tardías se
                asignan al siguiente día abierto.
              </p>
            </div>
          </aside>
        </section>
      )}
      <dialog ref={dialogo} className="dialogo-cierre" aria-labelledby="cierre-dialogo-titulo"
        aria-describedby="cierre-dialogo-aviso" onCancel={(evento) => { if (guardando) evento.preventDefault(); }}>
        <h2 id="cierre-dialogo-titulo">Confirmar cierre del día</h2>
        <p className="aviso aviso--advertencia" id="cierre-dialogo-aviso">
          <Icono nombre="alerta" /> Esta acción es irreversible. Las ventas tardías se asignarán al siguiente día abierto.
        </p>
        {resumenDia}
        <div className="pildanas">
          <button type="button" className="boton boton--fantasma" autoFocus disabled={guardando}
            onClick={() => dialogo.current?.close()}>Cancelar</button>
          <button type="button" className="boton boton--principal" disabled={!puedeCerrar}
            onClick={() => void cerrar()}>{guardando ? 'Cerrando…' : 'Cerrar definitivamente'}</button>
        </div>
      </dialog>
    </main>
  );
}

function ResumenCerrado({
  cierre,
  nombreDe,
}: {
  cierre: CierreApi;
  nombreDe: (id: string) => string;
}) {
  return (
    <section className="panel panel--verde" aria-labelledby="cierre-cerrado">
      <header className="panel__cabecera">
        <div>
          <h2 id="cierre-cerrado">Resumen del cierre</h2>
          <p className="nota">
            Cerrado el {fechaLegible(cierre.fecha)} a las{' '}
            {horaLocal(cierre.cerrado_en)} por {cierre.responsable} · modo{' '}
            {cierre.modo_produccion}.
          </p>
        </div>
        <span className="chip">
          Merma total: {formatearDinero(cierre.total_merma_centavos)}
        </span>
      </header>

      <div className="tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col" className="tabla__num">
                Producidas
              </th>
              <th scope="col" className="tabla__num">
                Vendidas
              </th>
              <th scope="col" className="tabla__num">
                Descartadas
              </th>
              <th scope="col" className="tabla__num">
                Diferencia
              </th>
              <th scope="col" className="tabla__num">
                Merma
              </th>
            </tr>
          </thead>
          <tbody>
            {cierre.por_producto.map((producto) => (
              <tr key={producto.producto_id} className={producto.diferencia ? 'fila-diferencia' : undefined}>
                <td>
                  <span className="tabla__producto">
                    <IconoProducto id={producto.producto_id} />
                    <span>{nombreDe(producto.producto_id)}</span>
                  </span>
                </td>
                <td className="tabla__num">{producto.producidas}</td>
                <td className="tabla__num">{producto.vendidas}</td>
                <td className="tabla__num">{producto.descartadas}</td>
                <td className={`tabla__num ${producto.diferencia ? 'tabla__negativo' : 'tabla__cuadra'}`}>
                  {producto.diferencia}
                </td>
                <td className="tabla__num">
                  {formatearDinero(producto.merma_centavos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
