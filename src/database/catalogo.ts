/** Producto tal como lo necesita la pantalla de venta. */
export interface Producto {
  /** Es el `producto_id` que viaja en la venta, por ejemplo "producto:pan-frances". */
  id: string;
  nombre: string;
  precio_centavos: number;
}

// TEMPORAL hasta el ítem 4.12: mismos 5 productos y precios del contrato v1.
// El servidor sigue siendo quien decide el precio oficial.
const PRODUCTOS_TEMPORALES: Producto[] = [
  { id: 'producto:pan-frances', nombre: 'Pan francés', precio_centavos: 10 },
  { id: 'producto:semita', nombre: 'Semita', precio_centavos: 25 },
  { id: 'producto:hojitas', nombre: 'Hojitas', precio_centavos: 15 },
  { id: 'producto:cachos', nombre: 'Cachos', precio_centavos: 30 },
  { id: 'producto:donas', nombre: 'Donas', precio_centavos: 35 },
];

/**
 * Devuelve el catálogo local. En el ítem 4.12 solo cambia el cuerpo:
 * leerá la base local `espejo` en lugar de la lista fija.
 */
export async function cargarCatalogo(): Promise<Producto[]> {
  return PRODUCTOS_TEMPORALES;
}