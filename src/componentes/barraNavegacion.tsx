import type { Sesion } from '../auth/sesion';
import { Icono, type NombreIcono } from './iconos';
import './barraNavegacion.css';

export type Pantalla = 'venta' | 'produccion' | 'cierre' | 'reportes';

const ETIQUETAS: Record<Pantalla, string> = {
  venta: 'Venta',
  produccion: 'Producción',
  cierre: 'Cierre',
  reportes: 'Reportes',
};

const ICONOS: Record<Pantalla, NombreIcono> = {
  venta: 'venta',
  produccion: 'produccion',
  cierre: 'cierre',
  reportes: 'reportes',
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
  const inicial = sesion.usuario.nombre.trim().charAt(0).toUpperCase() || 'P';

  return (
    <header className="barra">
      <div className="barra-marca">
        <span className="barra-logo" aria-hidden="true">
          <Icono nombre="hogaza" />
        </span>
        <span className="barra-identidad">
          <strong>Panadería</strong>
          <span>Horno de barrio</span>
        </span>
      </div>

      <nav className="barra-navegacion" aria-label="Secciones">
        <button
          type="button"
          className={pantalla === 'venta' ? 'activo' : ''}
          aria-current={pantalla === 'venta' ? 'page' : undefined}
          onClick={() => onCambiar('venta')}
        >
          <Icono nombre={ICONOS.venta} />
          <span>{ETIQUETAS.venta}</span>
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
              <Icono nombre={ICONOS[seccion]} />
              <span>{ETIQUETAS[seccion]}</span>
            </button>
          ))}
      </nav>

      <div className="barra-sesion">
        <div className="barra-usuario">
          <span className="barra-avatar" aria-hidden="true">
            {inicial}
          </span>
          <span className="barra-datos">
            <strong>{sesion.usuario.nombre}</strong>
            <span className={`barra-rol ${sesion.usuario.rol}`}>
              {esEncargado ? 'Encargado' : 'Cajero'}
            </span>
          </span>
        </div>

        {onSalir ? (
          <button
            type="button"
            className="barra-salir"
            onClick={onSalir}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <Icono nombre="salir" />
            <span>Salir</span>
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
