import { readFileSync } from 'fs';
import * as path from 'path';

describe('AutoMove available vehicles route contract', () => {
  it('uses Mobility OS public contract instead of direct auto_vehicles access', () => {
    const routePath = path.resolve(
      __dirname,
      '../../../app/api/bella-auto/vehicles/available/route.ts'
    );
    const source = readFileSync(routePath, 'utf8');

    expect(source).toContain("from '@/platform/mobility'");
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
