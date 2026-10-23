
import { useEffect } from 'react';
import PantallaVenta from './pantallas/venta/pantallaVenta';
import { iniciarReplicaCatalogo } from './sync/catalogo';

export default function App() {
  useEffect(() => {
    return iniciarReplicaCatalogo();
  }, []);

  return <PantallaVenta />;
}
