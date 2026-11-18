export interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'error';
}

export const EVENTO = 'panaderia:toast';
let secuencia = 0;

export function notificar(texto: string, tipo: Aviso['tipo'] = 'ok') {
  window.dispatchEvent(new CustomEvent<Aviso>(EVENTO, {
    detail: { id: ++secuencia, texto, tipo },
  }));
}

