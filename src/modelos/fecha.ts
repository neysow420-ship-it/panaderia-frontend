/** Utilidades de fecha del negocio (El Salvador, UTC−6). */

const ZONA = 'America/El_Salvador';

/** Día de negocio actual en formato `AAAA-MM-DD`. */
export function fechaHoy(): string {
  return fechaEnZona(new Date());
}

function fechaEnZona(fecha: Date): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '01';

  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

/** Suma (o resta, con números negativos) días a una fecha `AAAA-MM-DD`. */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const base = new Date(Date.UTC(anio, mes - 1, dia));

  base.setUTCDate(base.getUTCDate() + dias);

  return base.toISOString().slice(0, 10);
}

/** Primer día del mes de `fecha`. */
export function inicioDeMes(fecha: string): string {
  return `${fecha.slice(0, 8)}01`;
}

/** "17 nov 2026" */
export function fechaLegible(fecha: string): string {
  return formatear(fecha, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "martes, 17 de noviembre" */
export function fechaLarga(fecha: string): string {
  const texto = formatear(fecha, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "08:15" a partir de un RFC 3339. */
export function horaLocal(iso: string): string {
  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-SV', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
}

/** Momento actual como RFC 3339; la API calcula el día de negocio. */
export function creadoAhora(): string {
  return new Date().toISOString();
}

function formatear(
  fecha: string,
  opciones: Intl.DateTimeFormatOptions,
): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);

  return new Intl.DateTimeFormat('es-SV', {
    ...opciones,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}
