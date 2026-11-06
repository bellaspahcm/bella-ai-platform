/**
 * Bounded Context 4: Project Delivery & Aftercare
 *
 * Manages daily site diaries, field issues, QC inspections & punch lists,
 * client acceptance handover dossiers, warranty certificates and service tickets.
 *
 * @module src/products/bella-interior/domain/delivery-aftercare
 */

export interface SiteDiaryEntry {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly date: string;
  readonly weather: string;
  readonly laborHeadcount: number;
  readonly activitiesCompleted: string[];
  readonly materialDelivered: string[];
  readonly issuesNoted?: string;
  readonly supervisorName: string;
  readonly photoUrls: string[];
}

export type DefectSeverity = 'minor' | 'major' | 'critical';

export type DefectCategory =
  | 'misaligned_door'     // Cánh tủ bị lệch khe hở
  | 'scratched_surface'   // Trầy xước sơn / Melamine / Acrylic
  | 'color_mismatch'      // Sai lệch sắc độ màu so với mẫu duyệt
  | 'hardware_defect'     // Bản lề / ray trượt bị kẹt hoặc kêu
  | 'stone_seam_flaw'     // Đường ghép đá không khít / lộ mạch
  | 'lighting_failure'    // Đèn LED không sáng / hỏng nguồn
  | 'missing_accessory'   // Thiếu phụ kiện (tay nắm, ray chia gia vị)
  | 'dimensional_error';  // Kích thước sai lệch so với hiện trạng

export type PunchListStatus =
  | 'open'
  | 'in_progress'
  | 'rectified'
  | 'verified';

export interface QCPunchListItem {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly roomZoneName: string;
  readonly itemName: string;
  readonly defectCategory: DefectCategory;
  readonly description: string;
  readonly severity: DefectSeverity;
  readonly photoUrl?: string;
  readonly assignedFixer: string; // Tên thợ hoặc xưởng chịu trách nhiệm
  readonly deadline: string;
  readonly status: PunchListStatus;
  readonly rectificationNote?: string;
  readonly verifiedBy?: string;
  readonly verifiedAt?: string;
}

export type HandoverStatus =
  | 'pending_inspection'
  | 'punch_list_rectification'
  | 'ready_for_handover'
  | 'completed';

export interface HandoverDossier {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly contractId: string;
  readonly handoverDate: string;
  readonly status: HandoverStatus;
  readonly totalPunchListItems: number;
  readonly openPunchListItems: number;
  readonly clientAccepted: boolean;
  readonly clientSignoffName?: string;
  readonly finalSettlementValue: number;
  readonly dossierDocumentUrl?: string;
}

export interface WarrantyCertificate {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly contractId: string;
  readonly certificateNumber: string;
  readonly customerName: string;
  readonly siteAddress: string;
  readonly effectiveDate: string;
  readonly expirationDate: string;
  readonly woodworkWarrantyMonths: number;  // Thường 24 tháng cho phần gỗ
  readonly hardwareWarrantyMonths: number;  // Thường 36 - 60 tháng cho phụ kiện Blum/Hafele
  readonly stoneWarrantyMonths: number;     // Thường 120 tháng cho đá Vicostone
  readonly termsSummary: string;
}

export type WarrantyTicketStatus =
  | 'submitted'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export interface WarrantyServiceTicket {
  readonly id: string;
  readonly tenantId: string;
  readonly certificateId: string;
  readonly projectId: string;
  readonly ticketNumber: string;
  readonly reportedDate: string;
  readonly customerReport: string;
  readonly roomZoneName: string;
  readonly itemName: string;
  readonly defectCategory: DefectCategory;
  readonly status: WarrantyTicketStatus;
  readonly assignedTechnician?: string;
  readonly scheduledFixDate?: string;
  readonly resolvedDate?: string;
  readonly resolutionDetails?: string;
  readonly supplierChargebackEligible?: boolean;
}

