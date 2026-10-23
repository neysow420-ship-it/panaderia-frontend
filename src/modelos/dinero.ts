/** Convierte centavos enteros a dólares en texto: 130 -> "$1.30". */
export function formatearDinero(centavos: number): string {
  return `$${(centavos / 100).toFixed(2)}`;
}