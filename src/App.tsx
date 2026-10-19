import { useEffect, useState } from 'react';
import {
  guardarVentaDePrueba,
  listarVentas,
} from './database/pendientes';

function App() {
  const [resumen, setResumen] = useState('Cargando ventas...');
  const [ventas, setVentas] = useState<
    Awaited<ReturnType<typeof listarVentas>>
  >([]);

  async function pintar() {
    const resultado = await listarVentas();
    setVentas(resultado);
    setResumen(`Ventas guardadas: ${resultado.length}`);
  }

 useEffect(() => {
  let activo = true;

  listarVentas()
    .then((resultado) => {
      if (!activo) return;

      setVentas(resultado);
      setResumen(`Ventas guardadas: ${resultado.length}`);
    })
    .catch((error: unknown) => {
      console.error('Error al cargar ventas:', error);

      if (activo) {
        setResumen('No se pudieron cargar las ventas.');
      }
    });

  return () => {
    activo = false;
  };
}, []);

  async function guardar() {
    await guardarVentaDePrueba();
    await pintar();
  }

  return (
    <main>
      <h1>Prueba de PouchDB</h1>
      <button onClick={guardar}>Guardar venta de prueba</button>
      <p>{resumen}</p>
      <ul>
        {ventas.map((venta) => (
          <li key={venta._id}>
            {venta._id} | {venta.estado} | {venta.solicitud.creado_local}
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;