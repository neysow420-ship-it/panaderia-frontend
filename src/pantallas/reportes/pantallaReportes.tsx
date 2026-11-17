import { useEffect, useMemo, useState } from 'react';
import { ErrorApi } from '../../api/cliente';
import {
  reporteMerma,
  reporteVentas,
  type ReporteMermaApi,
  type ReporteVentasApi,
} from '../../api/panaderia';
import { Icono, IconoProducto } from '../../componentes/iconos';
import { formatearDinero } from '../../modelos/dinero';
import {
  fechaHoy,
  fechaLegible,
  inicioDeMes,
  sumarDias,
} from '../../modelos/fecha';
import { useCatalogo } from '../comunes/useCatalogo';
import '../comunes/encargado.css';

type Pestana = 'ventas' | 'merma';
type Rango = 'hoy' | 'semana' | 'mes' | 'personalizado';

const ETIQUETA_RANGO: Record<Rango, string> = {
  hoy: 'Hoy',
  semana: '7 días',
  mes: 'Este mes',
  personalizado: 'Personalizado',
};

function mensajeDe(error: unknown): string {
  if (error instanceof ErrorApi) {
    return error.message;
  }

  return 'No se pudieron cargar los reportes.';
}

export default function PantallaReportes() {
  const { nombreDe } = useCatalogo();
  const [hoy] = useState(() => fechaHoy());
  const [pestana, setPestana] = useState<Pestana>('ventas');
  const [rango, setRango] = useState<Rango>('semana');
  const [desde, setDesde] = useState(() => sumarDias(fechaHoy(), -6));
  const [hasta, setHasta] = useState(() => fechaHoy());
  const [ventas, setVentas] = useState<ReporteVentasApi | null>(null);
  const [merma, setMerma] = useState<ReporteMermaApi | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const rangoValido = desde <= hasta;

  const elegirRango = (nuevo: Rango) => {
    setRango(nuevo);
    setCargando(true);
    setError('');

    if (nuevo === 'hoy') {
      setDesde(hoy);
      setHasta(hoy);
    } else if (nuevo === 'semana') {
      setDesde(sumarDias(hoy, -6));
      setHasta(hoy);
    } else if (nuevo === 'mes') {
      setDesde(inicioDeMes(hoy));
      setHasta(hoy);
    }
  };

  useEffect(() => {
    if (!rangoValido) {
      return;
    }

    let activo = true;

    void Promise.allSettled([
      reporteVentas(desde, hasta),
      reporteMerma(desde, hasta),
    ]).then(([datosVentas, datosMerma]) => {
      if (!activo) {
        return;
      }

      const fallos: string[] = [];

      if (datosVentas.status === 'fulfilled') {
        setVentas(datosVentas.value);
      } else {
        fallos.push(mensajeDe(datosVentas.reason));
      }

      if (datosMerma.status === 'fulfilled') {
        setMerma(datosMerma.value);
      } else {
        fallos.push(mensajeDe(datosMerma.reason));
      }

      setError(fallos[0] ?? '');
      setCargando(false);
    });

    return () => {
      activo = false;
    };
  }, [desde, hasta, rangoValido]);

  const ventasPorDia = useMemo(() => {
    const dias = ventas?.dias ?? [];

    return dias.map((dia) => ({
      fecha: dia.fecha,
      valor: dia.por_producto.reduce(
        (total, producto) => total + producto.total_centavos,
        0,
      ),
    }));
  }, [ventas]);

  const mermaPorDia = useMemo(
    () =>
      (merma?.dias ?? []).map((dia) => ({
        fecha: dia.fecha,
        valor: dia.total_merma_centavos,
      })),
    [merma],
  );

  const productosVendidos = useMemo(() => {
    const mapa = new Map<
      string,
      { producto_id: string; unidades: number; total_centavos: number }
    >();

    for (const dia of ventas?.dias ?? []) {
      for (const producto of dia.por_producto) {
        const actual = mapa.get(producto.producto_id) ?? {
          producto_id: producto.producto_id,
          unidades: 0,
          total_centavos: 0,
        };

        actual.unidades += producto.unidades;
        actual.total_centavos += producto.total_centavos;
        mapa.set(producto.producto_id, actual);
      }
    }

    return [...mapa.values()].sort(
      (a, b) => b.total_centavos - a.total_centavos,
    );
  }, [ventas]);

  const productosConMerma = useMemo(() => {
    const mapa = new Map<
      string,
      {
        producto_id: string;
        producidas: number;
        vendidas: number;
        descartadas: number;
        merma_centavos: number;
      }
    >();

    for (const dia of merma?.dias ?? []) {
      for (const producto of dia.por_producto) {
        const actual = mapa.get(producto.producto_id) ?? {
          producto_id: producto.producto_id,
          producidas: 0,
          vendidas: 0,
          descartadas: 0,
          merma_centavos: 0,
        };

        actual.producidas += producto.producidas;
        actual.vendidas += producto.vendidas;
        actual.descartadas += producto.descartadas;
        actual.merma_centavos += producto.merma_centavos;
        mapa.set(producto.producto_id, actual);
      }
    }

    return [...mapa.values()]
      .filter((fila) => fila.descartadas > 0)
      .sort((a, b) => b.merma_centavos - a.merma_centavos);
  }, [merma]);

  const unidadesVendidas = useMemo(
    () =>
      (ventas?.dias ?? []).reduce(
        (total, dia) =>
          total +
          dia.por_producto.reduce(
            (suma, producto) => suma + producto.unidades,
            0,
          ),
        0,
      ),
    [ventas],
  );

  const diasCerrados = (merma?.dias ?? []).filter((dia) => dia.cerrado).length;
  const descartadas = productosConMerma.reduce(
    (total, fila) => total + fila.descartadas,
    0,
  );
  const diasConVentas = ventasPorDia.filter((dia) => dia.valor > 0).length;

  return (
    <main className="encargado">
      <header className="encargado__cabecera">
        <div className="encargado__titulo">
          <p className="encargado__fecha">
            <Icono nombre="reportes" />
            {fechaLegible(desde)} — {fechaLegible(hasta)}
          </p>
          <h1>Reportes</h1>
        </div>

        <div className="encargado__acciones">
          <div className="segmentado" role="tablist" aria-label="Tipo de reporte">
            {(
              [
                ['ventas', 'Ventas'],
                ['merma', 'Merma'],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={pestana === valor}
                className={pestana === valor ? 'activo' : ''}
                onClick={() => setPestana(valor)}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="encargado__acciones">
        <div className="segmentado" aria-label="Rango de fechas">
          {(Object.keys(ETIQUETA_RANGO) as Rango[])
            .filter((valor) => valor !== 'personalizado')
            .map((valor) => (
              <button
                key={valor}
                type="button"
                className={rango === valor ? 'activo' : ''}
                aria-pressed={rango === valor}
                onClick={() => elegirRango(valor)}
              >
                {ETIQUETA_RANGO[valor]}
              </button>
            ))}
        </div>

        <label className="campo campo--en-linea">
          <span>Desde</span>
          <input
            className="entrada-fecha"
            type="date"
            value={desde}
            max={hasta}
            onChange={(evento) => {
              setDesde(evento.target.value);
              setRango('personalizado');
              setCargando(true);
              setError('');
            }}
          />
        </label>

        <label className="campo campo--en-linea">
          <span>Hasta</span>
          <input
            className="entrada-fecha"
            type="date"
            value={hasta}
            min={desde}
            max={hoy}
            onChange={(evento) => {
              setHasta(evento.target.value);
              setRango('personalizado');
              setCargando(true);
              setError('');
            }}
          />
        </label>
      </div>

      {!rangoValido && (
        <p className="aviso aviso--advertencia" role="alert">
          <Icono nombre="alerta" />
          La fecha inicial no puede ser posterior a la final.
        </p>
      )}

      {error && (
        <p className="aviso aviso--auth" role="alert">
          <Icono nombre="alerta" />
          {error}
        </p>
      )}

      {!rangoValido ? null : cargando ? (
        <section className="panel">
          <p className="cargando">
            <Icono nombre="reloj" /> Calculando reportes…
          </p>
        </section>
      ) : pestana === 'ventas' ? (
        <>
          <section className="kpis" aria-label="Resumen de ventas">
            <TarjetaKpi
              clase="kpi--acento"
              etiqueta="Vendido"
              valor={formatearDinero(ventas?.total_centavos ?? 0)}
              nota={`${diasConVentas} de ${ventasPorDia.length} días con ventas`}
            />
            <TarjetaKpi
              clase="kpi--miel"
              etiqueta="Unidades"
              valor={String(unidadesVendidas)}
              nota="Piezas vendidas en el rango"
            />
            <TarjetaKpi
              clase="kpi--verde"
              etiqueta="Promedio diario"
              valor={formatearDinero(
                diasConVentas === 0
                  ? 0
                  : Math.round(
                      (ventas?.total_centavos ?? 0) / diasConVentas,
                    ),
              )}
              nota="Solo días con ventas"
            />
            <TarjetaKpi
              clase="kpi--verde"
              etiqueta="Productos"
              valor={String(productosVendidos.length)}
              nota="Con movimiento en el rango"
            />
          </section>

          <section className="panel" aria-labelledby="ventas-por-dia">
            <header className="panel__cabecera">
              <div>
                <h2 id="ventas-por-dia">Ventas por día</h2>
                <p className="nota">
                  Importes oficiales del servidor, agrupados por día de negocio.
                </p>
              </div>
            </header>
            <div className="panel__cuerpo">
              <GraficoBarras
                filas={ventasPorDia.map((dia) => ({
                  etiqueta: fechaLegible(dia.fecha),
                  valor: dia.valor,
                  texto: formatearDinero(dia.valor),
                }))}
                vacio="No hay ventas en el rango elegido."
              />
            </div>
          </section>

          <section className="panel" aria-labelledby="ventas-por-producto">
            <header className="panel__cabecera">
              <div>
                <h2 id="ventas-por-producto">Ventas por producto</h2>
                <p className="nota">Ordenado por importe vendido.</p>
              </div>
            </header>

            {productosVendidos.length === 0 ? (
              <div className="vacio">
                <span className="vacio__icono">
                  <Icono nombre="reportes" />
                </span>
                <strong>Sin ventas registradas</strong>
                <p>Prueba con otro rango de fechas.</p>
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
                      <th scope="col" className="tabla__num">
                        Importe
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosVendidos.map((producto) => (
                      <tr key={producto.producto_id}>
                        <td>
                          <span className="tabla__producto">
                            <IconoProducto id={producto.producto_id} />
                            <span>{nombreDe(producto.producto_id)}</span>
                          </span>
                        </td>
                        <td className="tabla__num">{producto.unidades}</td>
                        <td className="tabla__num tabla__fuerte">
                          {formatearDinero(producto.total_centavos)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="kpis" aria-label="Resumen de merma">
            <TarjetaKpi
              clase="kpi--rojo"
              etiqueta="Merma"
              valor={formatearDinero(merma?.total_merma_centavos ?? 0)}
              nota="Costo de lo descartado"
            />
            <TarjetaKpi
              clase="kpi--miel"
              etiqueta="Descartadas"
              valor={String(descartadas)}
              nota="Unidades retiradas"
            />
            <TarjetaKpi
              clase="kpi--verde"
              etiqueta="Días cerrados"
              valor={String(diasCerrados)}
              nota={`De ${merma?.dias.length ?? 0} días en el rango`}
            />
            <TarjetaKpi
              clase="kpi--verde"
              etiqueta="Promedio diario"
              valor={formatearDinero(
                diasCerrados === 0
                  ? 0
                  : Math.round(
                      (merma?.total_merma_centavos ?? 0) / diasCerrados,
                    ),
              )}
              nota="Solo días cerrados"
            />
          </section>

          <section className="panel panel--miel" aria-labelledby="merma-por-dia">
            <header className="panel__cabecera">
              <div>
                <h2 id="merma-por-dia">Merma por día</h2>
                <p className="nota">
                  Solo los días cerrados tienen merma calculada.
                </p>
              </div>
            </header>
            <div className="panel__cuerpo">
              <GraficoBarras
                variante="merma"
                filas={mermaPorDia.map((dia) => ({
                  etiqueta: fechaLegible(dia.fecha),
                  valor: dia.valor,
                  texto: formatearDinero(dia.valor),
                }))}
                vacio="No hay cierres en el rango elegido."
              />
            </div>
          </section>

          <section className="panel" aria-labelledby="merma-por-producto">
            <header className="panel__cabecera">
              <div>
                <h2 id="merma-por-producto">Merma por producto</h2>
                <p className="nota">
                  Compara lo producido, lo vendido y lo descartado.
                </p>
              </div>
            </header>

            {productosConMerma.length === 0 ? (
              <div className="vacio">
                <span className="vacio__icono">
                  <Icono nombre="check" />
                </span>
                <strong>Sin merma en el rango</strong>
                <p>Los días cerrados no registraron descartes.</p>
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
                        Merma
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosConMerma.map((producto) => (
                      <tr key={producto.producto_id}>
                        <td>
                          <span className="tabla__producto">
                            <IconoProducto id={producto.producto_id} />
                            <span>{nombreDe(producto.producto_id)}</span>
                          </span>
                        </td>
                        <td className="tabla__num">{producto.producidas}</td>
                        <td className="tabla__num">{producto.vendidas}</td>
                        <td className="tabla__num">
                          {producto.descartadas}
                        </td>
                        <td className="tabla__num tabla__negativo">
                          {formatearDinero(producto.merma_centavos)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

interface FilaBarra {
  etiqueta: string;
  valor: number;
  texto: string;
}

function GraficoBarras({
  filas,
  vacio,
  variante,
}: {
  filas: FilaBarra[];
  vacio: string;
  variante?: 'merma';
}) {
  const maximo = Math.max(...filas.map((fila) => fila.valor), 1);
  const total = filas.reduce((suma, fila) => suma + fila.valor, 0);

  if (filas.length === 0 || total === 0) {
    return (
      <div className="vacio">
        <span className="vacio__icono">
          <Icono nombre="reportes" />
        </span>
        <strong>Sin datos</strong>
        <p>{vacio}</p>
      </div>
    );
  }

  return (
    <div className="barras">
      {filas.map((fila) => (
        <div className="barras__fila" key={fila.etiqueta}>
          <span className="barras__etiqueta">{fila.etiqueta}</span>
          <span
            className="barras__pista"
            role="img"
            aria-label={`${fila.etiqueta}: ${fila.texto}`}
          >
            <span
              className={`barras__barra ${variante === 'merma' ? 'barras__barra--merma' : ''}`}
              style={{
                width: `${Math.max((fila.valor / maximo) * 100, 1)}%`,
              }}
            />
          </span>
          <span className="barras__valor">{fila.texto}</span>
        </div>
      ))}
    </div>
  );
}

function TarjetaKpi({
  clase,
  etiqueta,
  valor,
  nota,
}: {
  clase: string;
  etiqueta: string;
  valor: string;
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
