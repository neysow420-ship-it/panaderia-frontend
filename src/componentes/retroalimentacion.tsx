import { useEffect, useState } from 'react';
import { Icono } from './iconos';

import { EVENTO, type Aviso } from './notificaciones';

export function Toasts() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  useEffect(() => {
    const temporizadores = new Map<number, number>();
    const recibir = (evento: Event) => {
      const aviso = (evento as CustomEvent<Aviso>).detail;
      setAvisos((actuales) => [...actuales, aviso]);
      temporizadores.set(aviso.id, window.setTimeout(() => {
        setAvisos((actuales) => actuales.filter(({ id }) => id !== aviso.id));
        temporizadores.delete(aviso.id);
      }, 6500));
    };
    window.addEventListener(EVENTO, recibir);
    return () => {
      window.removeEventListener(EVENTO, recibir);
      temporizadores.forEach(window.clearTimeout);
    };
  }, []);

  return (
    <div className="toasts">
      {avisos.map(({ id, texto, tipo }) => (
        <div className={'toast toast--' + tipo} key={id}>
          <Icono nombre={tipo === 'ok' ? 'check' : 'alerta'} />
          <span role={tipo === 'ok' ? 'status' : 'alert'}>{texto}</span>
          <button className="boton boton--fantasma" aria-label="Cerrar notificación"
            onClick={() => setAvisos((actuales) => actuales.filter((aviso) => aviso.id !== id))}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function Esqueleto({ texto, tarjetas = false }: { texto: string; tarjetas?: boolean }) {
  return (
    <div className={tarjetas ? 'esqueleto esqueleto--tarjetas' : 'esqueleto'} role="status">
      <span className="solo-lectores">{texto}</span>
      {[1, 2, 3].map((fila) => <span key={fila} className="esqueleto__fila" aria-hidden="true" />)}
    </div>
  );
}
