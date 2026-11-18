import { describe, expect, it } from 'vitest';
import {
  fechaHoy,
  fechaLegible,
  inicioDeMes,
  sumarDias,
} from './fecha';

describe('fechas del negocio', () => {
  it('fechaHoy usa el formato AAAA-MM-DD', () => {
    expect(fechaHoy()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sumarDias cruza meses y años', () => {
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('inicioDeMes devuelve el día 1', () => {
    expect(inicioDeMes('2026-11-17')).toBe('2026-11-01');
  });

  it('fechaLegible incluye el año', () => {
    expect(fechaLegible('2026-11-17')).toContain('2026');
  });
});
