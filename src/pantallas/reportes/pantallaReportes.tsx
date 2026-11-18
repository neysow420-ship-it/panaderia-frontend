import { navegarPestanas } from '../../componentes/pestanas';
import { Esqueleto } from '../../componentes/retroalimentacion';
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

const DIA_MS = 86_400_000;

function resumirVentas(datos: ReporteVentasApi) {
  const productos = datos.dias.flatMap((dia) => dia.por_producto);
  const dias = datos.dias.filter((dia) => dia.por_producto.some((producto) => producto.total_centavos > 0)).length;
  return {
    importe: datos.total_centavos,
    unidades: productos.reduce((total, producto) => total + producto.unidades, 0),
    promedio: dias ? Math.round(datos.total_centavos / dias) : 0,
    productos: new Set(productos.map((producto) => producto.producto_id)).size,
  };
}

function resumirMerma(datos: ReporteMermaApi) {
  const cerrados = datos.dias.filter((dia) => dia.cerrado).length;
  return {
    importe: datos.total_merma_centavos,
    descartadas: datos.dias.flatMap((dia) => dia.por_producto)
      .reduce((total, producto) => total + producto.descartadas, 0),
    cerrados,
    promedio: cerrados ? Math.round(datos.total_merma_centavos / cerrados) : 0,
  };
}

