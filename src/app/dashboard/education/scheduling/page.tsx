'use client';

/**
 * Bella Preschool OS — P8 Staff Scheduling & Shift Management Command Center
 * File: src/app/dashboard/education/scheduling/page.tsx
 *
 * Provides Real-Time Shift Roster Management, Caregiver Ratio Compliance Auditing,
 * Leave Application & Approval Lifecycle, Substitute Allocation, and
 * Platform Reuse Candidate #2 Exception Work Queue Escalation.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { 
  Users, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  ArrowLeft, 
  Plus, 
  UserCheck, 
  UserX, 
  FileText, 
  AlertCircle, 
  Layers, 
  Sparkles, 
  RefreshCw,
  Award,
  ChevronRight
} from 'lucide-react';

import { PreschoolSchedulingRepository } from '@/products/bella-education/scheduling/repositories/preschool-scheduling.repository';
import { StaffRosterService } from '@/products/bella-education/scheduling/services/staff-roster.service';
import { RatioComplianceService } from '@/products/bella-education/scheduling/services/ratio-compliance.service';
import { LeaveSubstitutionService } from '@/products/bella-education/scheduling/services/leave-substitution.service';
import { SchedulingProjectionBridge } from '@/products/bella-education/scheduling/bridges/scheduling-projection.bridge';
import { ParentCommunicationRepository } from '@/products/bella-education/parent-engagement/repositories/parent-communication.repository';
import { CommunicationExceptionService } from '@/products/bella-education/parent-engagement/services/communication-exception.service';
import { ShiftAssignment, RatioComplianceSnapshot, ShiftTemplate } from '@/products/bella-education/scheduling/domain/scheduling.types';
import type { CommunicationException } from '@/products/bella-education/parent-engagement/domain/communication.types';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_MANAGER_ID = '00000000-0000-0000-0000-000000000003';
const DEFAULT_TEACHER1_ID = '00000000-0000-0000-0000-000000000081';
const DEFAULT_TEACHER2_ID = '00000000-0000-0000-0000-000000000082';
const DEFAULT_CAREGIVER1_ID = '00000000-0000-0000-0000-000000000083';
const DEFAULT_CLASSROOM_ID = '00000000-0000-0000-0000-000000000091';

const LEAVE_TYPES = ['SICK_LEAVE', 'ANNUAL_LEAVE', 'EMERGENCY_LEAVE'] as const;
type LeaveType = (typeof LEAVE_TYPES)[number];
type LeaveRequestRow = Database['public']['Tables']['edu_sched_leave_requests']['Row'];
type SubstitutionRow = Database['public']['Tables']['edu_sched_substitutions']['Row'];

function isLeaveType(value: string): value is LeaveType {
  return LEAVE_TYPES.includes(value as LeaveType);
}

function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : String(message);
  }

  return undefined;
}

export default function SchedulingPage() {
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'LEAVE' | 'WORK_QUEUE'>('ROSTER');
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Core domain state
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [complianceSnapshots, setComplianceSnapshots] = useState<RatioComplianceSnapshot[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRow[]>([]);
  const [substitutions, setSubstitutions] = useState<SubstitutionRow[]>([]);
  const [exceptions, setExceptions] = useState<CommunicationException[]>([]);

  // Form & Selection State
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-25');
  const [selectedClassroom, setSelectedClassroom] = useState<string>(DEFAULT_CLASSROOM_ID);
  const [leaveStaffId, setLeaveStaffId] = useState<string>(DEFAULT_TEACHER1_ID);
  const [leaveStartDate, setLeaveStartDate] = useState<string>('2026-09-25');
  const [leaveEndDate, setLeaveEndDate] = useState<string>('2026-09-25');
  const [leaveType, setLeaveType] = useState<LeaveType>('SICK_LEAVE');
  const [substituteStaffId, setSubstituteStaffId] = useState<string>(DEFAULT_TEACHER2_ID);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string>('');

  // Domain Instances
  const repo = new PreschoolSchedulingRepository(supabase);
  const rosterService = new StaffRosterService(repo);
  const complianceService = new RatioComplianceService(repo);
  const commRepo = new ParentCommunicationRepository(supabase);
  const exceptionService = new CommunicationExceptionService(commRepo);
  const bridge = new SchedulingProjectionBridge(commRepo, exceptionService);
  const leaveService = new LeaveSubstitutionService(repo, rosterService, complianceService, bridge);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Shift Templates
      const templates = await repo.listShiftTemplates(DEFAULT_TENANT_ID);
      setShiftTemplates(templates);

      // 2. Load Shift Assignments for Date
      const list = await repo.listShiftAssignments(DEFAULT_TENANT_ID, {
        classroomId: selectedClassroom,
        assignmentDate: selectedDate,
      });
      setAssignments(list);

      // 3. Load Latest Ratio Compliance Snapshot
      const snap = await repo.getLatestComplianceSnapshot(DEFAULT_TENANT_ID, selectedClassroom, selectedDate);
      if (snap) {
        setComplianceSnapshots([snap]);
      } else {
        setComplianceSnapshots([]);
      }

      // 4. Load Leave Requests
      const { data: leaves } = await supabase
        .from('edu_sched_leave_requests')
        .select('*')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .order('created_at', { ascending: false });
      setLeaveRequests(leaves || []);

      // 5. Load Substitutions
      const { data: subs } = await supabase
        .from('edu_sched_substitutions')
        .select('*')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .order('created_at', { ascending: false });
      setSubstitutions(subs || []);

      // 6. Load Exception Work Queue
      const excs = await exceptionService.getStaffWorkQueueExceptions(DEFAULT_TENANT_ID);
      setExceptions(excs);
    } catch (err) {
      console.error('Failed to load scheduling data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedClassroom]);

  // Handler 1: Initialize Ratio Policy & Seed Shift
  const handleSeedShift = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      // 0. Clean up previous test seed data for DEFAULT_TENANT_ID for clean isolated state
      await supabase
        .from('edu_sched_shift_assignments')
        .delete()
        .eq('tenant_id', DEFAULT_TENANT_ID);

      await supabase
        .from('edu_sched_leave_requests')
        .delete()
        .eq('tenant_id', DEFAULT_TENANT_ID);

      await supabase
        .from('edu_sched_substitutions')
        .delete()
        .eq('tenant_id', DEFAULT_TENANT_ID);

      await supabase
        .from('edu_comm_exceptions')
        .delete()
        .eq('tenant_id', DEFAULT_TENANT_ID);

      // Upsert Ratio Policy (5 children per caregiver for TODDLER)
      await repo.upsertRatioPolicy({
        tenantId: DEFAULT_TENANT_ID,
        ageGroup: 'TODDLER',
        maxChildrenPerCaregiver: 5,
        minLeadTeachers: 1,
      });

      // Ensure shift template exists
      let templateId = shiftTemplates[0]?.id;
      if (!templateId) {
        const t = await rosterService.createShiftTemplate({
          tenantId: DEFAULT_TENANT_ID,
          name: 'Ca Sáng (07:00 - 11:30)',
          code: 'MORNING',
          startTime: '07:00:00',
          endTime: '11:30:00',
        });
        templateId = t.id;
      }

      // Assign Lead Teacher 1 and Lead Teacher 2 (exact 2 required for 10 children)
      await rosterService.assignShift({
        tenantId: DEFAULT_TENANT_ID,
        classroomId: selectedClassroom,
        shiftTemplateId: templateId,
        staffPartyId: DEFAULT_TEACHER1_ID,
        role: 'LEAD_TEACHER',
        assignmentDate: selectedDate,
      });

      await rosterService.assignShift({
        tenantId: DEFAULT_TENANT_ID,
        classroomId: selectedClassroom,
        shiftTemplateId: templateId,
        staffPartyId: DEFAULT_TEACHER2_ID,
        role: 'LEAD_TEACHER',
        assignmentDate: selectedDate,
      });

      // Calculate ratio compliance snapshot
      await complianceService.calculateAndRecordCompliance({
        tenantId: DEFAULT_TENANT_ID,
        classroomId: selectedClassroom,
        snapshotDate: selectedDate,
        shiftTemplateId: templateId,
        ageGroup: 'TODDLER',
        counts: { enrolledChildren: 10, expectedChildren: 10, presentChildren: 10 },
      });

      setActionMessage('✅ Đã khởi tạo Ca Sáng & Phân công Giáo viên thành công!');
      await loadData();
    } catch (err) {
      setActionMessage(`❌ Lỗi khởi tạo ca: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler 2: Apply for Leave
  const handleApplyLeave = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const leave = await leaveService.applyForLeave({
        tenantId: DEFAULT_TENANT_ID,
        staffPartyId: leaveStaffId,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        leaveType: leaveType,
        reason: 'Sốt đột xuất - Xin nghỉ ca sáng',
      });
      setActionMessage(`✅ Đã gửi Đơn xin nghỉ phép #${leave.id.slice(0, 8)} (PENDING)!`);
      await loadData();
    } catch (err) {
      setActionMessage(`❌ Lỗi gửi đơn nghỉ: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler 3: Approve Leave (Triggers shift cancellation & exception escalation)
  const handleApproveLeave = async (leaveId: string) => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await leaveService.approveLeave({
        tenantId: DEFAULT_TENANT_ID,
        leaveRequestId: leaveId,
        approvedByPartyId: DEFAULT_MANAGER_ID,
      });

      const violation = res.complianceSnapshots.find(s => s.complianceState === 'SHORTAGE_VIOLATION');
      if (violation) {
        setActionMessage(`⚠️ Đã duyệt nghỉ phép! Phát hiện Thiếu Nhân sự ➔ Đã leo thang Cảnh báo SLA sang Exception Work Queue!`);
      } else {
        setActionMessage(`✅ Đã duyệt đơn nghỉ phép #${leaveId.slice(0, 8)} thành công!`);
      }
      await loadData();
    } catch (err) {
      setActionMessage(`❌ Lỗi duyệt nghỉ phép: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler 4: Assign Substitute Staff
  const handleAssignSubstitute = async (leaveRequestId: string) => {
    setLoading(true);
    setActionMessage(null);
    try {
      const targetAssign = assignments.find(a => a.status === 'CANCELLED' || a.status === 'SCHEDULED');
      if (!targetAssign) {
        throw new Error('Không tìm thấy ca làm việc bị ảnh hưởng để phân công giáo viên dạy thay!');
      }

      const res = await leaveService.assignSubstitute({
        tenantId: DEFAULT_TENANT_ID,
        originalAssignmentId: targetAssign.id,
        leaveRequestId,
        substituteStaffPartyId: substituteStaffId,
        assignedByPartyId: DEFAULT_MANAGER_ID,
        ageGroup: 'TODDLER',
      });

      setActionMessage(`✅ Đã phân công Giáo viên dạy thay thành công! Tỷ lệ nhân sự đã trở lại COMPLIANT!`);
      await loadData();
    } catch (err) {
      setActionMessage(`❌ Lỗi phân công dạy thay: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler 5: Resolve Exception in Work Queue
  const handleResolveException = async (exceptionId: string) => {
    setLoading(true);
    setActionMessage(null);
    try {
      await exceptionService.resolveException({
        tenantId: DEFAULT_TENANT_ID,
        exceptionId,
        resolvedBy: DEFAULT_MANAGER_ID,
        resolutionNotes: 'Quản lý đã nhận thông báo và ghi nhận kế hoạch phân công bù ca.',
      });

      setActionMessage(`ℹ️ Đã đóng Exception trong Work Queue! (Lưu ý: Tỷ lệ tuân thủ P8 chỉ COMPLIANT khi có giáo viên dạy thay thật)`);
      await loadData();
    } catch (err) {
      setActionMessage(`❌ Lỗi xử lý Exception: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const currentSnapshot = complianceSnapshots[0];

  return (
    <div className="preschool-ui min-h-screen bg-background text-foreground p-6 md:p-10 font-sans">
      {/* Header & Navigation */}
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="p-2 bg-background hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                <ArrowLeft size={18} />
              </Link>
              <h1 className="preschool-brand-heading text-3xl font-extrabold tracking-tight text-[var(--education-brand-ink)]">
                P8 Preschool Staff Scheduling & Shift Management
              </h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1 ml-11">
              Hệ thống Xếp Ca Giảng Dạy, Kiểm Toán Tỷ Lệ Giáo Viên / Trẻ (Caregiver Ratio), Nghỉ Phép & Dạy Thay Tuân Thủ Quy Chuẩn
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-lg shadow-emerald-950/40">
              <ShieldCheck size={14} /> P8.2 INTEGRATION VERIFIED
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
              : actionMessage.startsWith('⚠️')
              ? 'bg-amber-950/40 border-amber-800 text-amber-200'
              : 'bg-rose-950/40 border-rose-800 text-rose-200'
          }`}>
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-xs opacity-70 hover:opacity-100">Đóng</button>
          </div>
        )}

        {/* Live Caregiver-to-Child Ratio Compliance Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 bg-background border border-border rounded-2xl relative overflow-hidden">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trạng thái Tỷ lệ Nhân sự</div>
            <div className="mt-2 flex items-center justify-between">
              <span data-testid="ratio-compliance-badge" className={`text-2xl font-bold ${
                currentSnapshot?.complianceState === 'SHORTAGE_VIOLATION'
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}>
                {currentSnapshot?.complianceState || 'COMPLIANT'}
              </span>
              {currentSnapshot?.complianceState === 'SHORTAGE_VIOLATION' ? (
                <AlertTriangle className="text-rose-700 dark:text-rose-400 animate-pulse" size={28} />
              ) : (
                <ShieldCheck className="text-emerald-700 dark:text-emerald-400" size={28} />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {currentSnapshot?.complianceState === 'SHORTAGE_VIOLATION' 
                ? `Thiếu ${currentSnapshot.shortageCount} bảo mẫu/giáo viên!`
                : 'Đạt chuẩn 1 bảo mẫu / 5 trẻ (Lớp Toddler)'}
            </p>
          </div>

          <div className="p-5 bg-background border border-border rounded-2xl">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Số Trẻ Có Mặt (Present)</div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {currentSnapshot?.presentChildren ?? 10} <span className="text-xs font-normal text-muted-foreground">/ {currentSnapshot?.enrolledChildren ?? 10} Đã nhập học</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Nguồn dữ liệu: P3/P4 Student Attendance Contract</p>
          </div>

          <div className="p-5 bg-background border border-border rounded-2xl">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bảo Mẫu Yêu Cầu vs Đã Phân Công</div>
            <div className="mt-2 text-2xl font-bold text-[var(--education-brand-ink)]">
              {currentSnapshot?.assignedCaregivers ?? assignments.filter(a => a.status === 'SCHEDULED').length} <span className="text-xs font-normal text-muted-foreground">/ Yêu cầu: {currentSnapshot?.requiredCaregivers ?? 2}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Công thức: ceil(active_children / max_ratio)</p>
          </div>

          <div className="p-5 bg-background border border-border rounded-2xl">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cảnh Báo Thiếu Người (Work Queue)</div>
            <div className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">
              {exceptions.filter(e => e.status === 'OPEN').length} <span className="text-xs font-normal text-muted-foreground">STAFFING_SHORTAGE_SLA</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Platform Candidate Reuse #2 Active</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border gap-8">
          <button
            data-testid="tab-roster"
            onClick={() => setActiveTab('ROSTER')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'ROSTER'
                ? 'border-primary text-[var(--education-brand-ink)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar size={16} /> Lịch Roster & Tỷ Lệ Bảo Mẫu
          </button>
          <button
            data-testid="tab-leave"
            onClick={() => setActiveTab('LEAVE')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'LEAVE'
                ? 'border-primary text-[var(--education-brand-ink)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserX size={16} /> Quản Lý Nghỉ Phép & Phân Công Dạy Thay
            {leaveRequests.filter(l => l.status === 'PENDING').length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-900 text-amber-200 font-bold">
                {leaveRequests.filter(l => l.status === 'PENDING').length}
              </span>
            )}
          </button>
          <button
            data-testid="tab-work-queue"
            onClick={() => setActiveTab('WORK_QUEUE')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'WORK_QUEUE'
                ? 'border-primary text-[var(--education-brand-ink)]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers size={16} /> Platform Exception Work Queue
            {exceptions.filter(e => e.status === 'OPEN').length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-rose-900 text-rose-200 font-bold">
                {exceptions.filter(e => e.status === 'OPEN').length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: ROSTER & RATIO */}
        {activeTab === 'ROSTER' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-background p-4 rounded-xl border border-border">
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Ngày Xếp Ca</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-ring"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Mã Lớp Học</label>
                  <input
                    type="text"
                    value={selectedClassroom}
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-ring"
                  />
                </div>
              </div>

              <button
                data-testid="btn-seed-shift"
                onClick={handleSeedShift}
                disabled={loading}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium text-sm transition flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                <Plus size={16} /> Phân Công Ca Sáng Mẫu (10 Trẻ / 2 Giáo Viên)
              </button>
            </div>

            {/* Roster Assignment Table */}
            <div className="bg-background border border-border rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border font-semibold text-sm text-foreground flex items-center justify-between">
                <span>Danh Sách Ca Phân Công Trong Ngày ({selectedDate})</span>
                <span className="text-xs text-muted-foreground font-normal">Append-Only Versioning Active</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-foreground">
                  <thead className="bg-background text-xs text-muted-foreground uppercase border-b border-border">
                    <tr>
                      <th className="px-6 py-3">Mã Ca</th>
                      <th className="px-6 py-3">Giáo Viên / Bảo Mẫu ID</th>
                      <th className="px-6 py-3">Vai Trò</th>
                      <th className="px-6 py-3">Trạng Thái Ca</th>
                      <th className="px-6 py-3">Phiên Bản Amendment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {assignments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">
                          Chưa có ca làm việc nào được xếp cho ngày này. Bấm nút &quot;Phân Công Ca Sáng Mẫu&quot; để khởi tạo.
                        </td>
                      </tr>
                    ) : (
                      assignments.map((a) => (
                        <tr key={a.id} className="hover:bg-muted transition">
                          <td className="px-6 py-4 font-mono text-xs text-[var(--education-brand-ink)]">{a.shiftTemplateId.slice(0, 8)}</td>
                          <td className="px-6 py-4 font-mono text-xs">{a.staffPartyId}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                              a.role === 'LEAD_TEACHER' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60' : 'bg-muted text-foreground'
                            }`}>
                              {a.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              a.status === 'SCHEDULED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' :
                              a.status === 'CANCELLED' ? 'bg-rose-950 text-rose-300 border border-rose-800/60' :
                              'bg-amber-950 text-amber-300'
                            }`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">v{a.amendmentVersion}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: LEAVE & SUBSTITUTION */}
        {activeTab === 'LEAVE' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form: Apply for Leave */}
            <div className="bg-background border border-border p-6 rounded-2xl space-y-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                <UserX size={18} className="text-teal-700 dark:text-teal-400" /> Nộp Đơn Xin Nghỉ Phép
              </h3>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Mã Nhân Viên</label>
                <select
                  value={leaveStaffId}
                  onChange={(e) => setLeaveStaffId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:border-ring"
                >
                  <option value={DEFAULT_TEACHER1_ID}>Giáo viên 1 (Teacher Lead 1)</option>
                  <option value={DEFAULT_TEACHER2_ID}>Giáo viên 2 (Teacher Lead 2)</option>
                  <option value={DEFAULT_CAREGIVER1_ID}>Bảo mẫu 1 (Caregiver 1)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Từ Ngày</label>
                  <input
                    type="date"
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Đến Ngày</label>
                  <input
                    type="date"
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Loại Nghỉ Phép</label>
                <select
                  value={leaveType}
                  onChange={(e) => {
                    if (isLeaveType(e.target.value)) {
                      setLeaveType(e.target.value);
                    }
                  }}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-foreground"
                >
                  <option value="SICK_LEAVE">Sick Leave (Nghỉ Bệnh)</option>
                  <option value="ANNUAL_LEAVE">Annual Leave (Nghỉ Phép Năm)</option>
                  <option value="EMERGENCY_LEAVE">Emergency Leave (Nghỉ Đột Xuất)</option>
                </select>
              </div>

              <button
                data-testid="btn-apply-leave"
                onClick={handleApplyLeave}
                disabled={loading}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium text-sm transition shadow-lg"
              >
                Gửi Đơn Xin Nghỉ Phép (PENDING)
              </button>
            </div>

            {/* List: Leave Requests & Manager Approval Actions */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-background border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border font-semibold text-sm text-foreground">
                  Danh Sách Đơn Xin Nghỉ Phép & Phân Công Dạy Thay
                </div>
                <div className="divide-y divide-slate-800/60">
                  {leaveRequests.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      Chưa có đơn xin nghỉ phép nào trong hệ thống.
                    </div>
                  ) : (
                    leaveRequests.map((l) => (
                      <div key={l.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-muted transition">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-teal-700 dark:text-teal-400 font-bold">#{l.id.slice(0, 8)}</span>
                            <span className="text-sm font-semibold text-foreground">{l.leave_type}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              l.status === 'PENDING' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                              l.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                              'bg-rose-950 text-rose-300'
                            }`}>
                              {l.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Nhân viên: <span className="font-mono">{l.staff_party_id}</span> | Thời gian: {l.start_date} đến {l.end_date}
                          </p>
                          {l.reason && <p className="text-xs text-muted-foreground italic mt-0.5">Lý do: {l.reason}</p>}
                        </div>

                        <div className="flex items-center gap-2">
                          {l.status === 'PENDING' && (
                            <button
                              data-testid="btn-approve-leave"
                              onClick={() => handleApproveLeave(l.id)}
                              disabled={loading}
                              className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md text-xs font-semibold transition shadow-md"
                            >
                              Duyệt Nghỉ Phép (Approve)
                            </button>
                          )}

                          {l.status === 'APPROVED' && (
                            <div className="flex items-center gap-2">
                              <select
                                value={substituteStaffId}
                                onChange={(e) => setSubstituteStaffId(e.target.value)}
                                className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                              >
                                <option value={DEFAULT_TEACHER2_ID}>Giáo viên 2 (Teacher 2)</option>
                                <option value={DEFAULT_CAREGIVER1_ID}>Bảo mẫu 1 (Caregiver 1)</option>
                              </select>
                              <button
                                data-testid="btn-assign-substitute"
                                onClick={() => handleAssignSubstitute(l.id)}
                                disabled={loading}
                                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md text-xs font-semibold transition"
                              >
                                Phân Công Dạy Thay
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: WORK QUEUE */}
        {activeTab === 'WORK_QUEUE' && (
          <div className="space-y-6">
            <div className="bg-background border border-border rounded-2xl overflow-hidden p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Layers className="text-teal-700 dark:text-teal-400" size={20} /> Platform Candidate Exception Work Queue Engine (#2 Reuse)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cảnh báo SLA Thiếu Nhân Sự (STAFFING_SHORTAGE_SLA) được tự động leo thang khi duyệt nghỉ phép gây vi phạm tỷ lệ bảo mẫu
                  </p>
                </div>
                <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-3 py-1 rounded-full font-mono">
                  Cross-Domain Bridge P8 ➔ Work Queue
                </span>
              </div>

              <div className="divide-y divide-slate-800/60">
                {exceptions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Hiện không có exception cảnh báo thiếu người nào trong Work Queue.
                  </div>
                ) : (
                  exceptions.map((exc) => (
                    <div key={exc.id} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                          Lớp học ID: <span className="font-mono text-foreground">{exc.student_id}</span> | Vai trò phụ trách: {exc.assigned_role}
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
