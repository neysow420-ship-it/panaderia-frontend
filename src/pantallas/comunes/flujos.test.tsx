import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../api/panaderia';
import * as pendientes from '../../database/pendientes';
import { fechaHoy, sumarDias } from '../../modelos/fecha';
import PantallaCierre from '../cierre/pantallaCierre';
import PantallaProduccion from '../produccion/pantallaProduccion';
import PantallaReportes from '../reportes/pantallaReportes';
import PantallaVenta from '../venta/pantallaVenta';

const producto = { id: 'producto:donas', nombre: 'Donas', precio_centavos: 50 };
const fecha = fechaHoy();
const fila = {
  producto_id: producto.id, producidas: 12, vendidas: 5, costo_unitario_centavos: 20,
};

vi.mock('../../api/panaderia');
vi.mock('../../database/catalogo', () => ({
  cargarCatalogo: async () => ({ productos: [producto], esRespaldo: false }),
  observarCatalogo: () => () => {},
}));
vi.mock('../../database/pendientes', () => ({
  guardarVenta: vi.fn(), listarVentas: vi.fn(), observarVentas: vi.fn(),
}));
vi.mock('../../sync/cola', () => ({
  EVENTO_AVISO_ENVIO: 'venta:aviso', enviarPendientes: async () => ({ enviadas: 1, rechazadas: 0 }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(callback, 0));
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  vi.mocked(api.estadoCierre).mockResolvedValue({ fecha, cerrado: false, cierre: null, por_producto: [fila] });
  vi.mocked(api.listarHornadas).mockResolvedValue([{
    _id: 'lote-1', producto_id: producto.id, unidades: 12, fecha, fecha_vencimiento: fecha,
    creado_en: `${fecha}T12:00:00Z`, usuario: 'Ana', tipo: 'hornada',
  }]);
  vi.mocked(api.listarDescartes).mockResolvedValue([]);
  vi.mocked(api.vencimientos).mockResolvedValue({
    fecha, actualizado_en: '', resumen: { vencido: 0, vence_hoy: 0, por_vencer: 0, vigente: 0 }, lotes: [],
  });
});

describe('Flujos del turno', () => {
  it('registra las cantidades de la comanda y muestra el total oficial al sincronizar', async () => {
    let refrescar: () => void = () => {};
    vi.mocked(pendientes.observarVentas).mockImplementation((callback) => {
      refrescar = callback;
      return () => {};
    });
    vi.mocked(pendientes.listarVentas).mockResolvedValue([]);
    const venta = {
      _id: 'venta:1', estado: 'aceptada', total_oficial_centavos: 275,
      solicitud: { lineas: [{ producto_id: producto.id, cantidad: 5 }], creado_local: new Date().toISOString() },
    } as pendientes.VentaLocal;
    vi.mocked(pendientes.guardarVenta).mockImplementation(async () => {
      vi.mocked(pendientes.listarVentas).mockResolvedValue([venta]);
      refrescar();
      return venta;
    });

    render(<PantallaVenta consultarStock />);
    fireEvent.click(screen.getByRole('button', { name: '×5' }));
    fireEvent.click(await screen.findByRole('button', { name: /Donas.*7 disponibles/ }));
    fireEvent.click(screen.getByRole('button', { name: '$5' }));
    expect(screen.getByText('Cambio estimado')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
    await waitFor(() => expect(pendientes.guardarVenta).toHaveBeenCalledWith([
      { producto_id: producto.id, cantidad: 5 },
    ]));
    expect(await screen.findByText(/Total oficial:.*2\.75/)).toBeVisible();
  });

  it('envía la hornada y la merma con el contrato existente', async () => {
    const hornada = (await api.listarHornadas(fecha))[0];
    vi.mocked(api.registrarHornada).mockResolvedValue({ ya_procesada: false, hornada });
    vi.mocked(api.registrarDescarte).mockResolvedValue({
      _id: 'merma-1', tipo: 'descarte', fecha, lote_id: hornada._id, producto_id: producto.id,
      unidades: 1, motivo: 'danado', usuario: 'Ana', creado_en: hornada.creado_en,
    });

    render(<PantallaProduccion />);
    await screen.findByText('12 unidades · 06:00');
    expect(screen.getByRole('button', { name: 'Registrar hornada' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '+12' }));
    fireEvent.change(screen.getByLabelText(/Hora de la hornada/), { target: { value: '08:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar hornada' }));
    await waitFor(() => expect(api.registrarHornada).toHaveBeenCalledWith(expect.objectContaining({
      producto_id: producto.id, unidades: 12, creado_local: `${fecha}T14:30:00.000Z`,
    })));

    fireEvent.click(screen.getByRole('tab', { name: /Merma/ }));
    await screen.findByText('Sin merma registrada');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar merma' }));
    await waitFor(() => expect(api.registrarDescarte).toHaveBeenCalledWith(expect.objectContaining({
      fecha, lote_id: hornada._id, producto_id: producto.id, unidades: 1, motivo: 'danado',
    })));
  });

  it('pide confirmación antes de cerrar y pasa a solo lectura con la respuesta', async () => {
    vi.mocked(api.cerrarDia).mockResolvedValue({
      ya_procesada: false,
      cierre: { _id: 'cierre-1', tipo: 'cierre', fecha, responsable: 'Ana',
        cerrado_en: new Date().toISOString(), modo_produccion: 'lotes', confirmo_diferencia: true,
        total_merma_centavos: 0, por_producto: [{ ...fila, descartadas: 0, merma_centavos: 0,
          diferencia: 7, existencia_inicial: 0, existencia_final: 7, costo_aplicado_centavos: 20, merma_bp: 0 }] },
    });
    render(<PantallaCierre />);
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre del día' }));
    expect(api.cerrarDia).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar definitivamente' }));
    expect(await screen.findByText('Día cerrado')).toBeVisible();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('compara períodos y muestra días sin ventas en el gráfico', async () => {
    vi.mocked(api.reporteVentas).mockImplementation(async (desde, hasta) => {
      const importe = hasta === fecha ? 500 : 250;
      return { desde, hasta, total_centavos: importe,
        dias: [{ fecha: hasta, por_producto: [{ producto_id: producto.id, unidades: 5, total_centavos: importe }] }] };
    });
    vi.mocked(api.reporteMerma).mockImplementation(async (desde, hasta) => ({
      desde, hasta, actualizado_en: '', dias: [], total_merma_centavos: 0,
    }));
    render(<PantallaReportes />);
    expect(await screen.findAllByText(/100.*frente al período anterior/)).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: /\$0\.00/ })).toHaveLength(6);
    expect(api.reporteVentas).toHaveBeenCalledWith(sumarDias(fecha, -13), sumarDias(fecha, -7));
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
  });
});