function descargarCsv(nombre: string, filas: (string | number)[][]) {
  const celda = (valor: string | number) => {
    const texto = String(valor);
    const seguro = typeof valor === 'string' && /^[\s]*[=+@-]|^[\t\r\n]/.test(texto) ? "'" + texto : texto;
    return '"' + seguro.replaceAll('"', '""') + '"';
  };
  const contenido = filas.map((fila) => fila.map(celda).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const [ventasAnteriores, setVentasAnteriores] = useState<ReporteVentasApi | null>(null);
  const [mermaAnterior, setMermaAnterior] = useState<ReporteMermaApi | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const rangoValido = /^\d{4}-\d{2}-\d{2}$/.test(desde) && /^\d{4}-\d{2}-\d{2}$/.test(hasta) && desde <= hasta && hasta <= hoy;

  const limpiarComparacion = () => {
    setVentasAnteriores(null);
    setMermaAnterior(null);
  };

  const elegirRango = (nuevo: Rango) => {
    setRango(nuevo);
    const inicio = nuevo === 'hoy' ? hoy : nuevo === 'semana' ? sumarDias(hoy, -6) : inicioDeMes(hoy);
    if (inicio === desde && hoy === hasta) return;
    setCargando(true);
    setError('');
    limpiarComparacion();
    setDesde(inicio);
    setHasta(hoy);
  };

  useEffect(() => {
    if (!rangoValido) {
      return;
    }

    let activo = true;

    const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / DIA_MS) + 1;
    const hastaAnterior = sumarDias(desde, -1);
    const desdeAnterior = sumarDias(desde, -dias);

    void Promise.allSettled([
      reporteVentas(desde, hasta),
      reporteMerma(desde, hasta),
    ]).then(([datosVentas, datosMerma]) => {
      if (!activo) return;
      setVentas(datosVentas.status === 'fulfilled' ? datosVentas.value : null);
      setMerma(datosMerma.status === 'fulfilled' ? datosMerma.value : null);
      const fallo = [datosVentas, datosMerma].find((resultado) => resultado.status === 'rejected');
      setError(fallo ? mensajeDe(fallo.reason) : '');
      setCargando(false);
    });

    void Promise.allSettled([
      reporteVentas(desdeAnterior, hastaAnterior),
      reporteMerma(desdeAnterior, hastaAnterior),
    ]).then(([ventasPrevias, mermaPrevia]) => {
      if (!activo) return;
      setVentasAnteriores(ventasPrevias.status === 'fulfilled' && ventasPrevias.value.desde === desdeAnterior ? ventasPrevias.value : null);
      setMermaAnterior(mermaPrevia.status === 'fulfilled' && mermaPrevia.value.desde === desdeAnterior ? mermaPrevia.value : null);
    });

    return () => {
      activo = false;
    };
  }, [desde, hasta, rangoValido, recarga]);

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

  const diasCerrados = (merma?.dias ?? []).filter((dia) => dia.cerrado).length;
  const descartadas = productosConMerma.reduce((total, fila) => total + fila.descartadas, 0);
  const diasConVentas = ventasPorDia.filter((dia) => dia.valor > 0).length;
  const totalDias = rangoValido ? Math.round((Date.parse(hasta) - Date.parse(desde)) / DIA_MS) + 1 : 0;
  const ventasPrevias = ventasAnteriores && resumirVentas(ventasAnteriores);
  const mermaPrevia = mermaAnterior && resumirMerma(mermaAnterior);
  const importeVentas = ventas?.total_centavos ?? 0;
  const importeMerma = merma?.total_merma_centavos ?? 0;
  const unidadesVendidas = productosVendidos.reduce((total, fila) => total + fila.unidades, 0);
  const promedioVentas = diasConVentas ? Math.round(importeVentas / diasConVentas) : 0;
  const promedioMerma = diasCerrados ? Math.round(importeMerma / diasCerrados) : 0;
  const estrella = productosVendidos[0];

  function exportar() {
    if (pestana === 'ventas' && ventas) {
      descargarCsv(`ventas-${desde}-${hasta}.csv`, [
        ['Fecha', 'Producto', 'Unidades', 'Importe (USD)'],
        ...ventas.dias.flatMap((dia) => dia.por_producto.map((producto) => [
          dia.fecha, nombreDe(producto.producto_id), producto.unidades, (producto.total_centavos / 100).toFixed(2),
        ])),
      ]);
    } else if (pestana === 'merma' && merma) {
      descargarCsv(`merma-${desde}-${hasta}.csv`, [
        ['Fecha', 'Producto', 'Producidas', 'Vendidas', 'Descartadas', 'Merma (USD)'],
        ...merma.dias.flatMap((dia) => dia.por_producto.map((producto) => [
          dia.fecha, nombreDe(producto.producto_id), producto.producidas, producto.vendidas,
          producto.descartadas, (producto.merma_centavos / 100).toFixed(2),
        ])),
      ]);
    }
  }

  function reintentar() {
    setCargando(true);
    setError('');
    limpiarComparacion();
    setRecarga((valor) => valor + 1);
  }

  function llenarDias(datos: { fecha: string; valor: number }[]) {
    const porFecha = new Map(datos.map(({ fecha, valor }) => [fecha, valor]));
    return Array.from({ length: totalDias }, (_, indice) => {
      const fecha = sumarDias(desde, indice);
      return { fecha, valor: porFecha.get(fecha) ?? 0 };
    });
  }

  return (
    <main className="encargado">
      <header className="encargado__cabecera">
        <div className="encargado__titulo">
          <p className="encargado__fecha">
            <Icono nombre="reportes" />
            {rangoValido ? `${fechaLegible(desde)} — ${fechaLegible(hasta)}` : 'Rango de fechas'}
          </p>
          <h1>Reportes</h1>
        </div>

        <div className="encargado__acciones">
          <div className="segmentado" role="tablist" onKeyDown={navegarPestanas} aria-label="Tipo de reporte">
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
                tabIndex={pestana === valor ? 0 : -1}
                id={`reportes-tab-${valor}`}
                aria-controls="reportes-contenido"
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
              limpiarComparacion();
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
              limpiarComparacion();
              setRango('personalizado');
              setCargando(true);
              setError('');
            }}
          />
        </label>
        <button type="button" className="boton boton--principal"
          disabled={!rangoValido || cargando || !(pestana === 'ventas' ? ventas : merma)}
          onClick={exportar}>Exportar CSV</button>
      </div>

      {!rangoValido && (
        <p className="aviso aviso--advertencia" role="alert">
          <Icono nombre="alerta" />
          Selecciona un rango válido con fecha final hasta hoy.
        </p>
      )}

      {error && (
        <p className="aviso aviso--auth" role="alert">
          <Icono nombre="alerta" />
          {error}
          <button type="button" className="boton boton--fantasma" onClick={reintentar}>Reintentar</button>
        </p>
      )}

      <div className="contenido-pestana" id="reportes-contenido" role="tabpanel"
        aria-labelledby={`reportes-tab-${pestana}`} tabIndex={0}>
        {!rangoValido ? null : cargando ? (
          <section className="panel">
            <Esqueleto texto="Calculando reportes…" tarjetas />
          </section>
        ) : !(pestana === 'ventas' ? ventas : merma) ? null : pestana === 'ventas' ? (
          <>
            <section className="kpis" aria-label="Resumen de ventas">
              <TarjetaKpi
                clase="kpi--acento"
                etiqueta="Vendido"
                valor={formatearDinero(importeVentas)} comparacion={variacion(importeVentas, ventasPrevias?.importe)}
                nota={`${diasConVentas} de ${totalDias} días con ventas`}
              />
              <TarjetaKpi
                clase="kpi--miel"
                etiqueta="Unidades"
                valor={String(unidadesVendidas)} comparacion={variacion(unidadesVendidas, ventasPrevias?.unidades)}
                nota="Piezas vendidas en el rango"
              />
              <TarjetaKpi
                clase="kpi--verde"
                etiqueta="Promedio diario"
                valor={formatearDinero(promedioVentas)} comparacion={variacion(promedioVentas, ventasPrevias?.promedio)}
                nota="Solo días con ventas"
              />
              <TarjetaKpi
                clase="kpi--verde"
                etiqueta="Productos"
                valor={String(productosVendidos.length)} comparacion={variacion(productosVendidos.length, ventasPrevias?.productos)}
                nota="Con movimiento en el rango"
              />
            </section>

            {estrella && (
              <aside className="producto-estrella">
                <span className="producto-icono"><IconoProducto id={estrella.producto_id} /></span>
                <div><p className="kpi__etiqueta">Producto estrella por importe</p>
                  <strong>{nombreDe(estrella.producto_id)}</strong></div>
                <span>{formatearDinero(estrella.total_centavos)} · {estrella.unidades} unidades</span>
              </aside>
            )}

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
                <GraficoBarras filas={llenarDias(ventasPorDia)} hoy={hoy} />
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
                  <button type="button" className="boton boton--fantasma" onClick={() => elegirRango(rango === 'semana' ? 'mes' : 'semana')}>Ver {rango === 'semana' ? 'este mes' : '7 días'}</button>
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
                        <th scope="col" className="tabla__num">% del total</th>
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
                          <td className="tabla__num">
                            <Proporcion parte={producto.total_centavos} total={importeVentas} />
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
                valor={formatearDinero(importeMerma)} comparacion={variacion(importeMerma, mermaPrevia?.importe)}
                nota="Costo de lo descartado"
              />
              <TarjetaKpi
                clase="kpi--miel"
                etiqueta="Descartadas"
                valor={String(descartadas)} comparacion={variacion(descartadas, mermaPrevia?.descartadas)}
                nota="Unidades retiradas"
              />
              <TarjetaKpi
                clase="kpi--verde"
                etiqueta="Días cerrados"
                valor={String(diasCerrados)} comparacion={variacion(diasCerrados, mermaPrevia?.cerrados)}
                nota={`De ${totalDias} días en el rango`}
              />
              <TarjetaKpi
                clase="kpi--verde"
                etiqueta="Promedio diario"
                valor={formatearDinero(promedioMerma)} comparacion={variacion(promedioMerma, mermaPrevia?.promedio)}
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
                <GraficoBarras filas={llenarDias(mermaPorDia)} hoy={hoy} merma />
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
                  <button type="button" className="boton boton--fantasma" onClick={() => elegirRango(rango === 'semana' ? 'mes' : 'semana')}>Ver {rango === 'semana' ? 'este mes' : '7 días'}</button>
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
                        <th scope="col" className="tabla__num">% del costo</th>
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
                          <td className="tabla__num">
                            <Proporcion parte={producto.merma_centavos} total={importeMerma} />
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
      </div>
    </main>
  );
}

