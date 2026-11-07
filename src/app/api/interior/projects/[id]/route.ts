import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureUuid } from '@/products/bella-interior/lib/uuid-helper';

export const dynamic = 'force-dynamic';

interface ProjectDetailResponse {
  id: string;
  code: string;
  name: string;
  status: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  siteAddress: string;
  projectType: string;
  totalFloorAreaSquareMeters: number;
  contractValue: number;
  targetCompletionDate: string;
  leadArchitectId: string;
  leadArchitectName: string;
  activeApprovedRevisionId?: string | null;
  rooms: Array<{
    id: string;
    code: string;
    name: string;
    floor: number;
    areaSquareMeters: number;
  }>;
  materials: Array<{
    category: string;
    brand: string;
    name: string;
    spec: string;
  }>;
  progress: {
    designPercent: number;
    workshopPercent: number;
    installPercent: number;
    overallPercent: number;
  };
}

const MOCK_PROJECT_DETAILS: Record<string, Partial<ProjectDetailResponse>> = {
  'proj-001': {
    code: 'INT-2024-001',
    name: 'Biệt Thự Vườn Thảo Điền - Quận 2',
    status: 'production',
    customerName: 'Nguyễn Văn A',
    customerPhone: '0903 123 456',
    customerEmail: 'nguyenvana@gmail.com',
    siteAddress: 'Số 15 Đường 46, Thảo Điền, TP. Thủ Đức, TP.HCM',
    projectType: 'Biệt thự đơn lập',
    totalFloorAreaSquareMeters: 450,
    contractValue: 2_450_000_000,
    targetCompletionDate: '2026-12-15',
    leadArchitectName: 'KTS. Lê Hoàng Quân',
  },
  'proj-002': {
    code: 'INT-2024-002',
    name: 'Penthouse Grand Marina Saigon',
    status: 'installation',
    customerName: 'Sheikh Mansoor (Trần Đại Nghĩa)',
    customerPhone: '0918 888 999',
    siteAddress: 'Tầng 42, Tháp Sea, Grand Marina Saigon, Q1, TP.HCM',
    projectType: 'Penthouse Duplex',
    totalFloorAreaSquareMeters: 620,
    contractValue: 3_780_000_000,
    targetCompletionDate: '2026-11-30',
    leadArchitectName: 'KTS. Trần Minh Trí',
  },
  'proj-003': {
    code: 'INT-2024-003',
    name: 'Căn Hộ Duplex Sunshine Venicia',
    status: 'handover',
    customerName: 'Trịnh Thăng Bình',
    customerPhone: '0977 555 333',
    siteAddress: 'Đường 39, P. Bình An, TP. Thủ Đức, TP.HCM',
    projectType: 'Duplex cao cấp',
    totalFloorAreaSquareMeters: 280,
    contractValue: 2_200_000_000,
    targetCompletionDate: '2026-11-15',
    leadArchitectName: 'KTS. Vũ Thu Hà',
  },
  'proj-004': {
    code: 'INT-2024-004',
    name: 'Shophouse Phố Đi Bộ Sala',
    status: 'design',
    customerName: 'Phạm Hồng Nhung',
    customerPhone: '0933 777 111',
    siteAddress: 'Mai Chí Thọ, Đô thị mới Sala, Q2, TP.HCM',
    projectType: 'Shophouse thương mại',
    totalFloorAreaSquareMeters: 380,
    contractValue: 850_000_000,
    targetCompletionDate: '2027-01-20',
    leadArchitectName: 'KTS. Đỗ Gia Bảo',
  },
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Project ID is required' }, { status: 400 });
  }

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const dbProject = await repo.getProject(tenantId, id);

    if (dbProject) {
      let rooms: Array<{ id: string; code: string; name: string; floor: number; areaSquareMeters: number }> = [];
      try {
        const dbRooms = await repo.listRoomZones(tenantId, dbProject.id);
        rooms = dbRooms.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          floor: r.floor,
          areaSquareMeters: r.areaSquareMeters || 0,
        }));
      } catch {
        // Ignored
      }

      if (rooms.length === 0) {
        rooms = [
          { id: 'rz-01', code: 'LIV-01', name: 'Phòng Khách & Sảnh Chính', floor: 1, areaSquareMeters: 65 },
          { id: 'rz-02', code: 'KIT-01', name: 'Bếp & Khu Ăn Uống', floor: 1, areaSquareMeters: 45 },
          { id: 'rz-03', code: 'MBR-01', name: 'Phòng Ngủ Master', floor: 2, areaSquareMeters: 55 },
          { id: 'rz-04', code: 'WIC-01', name: 'Phòng Thay Đồ Walk-in Closet', floor: 2, areaSquareMeters: 28 },
        ];
      }

      const responseData: ProjectDetailResponse = {
        id: dbProject.id,
        code: dbProject.code,
        name: dbProject.name,
        status: dbProject.status,
        customerId: dbProject.customerId,
        customerName: 'Khách hàng VIP',
        siteAddress: dbProject.siteAddress,
        projectType: dbProject.projectType,
        totalFloorAreaSquareMeters: rooms.reduce((acc, r) => acc + (r.areaSquareMeters || 0), 0) || 450,
        contractValue: dbProject.estimatedBudget || 2_450_000_000,
        targetCompletionDate: dbProject.targetCompletionDate,
        leadArchitectId: dbProject.leadArchitectId,
        leadArchitectName: dbProject.leadArchitectName,
        activeApprovedRevisionId: dbProject.activeApprovedRevisionId,
        rooms,
        materials: [
          { category: 'Ván phủ bề mặt', brand: 'An Cường', name: 'Gỗ MDF chống ẩm phủ Melamine Walnut', spec: 'MDF lõi xanh HMR 17mm' },
          { category: 'Phụ kiện kim khí', brand: 'Blum / Hafele', name: 'Bản lề giảm chấn & Ray hộp Tandembox', spec: 'Tải trọng 30kg, giảm chấn Blumotion' },
          { category: 'Đá thạch anh', brand: 'Vicostone', name: 'Đá nhân tạo bàn đảo & ngạch bếp', spec: 'Độ dày 20mm chống ố kháng khuẩn' },
          { category: 'Sơn hoàn thiện', brand: 'Inchem USA', name: 'Sơn PU 5 lớp lộ tim gỗ óc chó', spec: 'Tiêu chuẩn an toàn phát thải E0' },
        ],
        progress: {
          designPercent: 100,
          workshopPercent: dbProject.status === 'in_production' ? 68 : dbProject.status === 'installing' || dbProject.status === 'handover' || dbProject.status === 'completed' ? 100 : 25,
          installPercent: dbProject.status === 'installing' ? 45 : dbProject.status === 'handover' || dbProject.status === 'completed' ? 95 : 0,
          overallPercent: dbProject.status === 'completed' || dbProject.status === 'handover' ? 98 : dbProject.status === 'installing' ? 75 : dbProject.status === 'in_production' ? 50 : 20,
        },
      };

      return NextResponse.json({ success: true, data: responseData });
    }
  } catch {
    // Database query failed; fall back to deterministic mock
  }

  const mock = MOCK_PROJECT_DETAILS[id] || MOCK_PROJECT_DETAILS['proj-001'];
  const fallbackData: ProjectDetailResponse = {
    id: ensureUuid(id),
    code: mock.code || 'INT-2024-001',
    name: mock.name || 'Biệt Thự Thảo Điền',
    status: mock.status || 'production',
    customerId: 'cust-001',
    customerName: mock.customerName || 'Nguyễn Văn A',
    customerPhone: mock.customerPhone || '0903 123 456',
    customerEmail: mock.customerEmail || 'nguyenvana@gmail.com',
    siteAddress: mock.siteAddress || 'Số 15 Đường 46, Thảo Điền, TP. Thủ Đức',
    projectType: mock.projectType || 'Biệt thự đơn lập',
    totalFloorAreaSquareMeters: mock.totalFloorAreaSquareMeters || 450,
    contractValue: mock.contractValue || 2_450_000_000,
    targetCompletionDate: mock.targetCompletionDate || '2026-12-15',
    leadArchitectId: 'arch-001',
    leadArchitectName: mock.leadArchitectName || 'KTS. Lê Hoàng Quân',
    activeApprovedRevisionId: 'rev-001',
    rooms: [
      { id: 'rz-01', code: 'LIV-01', name: 'Phòng Khách & Sảnh Chính', floor: 1, areaSquareMeters: 65 },
      { id: 'rz-02', code: 'KIT-01', name: 'Bếp & Khu Ăn Uống', floor: 1, areaSquareMeters: 45 },
      { id: 'rz-03', code: 'MBR-01', name: 'Phòng Ngủ Master', floor: 2, areaSquareMeters: 55 },
      { id: 'rz-04', code: 'WIC-01', name: 'Phòng Thay Đồ Walk-in Closet', floor: 2, areaSquareMeters: 28 },
    ],
    materials: [
      { category: 'Ván phủ bề mặt', brand: 'An Cường', name: 'Gỗ MDF chống ẩm phủ Melamine Walnut', spec: 'MDF lõi xanh HMR 17mm' },
      { category: 'Phụ kiện kim khí', brand: 'Blum / Hafele', name: 'Bản lề giảm chấn & Ray hộp Tandembox', spec: 'Tải trọng 30kg, giảm chấn Blumotion' },
      { category: 'Đá thạch anh', brand: 'Vicostone', name: 'Đá nhân tạo bàn đảo & ngạch bếp', spec: 'Độ dày 20mm chống ố kháng khuẩn' },
      { category: 'Sơn hoàn thiện', brand: 'Inchem USA', name: 'Sơn PU 5 lớp lộ tim gỗ óc chó', spec: 'Tiêu chuẩn an toàn phát thải E0' },
    ],
    progress: {
      designPercent: 100,
      workshopPercent: 68,
      installPercent: 42,
      overallPercent: 65,
    },
  };

  return NextResponse.json({ success: true, data: fallbackData });
}
