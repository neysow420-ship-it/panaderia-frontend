import type { Sesion } from '../auth/sesion';
import './barraNavegacion.css';

export type Pantalla = 'venta' | 'produccion' | 'cierre' | 'reportes';

const ETIQUETAS: Record<Pantalla, string> = {
  venta: 'Venta',
  produccion: 'Producción',
  cierre: 'Cierre',
  reportes: 'Reportes',
};

interface Props {
  sesion: Sesion;
  pantalla: Pantalla;
  onCambiar: (pantalla: Pantalla) => void;
  onSalir?: () => void;
}

export default function BarraNavegacion({
  sesion,
  pantalla,
  onCambiar,
  onSalir,
}: Props) {
  const esEncargado = sesion.usuario.rol === 'encargado';

  return (
    <header className="barra">
      <div className="barra-identidad">
        <span className="barra-marca">Panadería</span>
        <span className={`barra-rol ${sesion.usuario.rol}`}>
          {esEncargado ? 'Encargado' : 'Cajero'}
        </span>
      </div>

      <nav className="barra-navegacion" aria-label="Secciones">
        <button
          type="button"
          className={pantalla === 'venta' ? 'activo' : ''}
          aria-current={pantalla === 'venta' ? 'page' : undefined}
          onClick={() => onCambiar('venta')}
        >
          {ETIQUETAS.venta}
        </button>

        {esEncargado &&
          (['produccion', 'cierre', 'reportes'] as const).map((seccion) => (
            <button
              key={seccion}
              type="button"
              className={pantalla === seccion ? 'activo' : ''}
              aria-current={pantalla === seccion ? 'page' : undefined}
              onClick={() => onCambiar(seccion)}
            >
              {ETIQUETAS[seccion]}
            </button>
          ))}
      </nav>

      <div className="barra-sesion">
        <span className="barra-usuario">{sesion.usuario.nombre}</span>
        {onSalir ? (
          <button type="button" className="barra-salir" onClick={onSalir}>
            Salir
          </button>
        ) : (
          <span className="barra-sin-login" title="VITE_AUTH=desactivado">
            Sin login
          </span>
        )}
      </div>
    </header>
  );
}
