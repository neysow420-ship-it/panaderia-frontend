import { pedir } from './cliente';

export const ESCALA_MATERIAL = 1_000_000;

export interface Ingrediente {
  sku: string;
  millonesimas: number;
}

export interface ProductoReceta {
  _id: string;
  nombre: string;
  precio_centavos: number;
  vida_util_dias: number;
  activo: boolean;
  receta?: Ingrediente[];
}

export type Inventario = Record<string, { descripcion: string; saldo_millonesimas: number }>;

export interface Factura {
  numero: string;
  proveedor: string;
  fecha: string;
  total_centavos: number;
  lineas: { sku: string; descripcion: string; cantidad: number; costo_unitario: number }[];
}

export const listarFacturas = (offset: number) =>
  pedir<{ facturas: Factura[]; siguiente_offset: number | null }>(`/facturas?offset=${offset}`);
export const listarMateriales = () => pedir<{ materiales: Inventario }>('/materiales');
export const listarProductos = () => pedir<ProductoReceta[]>('/productos');

export function cantidadMaterial(millonesimas: number): string {
  return (millonesimas / ESCALA_MATERIAL).toLocaleString('es-SV', { maximumFractionDigits: 6 });
}
