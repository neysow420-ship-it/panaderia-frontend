// =============================================================================
// Llamadas a la API de producción, cierre y reportes
// =============================================================================
//
// Los tipos reflejan los documentos del backend Rust. Los nombres de campo se
// mantienen en snake_case porque así viajan por el contrato HTTP.

import { pedir } from './cliente';

// ─── Producción ─────────────────────────────────────────────────────────────

export interface HornadaApi {
  _id: string;
  tipo: string;
  usuario: string;
  creado_en: string;
  fecha: string;
  producto_id: string;
  unidades: number;
  fecha_vencimiento: string;
}

export interface SolicitudHornada {
  operacion_id: string;
  producto_id: string;
  unidades: number;
  creado_local: string;
  permitir_faltantes?: boolean;
}

export interface RespuestaHornada {
  ya_procesada: boolean;
  hornada: HornadaApi;
}

export type MotivoDescarte = 'danado' | 'vencido';

export interface DescarteApi {
  _id: string;
  tipo: string;
  fecha: string;
  lote_id: string;
  producto_id: string;
  unidades: number;
  motivo: MotivoDescarte;
  usuario: string;
  creado_en: string;
}

// ─── Vencimientos ───────────────────────────────────────────────────────────

export type EstadoVencimiento = 'vencido' | 'vence_hoy' | 'por_vencer' | 'vigente';

export interface LoteVencimientoApi {
  lote_id: string;
  producto_id: string;
  unidades: number;
  fecha_vencimiento: string;
  dias_restantes: number;
  estado: EstadoVencimiento;
}

export interface ReporteVencimientosApi {
  fecha: string;
  actualizado_en: string;
  resumen: {
    vencido: number;
    vence_hoy: number;
    por_vencer: number;
    vigente: number;
  };
  lotes: LoteVencimientoApi[];
}

// ─── Cierre ─────────────────────────────────────────────────────────────────

export interface PreviewProductoApi {
  producto_id: string;
  producidas: number;
  vendidas: number;
  costo_unitario_centavos: number | null;
}

export interface CierrePorProductoApi {
  producto_id: string;
  existencia_inicial: number;
  producidas: number;
  vendidas: number;
  descartadas: number;
  diferencia: number;
  existencia_final: number;
  costo_aplicado_centavos: number;
  merma_centavos: number;
  merma_bp: number;
}

export interface CierreApi {
  _id: string;
  tipo: string;
  fecha: string;
  responsable: string;
  cerrado_en: string;
  modo_produccion: string;
  confirmo_diferencia: boolean;
  total_merma_centavos: number;
  por_producto: CierrePorProductoApi[];
}

export interface EstadoCierreApi {
  fecha: string;
  cerrado: boolean;
  cierre: CierreApi | null;
  por_producto: PreviewProductoApi[];
}

export interface SolicitudCierre {
  fecha: string;
  descartadas: { producto_id: string; unidades: number }[];
  confirmo_diferencia: boolean;
}

export interface RespuestaCierre {
  ya_procesada: boolean;
  cierre: CierreApi;
}

// ─── Reportes ───────────────────────────────────────────────────────────────

export interface VentaProductoApi {
  producto_id: string;
  unidades: number;
  total_centavos: number;
}

export interface DiaVentasApi {
  fecha: string;
  por_producto: VentaProductoApi[];
}

export interface ReporteVentasApi {
  desde: string;
  hasta: string;
  dias: DiaVentasApi[];
  total_centavos: number;
}

export interface MermaProductoApi {
  producto_id: string;
  producidas: number;
  vendidas: number;
  descartadas: number;
  diferencia: number;
  merma_centavos: number;
  costo_aplicado_centavos: number;
}

export interface DiaMermaApi {
  fecha: string;
  cerrado: boolean;
  por_producto: MermaProductoApi[];
  total_merma_centavos: number;
}

export interface ReporteMermaApi {
  desde: string;
  hasta: string;
  actualizado_en: string;
  dias: DiaMermaApi[];
  total_merma_centavos: number;
}

// ─── Funciones ──────────────────────────────────────────────────────────────

export async function listarHornadas(fecha: string): Promise<HornadaApi[]> {
  const datos = await pedir<{ hornadas: HornadaApi[] }>(
    `/hornadas?fecha=${encodeURIComponent(fecha)}`,
  );

  return datos.hornadas;
}

export async function registrarHornada(
  solicitud: SolicitudHornada,
): Promise<RespuestaHornada> {
  return pedir<RespuestaHornada>('/hornadas', {
    metodo: 'POST',
    cuerpo: solicitud,
  });
}

export async function listarDescartes(fecha: string): Promise<DescarteApi[]> {
  const datos = await pedir<{ descartes: DescarteApi[] }>(
    `/descartes?fecha=${encodeURIComponent(fecha)}`,
  );

  return datos.descartes;
}

export async function registrarDescarte(descarte: {
  fecha: string;
  lote_id: string;
  producto_id: string;
  unidades: number;
  motivo: MotivoDescarte;
  creado_en: string;
}): Promise<DescarteApi> {
  return pedir<DescarteApi>('/descartes', {
    metodo: 'POST',
    cuerpo: descarte,
  });
}

export async function vencimientos(
  fecha?: string,
): Promise<ReporteVencimientosApi> {
  const consulta = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';

  return pedir<ReporteVencimientosApi>(`/vencimientos${consulta}`);
}

export async function estadoCierre(fecha: string): Promise<EstadoCierreApi> {
  return pedir<EstadoCierreApi>(
    `/cierre?fecha=${encodeURIComponent(fecha)}`,
  );
}

export async function cerrarDia(
  solicitud: SolicitudCierre,
): Promise<RespuestaCierre> {
  return pedir<RespuestaCierre>('/cierre', {
    metodo: 'POST',
    cuerpo: solicitud,
  });
}

export async function reporteVentas(
  desde: string,
  hasta: string,
): Promise<ReporteVentasApi> {
  return pedir<ReporteVentasApi>(
    `/reportes/ventas?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
  );
}

export async function reporteMerma(
  desde: string,
  hasta: string,
): Promise<ReporteMermaApi> {
  return pedir<ReporteMermaApi>(
    `/merma?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
  );
}
