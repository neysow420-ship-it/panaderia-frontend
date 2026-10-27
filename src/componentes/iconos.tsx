import type { ReactNode } from 'react';

/** Iconos de línea propios, sin dependencias externas. */
export type NombreIcono =
  | 'hogaza'
  | 'pan'
  | 'semita'
  | 'hojitas'
  | 'cachos'
  | 'donas'
  | 'venta'
  | 'produccion'
  | 'cierre'
  | 'reportes'
  | 'salir'
  | 'ojo'
  | 'ojo-cerrado'
  | 'mas'
  | 'menos'
  | 'carrito'
  | 'reloj'
  | 'alerta'
  | 'check'
  | 'trigo';

const TRAZOS: Record<NombreIcono, ReactNode> = {
  hogaza: (
    <>
      <path d="M4 10.8c0-2.7 2.2-4.8 4.8-4.8h6.4c2.6 0 4.8 2.1 4.8 4.8v1.4a5.8 5.8 0 0 1-5.8 5.8h-4.4A5.8 5.8 0 0 1 4 12.2v-1.4Z" />
      <path d="M8 9.8h8M8 12.8h8" />
    </>
  ),
  pan: (
    <>
      <path d="M3.5 15.2c1.4-4.9 4.8-8.2 8.5-8.2s7.1 3.3 8.5 8.2c-2.8 1.8-5.6 2.6-8.5 2.6s-5.7-.8-8.5-2.6Z" />
      <path d="m8 12.5 2-1.6M12 12.5l2-1.6M16 12.5l2-1.6" />
    </>
  ),
  semita: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="5" />
      <path d="M8 9.5h8M8 14.5h8M12 7v10" />
    </>
  ),
  hojitas: (
    <>
      <path d="m4 9 8-4 8 4-8 4-8-4Z" />
      <path d="m4 14 8 4 8-4" />
      <path d="M12 13v5" />
    </>
  ),
  cachos: (
    <>
      <path d="M4.5 17.5c4.5.7 9.2-1.4 12.2-5.2 1.8-2.3 2.3-5.1 1.3-7.3-2.1.2-4.2 1.3-5.8 3.2-2.6 3-3.8 6.4-7.7 9.3Z" />
      <path d="M8.5 13.5c2.4-.2 4.6-1.4 6.2-3.3" />
    </>
  ),
  donas: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="m8 7 .8-1M15.5 8.5l1-.8M17 15l1 .8M8.5 16.5l-1 .8" />
    </>
  ),
  venta: (
    <>
      <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4v-17Z" />
      <path d="M9 8h6M9 11.5h6M9 15h4" />
    </>
  ),
  produccion: (
    <>
      <path d="M12 3c1.4 3 5 4.3 5 8a5 5 0 0 1-10 0c0-2 1-3.6 2.6-5.1.2 1.5.9 2.4 1.9 2.7C11 6.6 11.2 4.8 12 3Z" />
      <path d="M12 17.5v1.2" />
    </>
  ),
  cierre: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2" />
    </>
  ),
  reportes: (
    <>
      <path d="M5 20V10M12 20V4M19 20v-7" />
      <path d="M3.5 20.5h17" />
    </>
  ),
  salir: (
    <>
      <path d="M10 5H5v14h5" />
      <path d="m14 8 4 4-4 4M9 12h9" />
    </>
  ),
  ojo: (
    <>
      <path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  'ojo-cerrado': (
    <>
      <path d="M4 4l16 16" />
      <path d="M9.5 9.5A2.2 2.2 0 0 0 12 14.2c.7 0 1.3-.3 1.8-.7" />
      <path d="M6.3 6.6C4.3 8.1 3 12 3 12s3.2 5 9 5c1.4 0 2.6-.4 3.7-1" />
      <path d="M18.2 15.1C20 13.7 21 12 21 12s-3.2-5-9-5c-.6 0-1.1.1-1.6.2" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  carrito: (
    <>
      <path d="M3.5 5h2l2 10h10.5l2-7H6" />
      <circle cx="9" cy="19" r="1.2" />
      <circle cx="17" cy="19" r="1.2" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 4 3.5 19h17L12 4Z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="16.5" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="m5 12.5 4.2 4L19 7" />,
  trigo: (
    <>
      <path d="M12 21V8" />
      <path d="M12 12c-2.2 0-3.8-1.6-4.3-3.8 2.2 0 3.8 1.1 4.3 3.8ZM12 12c2.2 0 3.8-1.6 4.3-3.8-2.2 0-3.8 1.1-4.3 3.8Z" />
      <path d="M12 16c-2.2 0-3.8-1.6-4.3-3.8 2.2 0 3.8 1.1 4.3 3.8ZM12 16c2.2 0 3.8-1.6 4.3-3.8-2.2 0-3.8 1.1-4.3 3.8Z" />
      <path d="M12 8c-1.2-.8-1.6-2.1-1.2-3.5 1.2.8 1.6 2.1 1.2 3.5ZM12 8c1.2-.8 1.6-2.1 1.2-3.5-1.2.8-1.6 2.1-1.2 3.5Z" />
    </>
  ),
};

interface PropsIcono {
  nombre: NombreIcono;
  className?: string;
}

export function Icono({ nombre, className }: PropsIcono) {
  return (
    <svg
      className={className ? `icono ${className}` : 'icono'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}

const ICONO_PRODUCTO: Record<string, NombreIcono> = {
  'pan-frances': 'pan',
  semita: 'semita',
  hojitas: 'hojitas',
  cachos: 'cachos',
  donas: 'donas',
};

export function IconoProducto({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const slug = id.replace(/^producto:/, '');
  return (
    <Icono nombre={ICONO_PRODUCTO[slug] ?? 'hogaza'} className={className} />
  );
}
