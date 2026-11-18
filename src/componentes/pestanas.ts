import type { KeyboardEvent } from 'react';

export function navegarPestanas(evento: KeyboardEvent<HTMLDivElement>) {
  const teclas = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!teclas.includes(evento.key)) return;
  const botones = [...evento.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const actual = botones.findIndex((boton) => boton === evento.target);
  if (actual < 0) return;

  evento.preventDefault();
  const avance = evento.key === 'ArrowRight' ? 1 : -1;
  const siguiente = (actual + avance + botones.length) % botones.length;
  const destino = evento.key === 'Home' ? 0 : evento.key === 'End' ? botones.length - 1 : siguiente;
  botones[destino].focus();
  botones[destino].click();
}
