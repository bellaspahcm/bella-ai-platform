import fs from 'fs';
import path from 'path';

describe('Bella Interior RBAC navigation', () => {
  it('routes staff and permission settings to the authoritative Interior RBAC surface', () => {
    const settings = fs.readFileSync(path.join(process.cwd(), 'src/app/dashboard/settings/page.tsx'), 'utf8');
    expect(settings).toContain('isInterior ? <InteriorRbacSettingsNotice /> : <StaffManagementTab />');
    expect(settings).toContain('isInterior ? <InteriorRbacSettingsNotice /> : <PermissionsTab />');
    expect(settings).toContain('Cấu hình quyền legacy trong Settings không còn là nguồn phân quyền cho Interior.');
    expect(settings).toContain('href="/dashboard/interior/roles"');
  });

  it('exposes the role manager through Bella Interior navigation', () => {
    const sidebar = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/sidebar.tsx'), 'utf8');
    expect(sidebar).toContain("label: 'Nhân sự & Phân quyền', href: '/dashboard/interior/roles'");
  });
});
