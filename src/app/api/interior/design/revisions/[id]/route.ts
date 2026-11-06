import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { mockRevisions } from '../route';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DesignRevision as DomainDesignRevision } from '@/products/bella-interior/domain/design-specification/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Revision ID is required' },
      { status: 400 }
    );
  }

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const dbRevision = await repo.getDesignRevision(tenantId, id);
    if (dbRevision) {
      const roomZones = await repo.listRoomZones(tenantId, dbRevision.projectId);
      return NextResponse.json({
        success: true,
        data: {
          revision: dbRevision,
          roomZones,
        },
      });
    }
  } catch {
    // Database query failed; fall back to mock
  }

  const mockRev = mockRevisions.find((r) => r.id === id);
  if (!mockRev) {
    return NextResponse.json(
      { success: false, error: `Design revision not found: ${id}` },
      { status: 404 }
    );
  }

  const domainMockRevision: DomainDesignRevision = {
    id: mockRev.id,
    tenantId,
    projectId: mockRev.projectId,
    versionNumber: parseInt(mockRev.revisionNumber.replace(/[^0-9]/g, ''), 10) || 1,
    title: mockRev.revisionName,
    status: mockRev.status === 'approved' ? 'approved' : 'draft',
    submittedBy: mockRev.designedByUserId,
    submittedAt: mockRev.createdAt,
    approvedBy: mockRev.approvedByUserId ?? undefined,
    approvedAt: mockRev.approvedAt ?? undefined,
    assets: [
      {
        id: 'asset-01',
        tenantId,
        revisionId: mockRev.id,
        type: 'concept_3d',
        title: 'Phối cảnh 3D Phòng Khách & Bàn Đảo Bếp V2',
        fileUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
        notes: 'Veneer óc chó tự nhiên, vách đá Marble Calacatta, phụ kiện Blum',
      },
      {
        id: 'asset-02',
        tenantId,
        revisionId: mockRev.id,
        type: 'technical_2d',
        title: 'Mặt bằng bố trí kỹ thuật 2D',
        fileUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        notes: 'Mặt bằng bố trí thiết bị và định vị ổ cắm',
      },
    ],
    materialSpecs: [
      {
        id: 'spec-01',
        tenantId,
        revisionId: mockRev.id,
        itemCategory: 'wood_board',
        brand: 'An Cường',
        code: 'MS 440 EV',
        name: 'Veneer Óc Chó Bắc Mỹ',
        colorTone: 'Walnut Deep Brown',
        specDescription: 'Hoàn thiện sơn bóng mờ 50% PU cao cấp',
        approvedForUse: true,
      },
      {
        id: 'spec-02',
        tenantId,
        revisionId: mockRev.id,
        itemCategory: 'stone',
        brand: 'Vicostone',
        code: 'BQ8628 Nero Marquina',
        name: 'Đá Thạch Anh Nhân Tạo',
        colorTone: 'Black Marquina',
        specDescription: 'Dày 20mm bo mòi 45 độ',
        approvedForUse: true,
      },
      {
        id: 'spec-03',
        tenantId,
        revisionId: mockRev.id,
        itemCategory: 'hardware',
        brand: 'Blum Austria',
        code: 'Clip Top BLUMOTION 110',
        name: 'Bản Lề Giảm Chấn Thép',
        colorTone: 'Nikel Silver',
        specDescription: 'Bảo hành 5 năm cơ cấu đóng êm',
        approvedForUse: true,
      },
      {
        id: 'spec-04',
        tenantId,
        revisionId: mockRev.id,
        itemCategory: 'glass_metal',
        brand: 'EuroClass',
        code: 'SLIM-CHAMPAGNE-05',
        name: 'Khung Cánh Kính Slim',
        colorTone: 'Champagne Gold',
        specDescription: 'Kính xám khói cường lực 5mm viền nhôm anode champagne',
        approvedForUse: true,
      },
    ],
  };

  return NextResponse.json({
    success: true,
    data: {
      revision: domainMockRevision,
      roomZones: [
        {
          id: 'zone-01',
          tenantId,
          projectId: mockRev.projectId,
          code: 'R01_LIVING',
          name: 'Phòng Khách Luxury',
          floor: 1,
          areaSquareMeters: 65,
        },
        {
          id: 'zone-02',
          tenantId,
          projectId: mockRev.projectId,
          code: 'R02_KITCHEN',
          name: 'Bếp & Phòng Ăn',
          floor: 1,
          areaSquareMeters: 45,
        },
      ],
    },
  });
}

