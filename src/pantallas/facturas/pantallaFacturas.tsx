import { useEffect, useState } from 'react';
import { listarFacturas, type Factura } from '../../api/materiales';
import { formatearDinero } from '../../modelos/dinero';
import { fechaLegible } from '../../modelos/fecha';
import '../comunes/encargado.css';

export default function PantallaFacturas() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [offset, setOffset] = useState(0);
  const [siguiente, setSiguiente] = useState<number | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    void listarFacturas(offset).then((pagina) => {
      if (!activo) return;
      setFacturas(pagina.facturas);
      setSiguiente(pagina.siguiente_offset);
    }).catch((fallo: unknown) => {
      if (activo) setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar las facturas.');
    }).finally(() => {
      if (activo) setCargando(false);
    });
    return () => { activo = false; };
  }, [offset, recarga]);

  function cargar(posicion: number) {
    setCargando(true);
    setError('');
    setOffset(posicion);
    setRecarga((valor) => valor + 1);
  }

  return (
    <main className="encargado">
      <header className="encargado__cabecera">
        <h1>Facturas</h1>
        <button className="boton boton--fantasma" type="button" onClick={() => cargar(0)} disabled={cargando}>
          Actualizar
        </button>
      </header>
      <section className="panel">
        <div className="panel__cuerpo">
          {cargando && <p role="status">Cargando facturas…</p>}
          {error && <p className="aviso aviso--auth" role="alert">{error}</p>}
          {!cargando && !error && facturas.length === 0 && <p>No hay facturas en esta página.</p>}
          {!cargando && !error && facturas.map((factura) => (
            <details key={JSON.stringify([factura.proveedor, factura.numero])}>
              <summary>
                <strong>{factura.numero}</strong> · {factura.proveedor} · {fechaLegible(factura.fecha)} · {formatearDinero(factura.total_centavos)}
              </summary>
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead><tr><th>Material</th><th>SKU</th><th>Cantidad</th><th>Costo unitario</th></tr></thead>
                  <tbody>{factura.lineas.map((linea, indice) => (
                    <tr key={indice}>
                      <td>{linea.descripcion}</td><td>{linea.sku}</td><td>{linea.cantidad}</td>
                      <td>{formatearDinero(Math.round(linea.costo_unitario * 100))}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          ))}
          <div className="pildanas">
            <button className="boton boton--fantasma" type="button" disabled={cargando || offset === 0}
              onClick={() => cargar(Math.max(0, offset - 50))}>Anterior</button>
            <button className="boton boton--fantasma" type="button" disabled={cargando || Boolean(error) || siguiente === null}
              onClick={() => { if (siguiente !== null) cargar(siguiente); }}>Siguiente</button>
          </div>
        </div>
      </section>
    </main>
  );
}
