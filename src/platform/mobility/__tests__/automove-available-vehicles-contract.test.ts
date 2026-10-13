import { readFileSync } from 'fs';
import * as path from 'path';

describe('AutoMove available vehicles route contract', () => {
  it('uses Mobility OS public contract instead of direct auto_vehicles access', () => {
    const routePath = path.resolve(
      __dirname,
      '../../../app/api/bella-auto/vehicles/available/route.ts'
    );
    const source = readFileSync(routePath, 'utf8');

    expect(source).toContain("from '@/platform/mobility/supabase-vehicle-contract'");
    expect(source).toContain('listAvailableVehiclesForVariant');
    expect(source).not.toContain(".from('auto_vehicles')");
    expect(source).not.toContain('.from("auto_vehicles")');
  });

  it('preserves the legacy API response shape at the AutoMove boundary', () => {
    const routePath = path.resolve(
      __dirname,
      '../../../app/api/bella-auto/vehicles/available/route.ts'
    );
    const source = readFileSync(routePath, 'utf8');

    expect(source).toContain('color_exterior: vehicle.colorExterior');
  });
});

describe('AutoMove inventory provider Mobility contract usage', () => {
  it('moves vehicle inventory read-side access behind the Mobility public contract', () => {
    const providerPath = path.resolve(
      __dirname,
      '../../../modules/bella-auto/services/AutoInventoryProvider.ts'
    );
    const source = readFileSync(providerPath, 'utf8');
    const readSideStart = source.indexOf('async getSummary');
    const writeSideStart = source.indexOf('async addVehicle');
    const inventoryReadSideSource = source.slice(readSideStart, writeSideStart);
    const statusHistoryStart = source.indexOf('async getStatusHistory');
    const statusHistorySource = source.slice(statusHistoryStart);

    expect(source).toContain("from '@/platform/mobility/supabase-vehicle-contract'");
    expect(inventoryReadSideSource).toContain('getMobilityVehicleInventorySummary');
    expect(inventoryReadSideSource).toContain('listMobilityVehicleInventory');
    expect(inventoryReadSideSource).not.toContain(".from('auto_vehicles')");
    expect(inventoryReadSideSource).not.toContain('.from("auto_vehicles")');
    expect(statusHistorySource).toContain('listMobilityVehicleStatusHistory');
    expect(statusHistorySource).not.toContain(".from('auto_vehicle_status_logs')");
    expect(statusHistorySource).not.toContain('.from("auto_vehicle_status_logs")');
  });

  it('keeps the vehicle inventory client page from importing the provider runtime', () => {
    const pagePath = path.resolve(
      __dirname,
      '../../../app/dashboard/bella-auto/vehicles/page.tsx'
    );
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain("import type { VehicleInventoryItem }");
    expect(source).not.toContain('import { AutoInventoryProvider');
  });

  it('moves the dashboard inventory read-side access behind the Mobility public contract', () => {
    const dashboardPath = path.resolve(
      __dirname,
      '../../../components/bella-auto/VehicleInventoryDashboard.tsx'
    );
    const source = readFileSync(dashboardPath, 'utf8');

    expect(source).toContain("from '@/platform/mobility/supabase-vehicle-contract'");
    expect(source).toContain('listMobilityVehicleInventoryPage');
    expect(source).toContain('getMobilityVehicleInventorySummary');
    expect(source).not.toContain(".from('auto_vehicles')");
    expect(source).not.toContain('.from("auto_vehicles")');
  });

  it('moves the dashboard shell vehicle stats behind the Mobility public contract', () => {
    const pagePath = path.resolve(__dirname, '../../../app/dashboard/bella-auto/page.tsx');
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain("from '@/platform/mobility/supabase-vehicle-contract'");
    expect(source).toContain('getMobilityVehicleInventorySummary');
    expect(source).not.toContain(".from('auto_vehicles')");
    expect(source).not.toContain('.from("auto_vehicles")');
  });

  it('moves customer ownership vehicle reads behind the Mobility public contract', () => {
    const providerPath = path.resolve(
      __dirname,
      '../../../modules/bella-auto/services/AutoCustomerProvider.ts'
    );
    const source = readFileSync(providerPath, 'utf8');

    expect(source).toContain("from '@/platform/mobility/supabase-vehicle-contract'");
    expect(source).toContain('listMobilityCustomerOwnedVehicles');
    expect(source).toContain('getMobilityCustomerOwnershipAggregate');
    expect(source).not.toContain(".from('auto_vehicles')");
    expect(source).not.toContain('.from("auto_vehicles")');
  });
});