const porcentaje = new Intl.NumberFormat('es-SV', { style: 'percent', maximumFractionDigits: 1 });

function variacion(actual: number, anterior?: number) {
  if (anterior === undefined) return 'Comparación no disponible';
  if (anterior === 0 && actual > 0) return '↑ Período anterior en cero';
  if (anterior === actual) return '→ 0 % frente al período anterior';
  return `${actual > anterior ? '↑' : '↓'} ${porcentaje.format(Math.abs(actual - anterior) / anterior)} frente al período anterior`;
}

function Proporcion({ parte, total }: { parte: number; total: number }) {
  const fraccion = total > 0 ? parte / total : 0;
  return (
    <span className="proporcion">
      <span className="proporcion__pista" aria-hidden="true">
        <span style={{ width: `${fraccion * 100}%` }} />
      </span>
      {porcentaje.format(fraccion)}
    </span>
  );
}

function GraficoBarras({ filas, hoy, merma = false }: {
  filas: { fecha: string; valor: number }[];
  hoy: string;
  merma?: boolean;
}) {
  const pico = filas.reduce((maximo, fila) => Math.max(maximo, fila.valor), 0);
  const magnitud = 10 ** Math.floor(Math.log10(Math.max(100, pico) / 4));
  const paso = Math.ceil(Math.max(100, pico) / (magnitud * 4)) * magnitud;
  const escala = [4, 3, 2, 1, 0].map((nivel) => nivel * paso);
  return (
    <div className={`grafico ${merma ? 'grafico--merma' : ''}`}>
      <div className="grafico__escala" aria-label="Escala en dólares">
        {escala.map((nivel) => <span key={nivel}>{formatearDinero(nivel)}</span>)}
      </div>
      <div className="grafico__desplazable">
        <div className="grafico__dias">
          {filas.map(({ fecha, valor }) => {
            const texto = `${fechaLegible(fecha)} · ${formatearDinero(valor)}`;
            return (
              <div className={`grafico__dia ${fecha === hoy ? 'grafico__dia--hoy' : ''}`} key={fecha}>
                <div className="grafico__columna" tabIndex={0} role="img"
                  aria-label={`${texto}${fecha === hoy ? ' · Hoy' : ''}`}>
                  <span className={`grafico__barra ${valor === 0 ? 'grafico__barra--cero' : ''}`}
                    style={{ height: `${valor / (paso * 4) * 100}%` }} />
                  <span className="grafico__tooltip" aria-hidden="true">{formatearDinero(valor)}</span>
                </div>
                <time dateTime={fecha}>{fecha.slice(8)}/{fecha.slice(5, 7)}{fecha === hoy && <small>Hoy</small>}</time>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TarjetaKpi({
  clase,
  etiqueta,
  valor,
  nota,
  comparacion,
}: {
  clase: string;
  etiqueta: string;
  valor: string;
  nota: string;
  comparacion: string;
}) {
  return (
    <div className={`kpi ${clase}`}>
      <span className="kpi__etiqueta">{etiqueta}</span>
      <strong className="kpi__valor">{valor}</strong>
      <span className="kpi__nota">{nota}</span>
      <span className="kpi__comparacion">{comparacion}</span>
    </div>
  );
}
