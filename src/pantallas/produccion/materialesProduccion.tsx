import { useState, type FormEvent } from 'react';
import { pedir } from '../../api/cliente';
import {
  cantidadMaterial, ESCALA_MATERIAL, type Ingrediente, type Inventario, type ProductoReceta,
} from '../../api/materiales';

export function PanelMateriales({ inventario, onActualizar }: {
  inventario: Inventario | null;
  onActualizar: () => void;
}) {
  const filas = Object.entries(inventario ?? {});
  return (
    <section className="panel">
      <header className="panel__cabecera">
        <div><h2>Materiales disponibles</h2><p className="nota">Un saldo negativo indica material pendiente de recibir.</p></div>
        <button type="button" className="boton boton--fantasma" onClick={onActualizar}>Actualizar</button>
      </header>
      <div className="panel__cuerpo tabla-envoltura">
        {inventario === null ? <p>No hay datos de inventario disponibles.</p> : filas.length === 0
          ? <p>Aún no hay entradas de facturas ni consumos de producción.</p>
          : <table className="tabla">
            <thead><tr><th>Material</th><th>SKU</th><th>Saldo en unidades facturadas</th></tr></thead>
            <tbody>{filas.map(([sku, material]) => (
              <tr key={sku}>
                <td>{material.descripcion || sku}</td><td>{sku}</td>
                <td><strong>{cantidadMaterial(material.saldo_millonesimas)}</strong>
                  {material.saldo_millonesimas < 0 && ' · Pendiente'}
                </td>
              </tr>
            ))}</tbody>
          </table>}
      </div>
    </section>
  );
}

export function PanelRecetas({ productos, inventario, onGuardada }: {
  productos: ProductoReceta[];
  inventario: Inventario | null;
  onGuardada: () => void;
}) {
  const [seleccion, setSeleccion] = useState('');
  const producto = productos.find((item) => item._id === seleccion);

  return (
    <section className="panel">
      <header className="panel__cabecera"><h2>Productos y recetas</h2></header>
      <div className="panel__cuerpo formulario">
        <label className="campo">
          <span>Producto</span>
          <select className="selector" value={seleccion} onChange={(evento) => setSeleccion(evento.target.value)}>
            <option value="">Nuevo producto</option>
            {productos.map((item) => <option key={item._id} value={item._id}>
              {item.nombre}{item.receta ? '' : ' (sin receta)'}
            </option>)}
          </select>
        </label>
        <EditorReceta key={JSON.stringify(producto ?? null)} producto={producto} inventario={inventario}
          onGuardada={(guardado) => { setSeleccion(guardado._id); onGuardada(); }} />
      </div>
    </section>
  );
}

function EditorReceta({ producto, inventario, onGuardada }: {
  producto?: ProductoReceta;
  inventario: Inventario | null;
  onGuardada: (producto: ProductoReceta) => void;
}) {
  const [filas, setFilas] = useState(() => (producto?.receta ?? []).map((item, indice) => ({
    id: indice, sku: item.sku, cantidad: String(item.millonesimas / ESCALA_MATERIAL),
  })));
  const [siguienteId, setSiguienteId] = useState(filas.length);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const receta: Ingrediente[] = filas.map(({ sku, cantidad }) => ({
      sku: sku.trim(), millonesimas: Math.round(Number(cantidad) * ESCALA_MATERIAL),
    }));
    if (!receta.length || receta.some((item) => !item.sku || item.millonesimas < 1) ||
      new Set(receta.map((item) => item.sku)).size !== receta.length) {
      setError('Agrega al menos un material y usa cada SKU una sola vez.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const guardado = await pedir<ProductoReceta>(
        producto ? `/productos/${encodeURIComponent(producto._id.slice('producto:'.length))}` : '/productos',
        {
          metodo: producto ? 'PUT' : 'POST',
          cuerpo: {
            ...(producto ? {} : { slug: formulario.get('slug') }),
            nombre: formulario.get('nombre'),
            precio_centavos: Number(formulario.get('precio_centavos')),
            vida_util_dias: Number(formulario.get('vida_util_dias')),
            activo: producto?.activo ?? true,
            receta,
          },
        },
      );
      onGuardada(guardado);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar la receta.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={(evento) => void guardar(evento)}>
      <fieldset className="formulario" disabled={guardando}>
        {!producto && <label className="campo"><span>Código de producto</span>
          <input className="selector" name="slug" placeholder="pan-integral" pattern="[a-z0-9][a-z0-9-]*" maxLength={64} required />
        </label>}
        <label className="campo"><span>Nombre</span>
          <input className="selector" name="nombre" defaultValue={producto?.nombre} required />
        </label>
        <label className="campo"><span>Precio en centavos de dólar</span>
          <input className="selector" name="precio_centavos" type="number" min={1} step={1}
            defaultValue={producto?.precio_centavos} required />
        </label>
        <label className="campo"><span>Vida útil en días</span>
          <input className="selector" name="vida_util_dias" type="number" min={1} max={365} step={1}
            defaultValue={producto?.vida_util_dias ?? 1} required />
        </label>
        <h3>Material por unidad producida</h3>
        <p className="nota">Usa el SKU de la factura. Si se factura un saco de 50 kg, 50 g equivalen a 0.001 sacos.</p>
        <datalist id="receta-skus">
          {Object.entries(inventario ?? {}).map(([sku, material]) => <option key={sku} value={sku}>{material.descripcion}</option>)}
        </datalist>
        {filas.map((fila) => (
          <div className="formulario" key={fila.id}>
            <label className="campo"><span>SKU del material</span>
              <input className="selector" list="receta-skus" value={fila.sku} maxLength={100} required
                onChange={(evento) => setFilas((actual) => actual.map((item) =>
                  item.id === fila.id ? { ...item, sku: evento.target.value } : item
                ))} />
            </label>
            <label className="campo"><span>Cantidad en unidades facturadas</span>
              <input className="selector" type="number" min="0.000001" max="1000" step="0.000001"
                value={fila.cantidad} required onChange={(evento) => setFilas((actual) => actual.map((item) =>
                  item.id === fila.id ? { ...item, cantidad: evento.target.value } : item
                ))} />
            </label>
            <button className="boton boton--fantasma" type="button"
              onClick={() => setFilas((actual) => actual.filter((item) => item.id !== fila.id))}>Quitar material</button>
          </div>
        ))}
        <button className="boton boton--fantasma" type="button" disabled={filas.length >= 50}
          onClick={() => {
            setFilas((actual) => [...actual, { id: siguienteId, sku: '', cantidad: '' }]);
            setSiguienteId((valor) => valor + 1);
          }}>Agregar material</button>
        {error && <p role="alert" className="aviso aviso--auth">{error}</p>}
        <button className="boton boton--principal" type="submit">{guardando ? 'Guardando…' : 'Guardar producto y receta'}</button>
      </fieldset>
    </form>
  );
}
