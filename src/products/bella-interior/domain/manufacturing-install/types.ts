/**
 * Bounded Context 3: Manufacturing & Installation
 *
 * Manages custom millwork & cabinetry workshop production orders, woodworking stages,
 * workshop QC, dispatching, and job-site installation across room zones.
 *
 * @module src/products/bella-interior/domain/manufacturing-install
 */

export type WorkshopMode = 'in_house' | 'outsourced';

export type WorkshopOperationStage =
  | 'queued'          // Chờ xếp lịch xưởng
  | 'cutting_cnc'     // Cắt CNC ván
  | 'edge_banding'    // Dán cạnh tự động (PUR / EVA)
  | 'drilling'        // Khoan cam chốt định vị liên kết
  | 'pre_assembly'    // Lắp ráp module / thùng tủ
  | 'finishing'       // Sơn hoàn thiện (sơn bệt Inchem / lau dầu dưỡng gỗ)
  | 'workshop_qc'     // Kiểm tra chất lượng tại xưởng
  | 'packed'          // Đóng gói bọc màng PE & góc carton
  | 'dispatched';     // Đã xuất xưởng lên xe công trình

export interface ProductionOrderItem {
  readonly id: string;
  readonly tenantId: string;
  readonly productionOrderId: string;
  readonly boqItemId: string;
  readonly roomZoneName: string;
  readonly itemName: string;
  readonly quantity: number;
  readonly unit: string;
  readonly dimensionsSummary: string;
  readonly materialSummary: string;
  readonly currentStage: WorkshopOperationStage;
  readonly qcPassed: boolean;
  readonly qcNotes?: string;
}

export type ProductionOrderStatus =
  | 'order_released'    // Đã phát lệnh sản xuất từ bản vẽ duyệt
  | 'in_production'     // Đang chạy các công đoạn xưởng
  | 'partially_packed'  // Một phần đã đóng gói
  | 'ready_for_dispatch'// Toàn bộ đã đóng gói & QC đạt
  | 'dispatched'        // Đã xuất xưởng đến công trình
  | 'completed'         // Đã hoàn tất và nghiệm thu tại công trình
  | 'cancelled';

export interface ProductionOrder {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly designRevisionId: string; // INVARIANT: Must be APPROVED revision
  readonly boqId: string;
  readonly orderNumber: string;      // e.g. 'PO-INT-2026-001'
  readonly mode: WorkshopMode;
  readonly subcontractorName?: string;
  readonly status: ProductionOrderStatus;
  readonly scheduledStartDate: string;
  readonly scheduledCompletionDate: string;
  readonly actualDispatchedDate?: string;
  readonly workshopManagerName: string;
  readonly items: ProductionOrderItem[];
  readonly notes?: string;
}

export type SiteRoomInstallStatus =
  | 'not_delivered'
  | 'delivered_pending_install'
  | 'installing'
  | 'installed_pending_qc'
  | 'completed';

export interface SiteRoomInstallation {
  readonly id: string;
  readonly tenantId: string;
  readonly planId: string;
  readonly roomZoneId: string;
  readonly roomZoneName: string;
  readonly status: SiteRoomInstallStatus;
  readonly installerTeamLeader: string;
  readonly progressPercent: number; // 0 - 100
  readonly targetInstallDate: string;
  readonly completedDate?: string;
}

export interface SiteInstallationPlan {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly planNumber: string;
  readonly siteSupervisorId: string;
  readonly siteSupervisorName: string;
  readonly scheduledStartDate: string;
  readonly scheduledEndDate: string;
  readonly rooms: SiteRoomInstallation[];
  readonly overallProgressPercent: number;
}

