'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Hammer,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  ShieldCheck,
  Building,
  RefreshCw,
  X,
  Calendar,
  CloudSun,
  Users,
  AlertTriangle,
  ClipboardCheck,
  ChevronRight,
  Eye,
  Layers,
} from 'lucide-react';

interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  clientName: string;
}

interface SiteDiaryItem {
  id: string;
  date: string;
  supervisorUserId: string;
  workersPresent: number;
  weatherCondition: string;
  activitiesCompleted: string[];
  issuesEncountered: string[];
  notes: string;
  createdAt: string;
}

interface RoomInstallationDisplay {
  id: string;
  roomName: string;
  zoneCode: string;
  assignedInstaller: string;
  scheduledDate: string;
  progressPercent: number;
  status: 'pending' | 'installing' | 'completed' | 'punch_listed';
  modulesCount: number;
}

const DEFAULT_ROOMS: RoomInstallationDisplay[] = [
  {
    id: 'room-01',
    roomName: 'Phòng Khách Luxury',
    zoneCode: 'R01_LIVING',
    assignedInstaller: 'Lê Văn Thắng (Tổ Lắp Đặt 1)',
    scheduledDate: '2026-11-12',
    progressPercent: 75,
    status: 'installing',
    modulesCount: 6,
  },
  {
    id: 'room-02',
    roomName: 'Bếp & Phòng Ăn Master',
    zoneCode: 'R02_KITCHEN',
    assignedInstaller: 'Nguyễn Văn Hùng (Tổ Lắp Đặt 2)',
    scheduledDate: '2026-11-15',
    progressPercent: 40,
    status: 'installing',
    modulesCount: 12,
  },
  {
    id: 'room-03',
    roomName: 'Phòng Ngủ Master Suite',
    zoneCode: 'R03_MASTER',
    assignedInstaller: 'Trần Văn Bình (Tổ Lắp Đặt 1)',
    scheduledDate: '2026-11-18',
    progressPercent: 10,
    status: 'pending',
    modulesCount: 8,
  },
  {
    id: 'room-04',
    roomName: 'Phòng Thay Đồ Walk-in Closet',
    zoneCode: 'R04_CLOSET',
    assignedInstaller: 'Lê Văn Thắng (Tổ Lắp Đặt 1)',
    scheduledDate: '2026-11-20',
    progressPercent: 0,
    status: 'pending',
    modulesCount: 5,
  },
];

