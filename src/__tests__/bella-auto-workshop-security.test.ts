import fs from 'fs';
import path from 'path';

const root = process.cwd();

function expectSourceChain(source: string, chain: string[]): void {
  const pattern = chain.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^;]*?');
  expect(source).toMatch(new RegExp(pattern));
}

describe('Bella Auto workshop security repair', () => {
  it('reenables RLS and removes anonymous access for workshop tables', () => {
    const migration = fs.readFileSync(
      path.join(root, 'supabase/migrations/20261013090000_reenable_bella_auto_workshop_rls.sql'),
      'utf8'
    );

    expect(migration).toContain('ALTER TABLE public.auto_service_appointments ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE public.auto_repair_orders ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.auto_service_appointments FROM anon');
    expect(migration).toContain('REVOKE ALL ON TABLE public.auto_repair_orders FROM anon');
    expect(migration).toContain('public.get_auth_tenant_id()');
  });

  it('keeps direct workshop page mutations scoped by tenant', () => {
    const page = fs.readFileSync(
      path.join(root, 'src/app/dashboard/bella-auto/workshop/page.tsx'),
      'utf8'
    );

    expectSourceChain(page, [
      ".from('auto_service_appointments')",
      ".update({ status: 'checked_in' })",
      ".eq('id', appointmentId)",
      ".eq('tenant_id', tenantId)",
    ]);
    expectSourceChain(page, [
      ".from('auto_service_appointments')",
      ".update({ status: 'cancelled' })",
      ".eq('id', appointmentId)",
      ".eq('tenant_id', tenantId)",
    ]);
    expectSourceChain(page, [
      ".from('auto_service_appointments')",
      ".select('*')",
      ".eq('id', appointmentId)",
      ".eq('tenant_id', tenantId)",
    ]);
    expectSourceChain(page, [
      ".from('auto_service_appointments')",
      ".update({ status: 'in_progress' })",
      ".eq('id', appointmentId)",
      ".eq('tenant_id', tenantId)",
    ]);
    expectSourceChain(page, [
      ".from('auto_service_appointments')",
      'estimated_duration_hours: updatedData.estimatedDuration',
      ".eq('id', appointmentId)",
      ".eq('tenant_id', tenantId)",
    ]);
  });

  it('keeps service helper updates scoped by tenant', () => {
    const appointmentService = fs.readFileSync(
      path.join(root, 'src/modules/bella-auto/services/ServiceAppointmentService.ts'),
      'utf8'
    );
    const repairOrderService = fs.readFileSync(
      path.join(root, 'src/modules/bella-auto/services/RepairOrderService.ts'),
      'utf8'
    );

    expectSourceChain(appointmentService, [
      ".from('auto_service_appointments')",
      '.update({',
      'reminder_sent: true',
      ".eq('id', appointmentId)",
      ".eq('tenant_id', tenantId)",
    ]);
    expectSourceChain(repairOrderService, [
      ".from('auto_repair_orders')",
      ".select('additional_technicians')",
      ".eq('id', repairOrderId)",
      ".eq('tenant_id', tenantId)",
    ]);
    expectSourceChain(repairOrderService, [
      ".from('auto_repair_orders')",
      '.update(updateData)',
      ".eq('id', repairOrderId)",
      ".eq('tenant_id', tenantId)",
    ]);
  });
});
