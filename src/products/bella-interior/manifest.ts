/**
 * BELLA INTERIOR OS — PRODUCT & VERTICAL MANIFEST
 *
 * Single Source of Truth declaring capabilities, bounded contexts,
 * workflows, and UI navigation for the Bella Interior OS.
 *
 * @module src/products/bella-interior/manifest
 */

import type { VerticalManifest } from '@/platform/registry/vertical-registry';

export const bellaInteriorManifest: VerticalManifest & {
  id: string;
  capabilities: string[];
  boundedContexts: string[];
} = {
  id: 'bella-interior',
  key: 'bella_interior',
  name: 'Bella Interior OS',
  version: '1.0.0',
  themeKey: 'graphite_luxe',
  defaultRoute: '/dashboard/interior',
  boundedContexts: [
    'design_specification',
    'commercial_costing',
    'manufacturing_installation',
    'project_delivery_aftercare',
  ],
  capabilities: [
    'interior_project_management',
    'interior_design_revision_lock',
    'interior_boq_tripartite_estimation',
    'interior_contract_milestones',
    'interior_workshop_production_order',
    'interior_site_installation_planning',
    'interior_qc_punch_list',
    'interior_handover_acceptance',
    'interior_project_pl_margin',
    'interior_warranty_care',
  ],
  enabledCapabilities: [
    'interior_project_management',
    'interior_design_revision_lock',
    'interior_boq_tripartite_estimation',
    'interior_contract_milestones',
    'interior_workshop_production_order',
    'interior_site_installation_planning',
    'interior_qc_punch_list',
    'interior_handover_acceptance',
    'interior_project_pl_margin',
    'interior_warranty_care',
  ],
  menus: [
    { id: 'overview', label: 'Tổng quan & Tiến độ', href: '/dashboard/interior', icon: 'LayoutDashboard' },
    { id: 'design', label: 'Thiết kế & Bản vẽ', href: '/dashboard/interior/design', icon: 'Layers' },
    { id: 'boq', label: 'Bóc tách BOQ & Dự toán', href: '/dashboard/interior/boq', icon: 'ClipboardList' },
    { id: 'contracts', label: 'Báo giá & Hợp đồng', href: '/dashboard/interior/contracts', icon: 'FileText' },
    { id: 'production', label: 'Sản xuất Xưởng', href: '/dashboard/interior/production', icon: 'Wrench' },
    { id: 'installation', label: 'Thi công & Lắp đặt', href: '/dashboard/interior/installation', icon: 'Building2' },
    { id: 'qc', label: 'Kiểm tra QC & Punch List', href: '/dashboard/interior/qc-handover', icon: 'ShieldCheck' },
    { id: 'handover', label: 'Nghiệm thu & Bàn giao', href: '/dashboard/interior/handover', icon: 'Award' },
    { id: 'finance', label: 'Lợi nhuận P&L Dự án', href: '/dashboard/interior/finance', icon: 'LineChart' },
    { id: 'warranty', label: 'Bảo hành & Hậu mãi', href: '/dashboard/interior/warranty', icon: 'Heart' },
  ],
};