export default function InteriorInstallationPage() {
  const [activeTab, setActiveTab] = useState<'rooms' | 'diaries'>('rooms');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [rooms, setRooms] = useState<RoomInstallationDisplay[]>(DEFAULT_ROOMS);
  const [diaries, setDiaries] = useState<SiteDiaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Diary Modal
  const [showNewDiaryModal, setShowNewDiaryModal] = useState<boolean>(false);
  const [diaryDate, setDiaryDate] = useState(new Date().toISOString().slice(0, 10));
  const [diarySupervisor, setDiarySupervisor] = useState('Chỉ huy trưởng Nguyễn Hoàng');
  const [diaryWorkers, setDiaryWorkers] = useState('8');
  const [diaryWeather, setDiaryWeather] = useState('sunny');
  const [diaryActivities, setDiaryActivities] = useState('Lắp ráp hệ tủ bếp trên & cân chỉnh ray âm Blum');
  const [diaryIssues, setDiaryIssues] = useState('Ổ cắm nguồn góc đảo bếp bị lệch 2cm so với cốt bản vẽ');
  const [diaryNotes, setDiaryNotes] = useState('Đã phối hợp thợ điện dời ổ cắm ngay trong ca sáng');

  // Load Projects
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/interior/projects');
      const json = await res.json();
      if (json.success && json.data?.projects) {
        setProjects(json.data.projects);
        if (json.data.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(json.data.projects[0].id);
        }
      }
    } catch {
      // fallback
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load Diaries
  const loadDiaries = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/interior/delivery/site-diary?projectId=${encodeURIComponent(projId)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setDiaries(json.data);
      } else {
        // Fallback default sample diaries
        setDiaries([
          {
            id: 'sde-001',
            date: '2026-11-05',
            supervisorUserId: 'Chỉ huy trưởng Nguyễn Hoàng',
            workersPresent: 8,
            weatherCondition: 'sunny',
            activitiesCompleted: [
              'Lắp dựng vách nan gỗ óc chó phòng khách đạt cốt chuẩn',
              'Định vị bàn đảo bếp và cân thủy nivo mặt phẳng',
            ],
            issuesEncountered: ['Chờ thợ điện nối nguồn LED ray nam châm'],
            notes: 'Công trường vệ sinh sạch sẽ, tuân thủ an toàn lao động.',
            createdAt: '2026-11-05T17:30:00Z',
          },
          {
            id: 'sde-002',
            date: '2026-11-04',
            supervisorUserId: 'Chỉ huy trưởng Nguyễn Hoàng',
            workersPresent: 6,
            weatherCondition: 'cloudy',
            activitiesCompleted: [
              'Tiếp nhận lô hàng xuất xưởng đợt 2 (thùng tủ bếp & nẹp chỉ)',
              'Bốc dỡ an toàn lên tầng 1, không trầy xước cạnh ván',
            ],
            issuesEncountered: [],
            notes: 'Biên bản giao nhận vật tư xưởng ký tá đầy đủ.',
            createdAt: '2026-11-04T17:00:00Z',
          },
        ]);
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể tải nhật ký công trình.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadDiaries(selectedProjectId);
    }
  }, [selectedProjectId, loadDiaries]);

  // Handle Create Diary
  const handleCreateDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const activities = diaryActivities.split('\n').filter((a) => a.trim().length > 0);
      const issues = diaryIssues.split('\n').filter((i) => i.trim().length > 0);

      const res = await fetch('/api/interior/delivery/site-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          date: diaryDate,
          supervisorUserId: diarySupervisor,
          workersPresent: parseInt(diaryWorkers, 10) || 6,
          weatherCondition: diaryWeather,
          activitiesCompleted: activities.length > 0 ? activities : [diaryActivities],
          issuesEncountered: issues.length > 0 ? issues : [],
          notes: diaryNotes,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setShowNewDiaryModal(false);
        setFeedback({ type: 'success', message: 'Đã lưu nhật ký thi công công trình hôm nay!' });
        await loadDiaries(selectedProjectId);
      } else {
        setFeedback({ type: 'error', message: json.error || 'Lưu nhật ký thất bại.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi gửi nhật ký.' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6 font-sans">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              : 'bg-rose-950/80 text-rose-300 border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/interior"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Hiện Trường Lắp Đặt & Nhật Ký Thi Công</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Site Operations
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Dự án:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-amber-300 rounded px-2 py-0.5 font-medium focus:outline-none focus:border-amber-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDiaries(selectedProjectId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
            Làm mới
          </button>
          <button
            onClick={() => setShowNewDiaryModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Ghi Nhật Ký Hôm Nay
          </button>
          <Link
            href="/dashboard/interior/qc-handover"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
          >
            Nghiệm Thu QC & Punch List
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Tabs: Room Installation vs Site Diaries */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'rooms'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Hammer className="h-4 w-4" />
          <span>Kế Hoạch & Tiến Độ Từng Phòng</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{rooms.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('diaries')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'diaries'
              ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Nhật Ký Thi Công Hiện Trường (Site Diary)</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{diaries.length}</span>
        </button>
      </div>

      {activeTab === 'rooms' ? (
        /* Room-by-Room Installation View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {rooms.map((r) => (
              <div
                key={r.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {r.zoneCode}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      r.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : r.status === 'installing'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {r.status === 'completed' ? 'Đã nghiệm thu' : r.status === 'installing' ? 'Đang lắp đặt' : 'Chờ lắp'}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-white text-sm">{r.roomName}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{r.assignedInstaller}</p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Tiến độ hoàn thiện</span>
                    <span className="font-mono text-white font-semibold">{r.progressPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${
                        r.progressPercent >= 70 ? 'bg-emerald-500' : r.progressPercent >= 30 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${r.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Khối lượng: {r.modulesCount} modules</span>
                  <span>Hạn: {r.scheduledDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Daily Site Diary View */
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-400" />
                Lịch Sử Nhật Ký Công Trình ({diaries.length} ngày ghi nhận)
              </h3>
              <span className="text-xs text-slate-400 font-mono">Bảo lưu bằng chứng hiện trường</span>
            </div>

            <div className="divide-y divide-slate-800/70">
              {diaries.map((d) => (
                <div key={d.id} className="p-5 space-y-3 hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-amber-300 text-sm">{d.date}</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-300">
                        <Users className="h-3 w-3 text-slate-400" /> {d.workersPresent} nhân công
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        <CloudSun className="h-3 w-3" /> Thời tiết {d.weatherCondition}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Chỉ huy trưởng: <span className="text-slate-200 font-medium">{d.supervisorUserId}</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <span className="font-semibold text-slate-300">Công việc đã hoàn thành:</span>
                    <ul className="list-disc pl-5 space-y-0.5 text-slate-400">
                      {d.activitiesCompleted.map((act, idx) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>

                  {d.issuesEncountered && d.issuesEncountered.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/30 text-xs space-y-1">
                      <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Tồn đọng & Vướng mắc hiện trường:
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5 text-amber-300/80">
                        {d.issuesEncountered.map((iss, idx) => (
                          <li key={idx}>{iss}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {d.notes && (
                    <p className="text-xs text-slate-400 italic">Ghi chú: {d.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Site Diary */}
      {showNewDiaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-400" /> Ghi Nhật Ký Thi Công Hiện Trường
              </h3>
              <button onClick={() => setShowNewDiaryModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateDiary} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Ngày thi công *</label>
                  <input
                    type="date"
                    required
                    value={diaryDate}
                    onChange={(e) => setDiaryDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Số nhân công hiện trường *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={diaryWorkers}
                    onChange={(e) => setDiaryWorkers(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Chỉ huy trưởng / Giám sát *</label>
                  <input
                    type="text"
                    required
                    value={diarySupervisor}
                    onChange={(e) => setDiarySupervisor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Thời tiết *</label>
                  <select
                    value={diaryWeather}
                    onChange={(e) => setDiaryWeather(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="sunny">Nắng ráo (Sunny)</option>
                    <option value="cloudy">Nhiều mây (Cloudy)</option>
                    <option value="rainy">Mưa (Rainy)</option>
                    <option value="stormy">Giông bão (Stormy)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Công việc hoàn thành trong ngày *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Nhập từng đầu việc (mỗi dòng một việc)..."
                  value={diaryActivities}
                  onChange={(e) => setDiaryActivities(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Vướng mắc / Sự cố phát sinh (nếu có)</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú sự cố, chậm trễ, va chạm vật tư..."
                  value={diaryIssues}
                  onChange={(e) => setDiaryIssues(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Giải pháp xử lý & Ghi chú</label>
                <input
                  type="text"
                  placeholder="Phương án xử lý đã thống nhất..."
                  value={diaryNotes}
                  onChange={(e) => setDiaryNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewDiaryModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm"
                >
                  Lưu Nhật Ký Hiện Trường
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
