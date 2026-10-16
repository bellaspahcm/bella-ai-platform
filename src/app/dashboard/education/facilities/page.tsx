'use client';

/**
 * Bella Preschool OS — P9 Facilities & Asset Maintenance Command Center
 * File: src/app/dashboard/education/facilities/page.tsx
 *
 * Provides Facilities & Space Hierarchy Management, QR Asset Identity,
 * Safety Inspection Invariants, Maintenance Job Lifecycle,
 * Exception Work Queue Reuse #3, and Read-Only ZoneAvailabilityContract Publishing.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { 
  Building2, 
  Wrench, 
  ArrowLeft, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  QrCode, 
  Plus, 
  Flame, 
  Layers, 
  RefreshCw, 
  Activity, 
  ShieldAlert,
  Clock,
  Check,
  X
} from 'lucide-react';

import { PreschoolFacilitiesRepository } from '@/products/bella-education/facilities/repositories/preschool-facilities.repository';
import { FacilityZoneService } from '@/products/bella-education/facilities/services/facility-zone.service';
import { SafetyInspectionService } from '@/products/bella-education/facilities/services/safety-inspection.service';
import { MaintenanceJobService } from '@/products/bella-education/facilities/services/maintenance-job.service';
import { FacilitiesProjectionBridge } from '@/products/bella-education/facilities/bridges/facilities-projection.bridge';
import { ParentCommunicationRepository } from '@/products/bella-education/parent-engagement/repositories/parent-communication.repository';
import { CommunicationExceptionService } from '@/products/bella-education/parent-engagement/services/communication-exception.service';
import type { CommunicationException } from '@/products/bella-education/parent-engagement/domain/communication.types';
import { 
  Facility, 
  FacilityZone, 
  FacilityAsset, 
  InspectionLog, 
  MaintenanceJob, 
  ZoneAvailabilityDTO 
} from '@/products/bella-education/facilities/domain/facilities.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_INSPECTOR_ID = '00000000-0000-0000-0000-000000000071';
const DEFAULT_TECHNICIAN_ID = '00000000-0000-0000-0000-000000000072';

function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : String(message);
  }

  return undefined;
}

export default function FacilitiesPage() {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SPACES' | 'ASSETS' | 'INSPECTIONS' | 'MAINTENANCE'>('OVERVIEW');
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Core Domain State
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [zones, setZones] = useState<FacilityZone[]>([]);
  const [assets, setAssets] = useState<FacilityAsset[]>([]);
  const [inspections, setInspections] = useState<InspectionLog[]>([]);
  const [maintenanceJobs, setMaintenanceJobs] = useState<MaintenanceJob[]>([]);
  const [exceptions, setExceptions] = useState<CommunicationException[]>([]);
  const [zoneAvailability, setZoneAvailability] = useState<ZoneAvailabilityDTO | null>(null);

  // Services
  const facRepo = new PreschoolFacilitiesRepository(supabase);
  const zoneService = new FacilityZoneService(facRepo);
  const commRepo = new ParentCommunicationRepository(supabase);
  const exceptionService = new CommunicationExceptionService(commRepo);
  const bridge = new FacilitiesProjectionBridge(commRepo, exceptionService);
  const inspectionService = new SafetyInspectionService(facRepo, zoneService, bridge);
  const maintenanceService = new MaintenanceJobService(facRepo);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Facilities
      const facs = await facRepo.listFacilities(DEFAULT_TENANT_ID);
      setFacilities(facs);

      // 2. Load Zones
      const zList = await facRepo.listZones(DEFAULT_TENANT_ID);
      setZones(zList);

      // 3. Load Assets
      const aList = await facRepo.listAssets(DEFAULT_TENANT_ID);
      setAssets(aList);

      // 4. Load Inspections
      if (zList.length > 0) {
        const iList = await facRepo.listInspectionLogs(DEFAULT_TENANT_ID, zList[0].id);
        setInspections(iList);

        // Load Zone Availability DTO for first zone
        const avail = await zoneService.getZoneAvailability(DEFAULT_TENANT_ID, zList[0].id);
        setZoneAvailability(avail);
      } else {
        setInspections([]);
        setZoneAvailability(null);
      }

      // 5. Load Maintenance Jobs
      if (zList.length > 0) {
        const jobs = await facRepo.listMaintenanceJobs(DEFAULT_TENANT_ID, zList[0].id);
        setMaintenanceJobs(jobs);
      } else {
        setMaintenanceJobs([]);
      }

      // 6. Load Work Queue Exceptions
      const excs = await exceptionService.getStaffWorkQueueExceptions(DEFAULT_TENANT_ID);
      setExceptions(excs);
    } catch (err) {
      console.error('Failed to load facilities data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handler 1: Seed Initial Facility, Space & Asset Data
  const handleSeedFacility = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      // 1. Clean up active logs, jobs, and exceptions for clean test run
      await supabase.from('edu_fac_maintenance_jobs').delete().eq('tenant_id', DEFAULT_TENANT_ID);
      await supabase.from('edu_fac_inspection_logs').delete().eq('tenant_id', DEFAULT_TENANT_ID);
      await supabase.from('edu_fac_out_of_service_logs').delete().eq('tenant_id', DEFAULT_TENANT_ID);
      await supabase.from('edu_comm_exceptions').delete().eq('tenant_id', DEFAULT_TENANT_ID);

      // 2. Ensure Main Facility exists
      let facList = await facRepo.listFacilities(DEFAULT_TENANT_ID);
      let fac = facList[0];
      if (!fac) {
        fac = await zoneService.createFacility({
          tenantId: DEFAULT_TENANT_ID,
          name: 'Cơ Sở 1 — Tòa Nhà Trung Tâm',
          code: 'CS1-MAIN',
          address: '123 Nguyễn Văn Cừ, Q.5, TP.HCM',
        });
      }

      // 3. Ensure Playground Zone exists and is OPERATIONAL
      let zList = await facRepo.listZones(DEFAULT_TENANT_ID);
      let zone = zList[0];
      if (!zone) {
        zone = await zoneService.createZone({
          tenantId: DEFAULT_TENANT_ID,
          facilityId: fac.id,
          name: 'Sân Chơi Ngoài Trời Trung Tâm',
          zoneType: 'PLAYGROUND',
          maxOccupancy: 50,
          operationalStatus: 'OPERATIONAL',
          restrictionScope: 'ZONE',
        });
      } else {
        await facRepo.updateZoneStatus(DEFAULT_TENANT_ID, zone.id, 'OPERATIONAL', 'ZONE');
      }

      // 4. Ensure Playground Asset exists and is OPERATIONAL
      let aList = await facRepo.listAssets(DEFAULT_TENANT_ID);
      let asset = aList[0];
      if (!asset) {
        asset = await zoneService.createAsset({
          tenantId: DEFAULT_TENANT_ID,
          zoneId: zone.id,
          name: 'Khu Vui Chơi Liên Hoàn - Xích Đu Sắt',
          assetCategory: 'PLAY_EQUIPMENT',
          serialNumber: 'AST-PLAY-01',
          inspectionIntervalDays: 7,
          operationalStatus: 'OPERATIONAL',
          restrictionScope: 'ZONE',
        });
      } else {
        await facRepo.updateAssetStatus(DEFAULT_TENANT_ID, asset.id, 'OPERATIONAL', 'ZONE', new Date().toISOString());
      }

      setActionMessage('✅ Đã khởi tạo Cơ sở vật chất, Khu vui chơi ngoài trời & Thiết bị mẫu thành công!');
      await loadData();
    } catch (err) {
      console.error('Seed facility error:', err);
      setActionMessage(`❌ Lỗi khởi tạo cơ sở vật chất: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler 2: Report Critical Defect (FAIL_CRITICAL Safety Inspection)
  const handleReportCriticalDefect = async () => {
    if (assets.length === 0 || zones.length === 0) {
      setActionMessage('⚠️ Vui lòng nhấn nút "Khởi Tạo Cơ Sở Vật Chất Mẫu" trước!');
      return;
    }
    setLoading(true);
    setActionMessage(null);
    try {
      const targetAsset = assets[0];
      const targetZone = zones[0];

      await inspectionService.executeInspection({
        tenantId: DEFAULT_TENANT_ID,
        zoneId: targetZone.id,
        assetId: targetAsset.id,
        inspectorPartyId: DEFAULT_INSPECTOR_ID,
        inspectionDate: new Date().toISOString().split('T')[0],
        resultStatus: 'FAIL_CRITICAL',
        checklistAnswers: [
          { key: 'STRUCTURAL_INTEGRITY', question: 'Mối nối kim loại', passed: false, notes: 'Phát hiện mối hàn nứt 20%' },
        ],
        remarks: 'Phát hiện rủi ro an toàn nghiêm trọng trên xích đu ngoài trời',
        restrictionScope: 'ZONE',
      });

      // Create maintenance job for critical defect
      await maintenanceService.createJob({
        tenantId: DEFAULT_TENANT_ID,
        zoneId: targetZone.id,
        assetId: targetAsset.id,
        title: 'Sửa chữa xích đu sắt bị nứt mối hàn',
        priority: 'CRITICAL',
        reportedByPartyId: DEFAULT_INSPECTOR_ID,
      });

      setActionMessage('⚠️ Phát hiện Sự cố An toàn Critical! Thiết bị & Khu vui chơi đã bị OUT OF SERVICE ➔ Cảnh báo SAFETY_DEFECT đã gửi sang Exception Work Queue!');
      await loadData();
    } catch (err) {
      setActionMessage(`❌ Lỗi báo cáo sự cố an toàn: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler 3: Resolve Exception in Work Queue
  const handleResolveException = async (exceptionId: string) => {
    setLoading(true);
    setActionMessage(null);
    try {
      await exceptionService.resolveException({
        tenantId: DEFAULT_TENANT_ID,
        exceptionId,
        resolvedBy: DEFAULT_INSPECTOR_ID,
        resolutionNotes: 'Đã tiếp nhận cảnh báo an toàn và tạo Work Order phân công kỹ thuật sửa chữa.',
      });

      setActionMessage('ℹ️ Đã đóng Exception trong Work Queue! (Lưu ý: Luật An Toàn — Thiết bị VẪN GIỮ trạng thái OUT_OF_SERVICE cho đến khi hoàn thành sửa chữa & kiểm định lại!)');
      await loadData();
    } catch (err) {
      setActionMessage(`❌ Lỗi xử lý Exception: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler 4: Complete Maintenance Job
  const handleCompleteMaintenance = async () => {
    if (maintenanceJobs.length === 0) {
      setActionMessage('⚠️ Không có Work Order bảo trì nào đang hoạt động!');
      return;
    }
    setLoading(true);
    setActionMessage(null);
    try {
      const job = maintenanceJobs[0];
      await maintenanceService.completeJob(
        DEFAULT_TENANT_ID,
        job.id,
        'Đã thay mới bộ xích đu và hàn gia cố chịu lực 500kg'
      );

      // Transition asset/zone to UNDER_INSPECTION
      const entityId = job.assetId || job.zoneId;
      const entityType = job.assetId ? 'ASSET' : 'ZONE';
      await zoneService.markUnderInspection(DEFAULT_TENANT_ID, entityType, entityId);

      setActionMessage('🛠️ Đã hoàn thành Work Order bảo trì! Trạng thái chuyển sang UNDER_INSPECTION ➔ Cần Kiểm định An toàn trước khi đưa vào vận hành!');
      await loadData();
    } catch (err) {
      setActionMessage(`❌ Lỗi hoàn thành bảo trì: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler 5: Pass Safety Re-Inspection
  const handlePassReinspection = async () => {
    if (assets.length === 0 || zones.length === 0) return;
    setLoading(true);
    setActionMessage(null);
    try {
      const targetAsset = assets[0];
      const targetZone = zones[0];

      await inspectionService.executeRestorationInspection({
        tenantId: DEFAULT_TENANT_ID,
        zoneId: targetZone.id,
        assetId: targetAsset.id,
        inspectorPartyId: DEFAULT_INSPECTOR_ID,
        inspectionDate: new Date().toISOString().split('T')[0],
        resultStatus: 'PASS',
        checklistAnswers: [
          { key: 'STRUCTURAL_INTEGRITY', question: 'Kiểm định xích đu mới', passed: true, notes: 'Đạt tiêu chuẩn an toàn PCCC & mầm non' },
        ],
        remarks: 'Kiểm định lại thành công sau bảo trì',
      });

      setActionMessage('✅ Kiểm định An toàn ĐẠT CHUẨN (PASS)! Thiết bị & Khu vui chơi đã KHÔI PHỤC trạng thái OPERATIONAL!');
      await loadData();
    } catch (err) {
      setActionMessage(`❌ Lỗi tái kiểm định an toàn: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const currentAsset = assets[0];
  const currentZone = zones[0];

  return (
    <div className="preschool-ui min-h-screen bg-background text-foreground p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header & Navigation */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/education" className="p-2 bg-background hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                <ArrowLeft size={18} />
              </Link>
              <h1 className="preschool-brand-heading text-3xl font-extrabold tracking-tight text-[var(--education-brand-ink)]">
                P9 Preschool Facilities & Asset Maintenance OS
              </h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1 ml-11">
              Quản lý Cấu Trúc Không Gian, Danh Mục Tài Sản Cá Thể, Kiểm Định An Toàn PCCC, Work Order & Safety Invariants
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground border border-primary/20 shadow-lg shadow-primary/20">
              <ShieldCheck size={14} /> P9.2 INTEGRATION VERIFIED
            </span>
            <button 
              onClick={loadData}
              disabled={loading}
              className="p-2.5 bg-background hover:bg-muted text-foreground rounded-lg border border-border transition flex items-center gap-2 text-xs"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            actionMessage.startsWith('✅') 
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200' 
              : actionMessage.startsWith('⚠️') || actionMessage.startsWith('🛠️')
              ? 'bg-amber-950/40 border-amber-800 text-amber-200'
              : 'bg-rose-950/40 border-rose-800 text-rose-200'
          }`}>
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-xs opacity-70 hover:opacity-100">Đóng</button>
          </div>
        )}

        {/* Actionable Metrics & Invariant Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 bg-background border border-border rounded-2xl">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trạng Thái Thiết Bị Cá Thể</div>
            <div className="mt-2 flex items-center justify-between">
              <span data-testid="asset-status-badge" className={`text-2xl font-bold ${
                currentAsset?.operationalStatus === 'OUT_OF_SERVICE'
                  ? 'text-rose-700 dark:text-rose-400'
                  : currentAsset?.operationalStatus === 'UNDER_INSPECTION'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}>
                {currentAsset?.operationalStatus || 'OPERATIONAL'}
              </span>
              {currentAsset?.operationalStatus === 'OUT_OF_SERVICE' ? (
                <AlertTriangle className="text-rose-700 dark:text-rose-400 animate-pulse" size={28} />
              ) : (
                <ShieldCheck className="text-emerald-700 dark:text-emerald-400" size={28} />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Mã QR: {currentAsset?.serialNumber || 'AST-PLAY-01'}
            </p>
          </div>

          <div className="p-5 bg-background border border-border rounded-2xl">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Zone Availability (P3/P8)</div>
            <div className="mt-2 flex items-center justify-between">
              <span data-testid="zone-availability-badge" className={`text-xl font-bold ${
                zoneAvailability?.availableForScheduling ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
              }`}>
                {zoneAvailability?.availableForScheduling ? 'AVAILABLE' : 'OUT_OF_SERVICE'}
              </span>
              <Building2 className={zoneAvailability?.availableForScheduling ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'} size={24} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Read-Only ZoneAvailabilityContract</p>
          </div>

          <div className="p-5 bg-background border border-border rounded-2xl">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Work Order Bảo Trì Active</div>
            <div className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">
              {maintenanceJobs.length} <span className="text-xs font-normal text-muted-foreground">Work Orders</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Trạng thái: {maintenanceJobs[0]?.status || 'NÓ/A'}
            </p>
          </div>

          <div className="p-5 bg-background border border-border rounded-2xl">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cảnh Báo Safety Work Queue</div>
            <div className="mt-2 text-2xl font-bold text-rose-700 dark:text-rose-400">
              {exceptions.filter(e => e.status === 'OPEN').length} <span className="text-xs font-normal text-muted-foreground">SAFETY_DEFECT</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Platform Reuse Candidate #3 Active</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border gap-8 overflow-x-auto">
          <button
            data-testid="tab-overview"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'OVERVIEW'
                ? 'border-primary/20 text-[var(--education-brand-ink)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity size={16} /> Tổng Quan Facilities
          </button>
          <button
            data-testid="tab-spaces"
            onClick={() => setActiveTab('SPACES')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'SPACES'
                ? 'border-primary/20 text-[var(--education-brand-ink)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building2 size={16} /> Không Gian & Zone Availability
          </button>
          <button
            data-testid="tab-assets"
            onClick={() => setActiveTab('ASSETS')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'ASSETS'
                ? 'border-primary/20 text-[var(--education-brand-ink)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <QrCode size={16} /> Danh Mục Tài Sản & QR ({assets.length})
          </button>
          <button
            data-testid="tab-inspections"
            onClick={() => setActiveTab('INSPECTIONS')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'INSPECTIONS'
                ? 'border-primary/20 text-[var(--education-brand-ink)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldAlert size={16} /> Kiểm Định An Toàn & Sub-Jobs
          </button>
          <button
            data-testid="tab-maintenance"
            onClick={() => setActiveTab('MAINTENANCE')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'MAINTENANCE'
                ? 'border-primary/20 text-[var(--education-brand-ink)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wrench size={16} /> Work Orders & Exception Work Queue
            {exceptions.filter(e => e.status === 'OPEN').length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-rose-900 text-rose-200 font-bold">
                {exceptions.filter(e => e.status === 'OPEN').length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-background p-4 rounded-xl border border-border">
              <span className="text-sm font-semibold text-foreground">
                Thao Tác Khởi Tạo & Kiểm Định An Toàn Nhanh
              </span>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  data-testid="btn-seed-facility"
                  onClick={handleSeedFacility}
                  disabled={loading}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium text-sm transition flex items-center gap-2 shadow-lg shadow-primary/20"
                >
                  <Plus size={16} /> Khởi Tạo Cơ Sở Vật Chất Mẫu
                </button>

                <button
                  data-testid="btn-report-critical-defect"
                  onClick={handleReportCriticalDefect}
                  disabled={loading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium text-sm transition flex items-center gap-2 shadow-lg shadow-rose-950"
                >
                  <AlertTriangle size={16} /> Báo Cáo Sự Cố An Toàn (FAIL_CRITICAL)
                </button>
              </div>
            </div>

            {/* Asset Details Overview Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-background border border-border rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <QrCode className="text-[var(--education-brand-ink)]" size={18} /> Chi Tiết Thiết Bị Giám Sát Cá Thể
                </h3>
                {assets.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">Chưa có dữ liệu. Nhấn nút &quot;Khởi Tạo Cơ Sở Vật Chất Mẫu&quot; để bắt đầu.</p>
                ) : (
                  <div className="space-y-2 text-xs text-foreground">
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Tên Thiết Bị:</span>
                      <span className="font-bold text-foreground">{currentAsset.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Mã Serial / QR:</span>
                      <span className="font-mono text-[var(--education-brand-ink)]">{currentAsset.serialNumber}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Khu Vực (Zone):</span>
                      <span>{currentZone?.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Trạng Thái Vận Hành:</span>
                      <span className="font-bold text-rose-700 dark:text-rose-400">{currentAsset.operationalStatus}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Phạm Vi Hạn Chế:</span>
                      <span className="font-mono">{currentAsset.restrictionScope}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Maintenance & Safety Restoration Panel */}
              <div className="bg-background border border-border rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <Wrench className="text-amber-700 dark:text-amber-400" size={18} /> Quy Trình Phục Hồi An Toàn (Safety Restoration Loop)
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-background rounded-xl border border-border text-xs space-y-1">
                    <span className="text-muted-foreground">Bước 1: Hoàn thành sửa chữa bảo trì</span>
                    <button
                      data-testid="btn-complete-maintenance"
                      onClick={handleCompleteMaintenance}
                      disabled={loading || maintenanceJobs.length === 0 || maintenanceJobs[0]?.status === 'COMPLETED'}
                      className="w-full mt-1.5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-medium transition text-xs"
                    >
                      Hoàn Thành Work Order Bảo Trì (COMPLETED ➔ UNDER_INSPECTION)
                    </button>
                  </div>

                  <div className="p-3 bg-background rounded-xl border border-border text-xs space-y-1">
                    <span className="text-muted-foreground">Bước 2: Kiểm định an toàn độc lập (Safety Re-Inspection)</span>
                    <button
                      data-testid="btn-pass-reinspection"
                      onClick={handlePassReinspection}
                      disabled={loading || currentAsset?.operationalStatus !== 'UNDER_INSPECTION'}
                      className="w-full mt-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-medium transition text-xs"
                    >
                      Kiểm Định An Toàn Đạt Chuẩn (PASS ➔ OPERATIONAL)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: SPACES & ZONE AVAILABILITY */}
        {activeTab === 'SPACES' && (
          <div className="bg-background border border-border rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="text-[var(--education-brand-ink)]" size={20} /> Cấu Trúc Không Gian & Contract Zone Availability
            </h3>
            {zones.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">Chưa có khu vực nào. Nhấn &quot;Khởi Tạo Cơ Sở Vật Chất Mẫu&quot; tại Tab Tổng quan.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {zones.map((z) => (
                  <div key={z.id} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{z.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Loại khu vực: {z.zoneType} | Sức chứa tối đa: {z.maxOccupancy} người
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        z.operationalStatus === 'OPERATIONAL' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        {z.operationalStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: ASSET INVENTORY */}
        {activeTab === 'ASSETS' && (
          <div className="bg-background border border-border rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border font-semibold text-sm text-foreground">
              Danh Mục Tài Sản Cá Thể & QR Code Identity
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-foreground">
                <thead className="bg-background text-xs text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="px-6 py-3">Mã Asset / QR</th>
                    <th className="px-6 py-3">Tên Thiết Bị</th>
                    <th className="px-6 py-3">Phân Loại</th>
                    <th className="px-6 py-3">Trạng Thái Vận Hành</th>
                    <th className="px-6 py-3">Phạm Vi Hạn Chế</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {assets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">
                        Chưa có tài sản cá thể nào.
                      </td>
                    </tr>
                  ) : (
                    assets.map((a) => (
                      <tr key={a.id} className="hover:bg-muted transition">
                        <td className="px-6 py-4 font-mono text-xs text-[var(--education-brand-ink)]">{a.serialNumber}</td>
                        <td className="px-6 py-4 font-bold text-foreground">{a.name}</td>
                        <td className="px-6 py-4 text-xs">{a.assetCategory}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                            a.operationalStatus === 'OPERATIONAL' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                            a.operationalStatus === 'UNDER_INSPECTION' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                            'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}>
                            {a.operationalStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono">{a.restrictionScope}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: SAFETY INSPECTIONS */}
        {activeTab === 'INSPECTIONS' && (
          <div className="bg-background border border-border rounded-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <ShieldAlert className="text-rose-700 dark:text-rose-400" size={20} /> Nhật Ký Kiểm Định An Toàn & Evidence Log
            </h3>
            <div className="divide-y divide-slate-800/60">
              {inspections.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Chưa có nhật ký kiểm định an toàn nào.
                </div>
              ) : (
                inspections.map((i) => (
                  <div key={i.id} className="py-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">Log ID: #{i.id.slice(0, 8)}</span>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-extrabold ${
                        i.resultStatus === 'PASS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        {i.resultStatus}
                      </span>
                    </div>
                    <p className="text-xs text-foreground">{i.remarks}</p>
                    <p className="text-[11px] text-muted-foreground">Ngày kiểm tra: {i.inspectionDate} | Người kiểm tra: {i.inspectorPartyId}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 5: MAINTENANCE & WORK QUEUE */}
        {activeTab === 'MAINTENANCE' && (
          <div className="space-y-6">
            <div className="bg-background border border-border rounded-2xl overflow-hidden p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Layers className="text-rose-700 dark:text-rose-400" size={20} /> Platform Candidate Exception Work Queue Engine (#3 Reuse)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sự cố an toàn Critical (SAFETY_DEFECT) tự động đẩy vào Work Queue điều hành
                  </p>
                </div>
                <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-3 py-1 rounded-full font-mono">
                  Cross-Domain Bridge P9 ➔ Work Queue
                </span>
              </div>

              <div className="divide-y divide-slate-800/60">
                {exceptions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Hiện không có exception cảnh báo sự cố an toàn nào trong Work Queue.
                  </div>
                ) : (
                  exceptions.map((exc) => (
                    <div key={exc.id} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4" data-testid="work-queue-exception-badge">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-amber-700 dark:text-amber-400 font-bold">#{exc.id.slice(0, 8)}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                            {exc.exception_type}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            exc.status === 'OPEN' ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'
                          }`}>
                            {exc.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Vị trí / Zone ID: <span className="font-mono text-foreground">{exc.student_id}</span> | Vai trò: {exc.assigned_role}
                        </p>
                      </div>

                      {exc.status === 'OPEN' && (
                        <button
                          data-testid="btn-resolve-exception"
                          onClick={() => handleResolveException(exc.id)}
                          disabled={loading}
                          className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-md text-xs font-semibold transition"
                        >
                          Xử Lý Exception (Resolve Work Queue)
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
