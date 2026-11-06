'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type InstallationStatus = 'pending' | 'in_progress' | 'completed' | 'punch_listed';

interface DiaryEntry {
  id: string;
  date: string;
  project: string;
  supervisor: string;
  workersPresent: number;
  weather: string;
  keyActivities: string;
  issues: string;
  fullNotes: string;
}

interface RoomInstallation {
  id: string;
  roomName: string;
  zone: string;
  products: string[];
  assignedInstaller: string;
  scheduledDate: string;
  status: InstallationStatus;
}

interface Project {
  id: string;
  name: string;
  rooms: RoomInstallation[];
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const diaryEntries: DiaryEntry[] = [
  {
    id: 'D001',
    date: '2025-11-05',
    project: 'The Grand Meridian',
    supervisor: 'Ahmed Al-Rashidi',
    workersPresent: 12,
    weather: 'Clear',
    keyActivities: 'Installed built-in wardrobes in rooms 101–110; primer coat applied...',
    issues: 'Delay in tile delivery for bathroom floors.',
    fullNotes:
      'Full day on Level 1. Wardrobe units for rooms 101–110 fully installed and anchored. Primer coat applied to all bedroom walls. Bathroom floor tile delivery delayed by supplier—ETA rescheduled to Nov 7. Electrical conduit inspection passed for Rooms 103, 107, 109. No safety incidents recorded.',
  },
  {
    id: 'D002',
    date: '2025-11-04',
    project: 'Sapphire Residences',
    supervisor: 'Noura Hassan',
    workersPresent: 8,
    weather: 'Cloudy',
    keyActivities: 'Ceiling gypsum boarding completed on floors 2–3; door frames fitted...',
    issues: 'None.',
    fullNotes:
      'Gypsum boarding completed for all rooms on floors 2 and 3. Door frames fitted in all 14 units. Paint touch-ups pending supervisor sign-off. All safety checks passed. Next step: skirting and sill installation.',
  },
  {
    id: 'D003',
    date: '2025-11-03',
    project: 'The Grand Meridian',
    supervisor: 'Ahmed Al-Rashidi',
    workersPresent: 10,
    weather: 'Sunny',
    keyActivities: 'Flooring laid in master bedrooms 201–208; FF&E receiving and snagging...',
    issues: 'Two headboard units arrived damaged—returned to supplier.',
    fullNotes:
      'Master bedroom flooring (engineered timber) laid and levelled for rooms 201–208. FF&E delivery batch #3 received and snagged. Two headboard units (SKU HB-9900) found damaged upon unboxing—photos taken and return raised with procurement. Work on Level 2 bathrooms to commence tomorrow.',
  },
  {
    id: 'D004',
    date: '2025-11-02',
    project: 'Azure Bay Villas',
    supervisor: 'Khalid Mansour',
    workersPresent: 6,
    weather: 'Windy',
    keyActivities: 'Exterior cladding on Villa C completed; interior painting started on Villa A...',
    issues: 'Wind caused scaffolding delay on Villa D.',
    fullNotes:
      'Villa C exterior cladding fully completed and inspected. Interior painting commenced for Villa A ground floor. Villa D scaffolding had to be re-secured due to wind—lost approx 2 hours. QC walk-through for Villa B scheduled for Nov 5.',
  },
];

const projects: Project[] = [
  {
    id: 'P001',
    name: 'The Grand Meridian',
    rooms: [
      {
        id: 'R001',
        roomName: 'Suite 101',
        zone: 'Level 1',
        products: ['Built-in Wardrobe', 'Pendant Light', 'Custom Headboard'],
        assignedInstaller: 'Faisal Al-Otaibi',
        scheduledDate: '2025-11-08',
        status: 'completed',
      },
      {
        id: 'R002',
        roomName: 'Suite 102',
        zone: 'Level 1',
        products: ['Built-in Wardrobe', 'Bathroom Vanity'],
        assignedInstaller: 'Faisal Al-Otaibi',
        scheduledDate: '2025-11-08',
        status: 'completed',
      },
      {
        id: 'R003',
        roomName: 'Suite 201',
        zone: 'Level 2',
        products: ['Engineered Timber Floor', 'Custom Headboard', 'Ceiling Rose'],
        assignedInstaller: 'Ramzi Khalil',
        scheduledDate: '2025-11-10',
        status: 'in_progress',
      },
      {
        id: 'R004',
        roomName: 'Suite 202',
        zone: 'Level 2',
        products: ['Engineered Timber Floor', 'Bathroom Tiles'],
        assignedInstaller: 'Ramzi Khalil',
        scheduledDate: '2025-11-12',
        status: 'pending',
      },
      {
        id: 'R005',
        roomName: 'Penthouse 301',
        zone: 'Level 3',
        products: ['Statement Chandelier', 'Marble Feature Wall', 'Custom Joinery'],
        assignedInstaller: 'Tariq Noor',
        scheduledDate: '2025-11-20',
        status: 'punch_listed',
      },
    ],
  },
  {
    id: 'P002',
    name: 'Sapphire Residences',
    rooms: [
      {
        id: 'R006',
        roomName: 'Unit 2A – Master',
        zone: 'Floor 2',
        products: ['Sliding Wardrobe', 'Feature Wallpaper'],
        assignedInstaller: 'Dana Yousef',
        scheduledDate: '2025-11-06',
        status: 'completed',
      },
      {
        id: 'R007',
        roomName: 'Unit 2A – Living',
        zone: 'Floor 2',
        products: ['Media Unit', 'Soft Furnishings'],
        assignedInstaller: 'Dana Yousef',
        scheduledDate: '2025-11-07',
        status: 'in_progress',
      },
      {
        id: 'R008',
        roomName: 'Unit 3B – Master',
        zone: 'Floor 3',
        products: ['Sliding Wardrobe', 'Pendant Light'],
        assignedInstaller: 'Jad Nasser',
        scheduledDate: '2025-11-09',
        status: 'pending',
      },
    ],
  },
  {
    id: 'P003',
    name: 'Azure Bay Villas',
    rooms: [
      {
        id: 'R009',
        roomName: 'Villa A – Living',
        zone: 'Ground Floor',
        products: ['Stone Feature Wall', 'Custom Shelving'],
        assignedInstaller: 'Mansour Al-Ghamdi',
        scheduledDate: '2025-11-14',
        status: 'in_progress',
      },
      {
        id: 'R010',
        roomName: 'Villa B – Master',
        zone: 'First Floor',
        products: ['Bespoke Wardrobe', 'Marble Flooring'],
        assignedInstaller: 'Mansour Al-Ghamdi',
        scheduledDate: '2025-11-16',
        status: 'pending',
      },
      {
        id: 'R011',
        roomName: 'Villa C – Exterior',
        zone: 'Exterior',
        products: ['Cladding Panels', 'Feature Lighting'],
        assignedInstaller: 'Khalid Mansour',
        scheduledDate: '2025-11-02',
        status: 'completed',
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: InstallationStatus) {
  const map: Record<InstallationStatus, { label: string; classes: string }> = {
    pending: { label: 'Pending', classes: 'bg-stone-100 text-stone-600 border border-stone-300' },
    in_progress: { label: 'In Progress', classes: 'bg-amber-100 text-amber-700 border border-amber-300' },
    completed: { label: 'Completed', classes: 'bg-slate-100 text-slate-700 border border-slate-400' },
    punch_listed: { label: 'Punch Listed', classes: 'bg-orange-100 text-orange-700 border border-orange-300' },
  };
  const { label, classes } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

function projectProgress(rooms: RoomInstallation[]): number {
  if (rooms.length === 0) return 0;
  const done = rooms.filter((r) => r.status === 'completed').length;
  return Math.round((done / rooms.length) * 100);
}

// ── Summary Stats ─────────────────────────────────────────────────────────────

function computeStats(allProjects: Project[]) {
  const allRooms = allProjects.flatMap((p) => p.rooms);
  return {
    total: allRooms.length,
    installed: allRooms.filter((r) => r.status === 'completed').length,
    inProgress: allRooms.filter((r) => r.status === 'in_progress').length,
    pending: allRooms.filter((r) => r.status === 'pending' || r.status === 'punch_listed').length,
  };
}

// ── Components ────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-sm p-5 flex flex-col gap-1 ${accent}`}>
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      <span className="text-3xl font-bold text-slate-800">{value}</span>
    </div>
  );
}

function DiaryTable({ entries }: { entries: DiaryEntry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {['Date', 'Project', 'Supervisor', 'Workers', 'Weather', 'Key Activities', 'Issues', ''].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {entries.map((entry) => (
            <>
              <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap font-mono text-xs">{entry.date}</td>
                <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap">{entry.project}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{entry.supervisor}</td>
                <td className="px-4 py-3 text-center text-slate-700">{entry.workersPresent}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{entry.weather}</td>
                <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{entry.keyActivities}</td>
                <td className="px-4 py-3 text-slate-500 italic text-xs max-w-[180px] truncate">{entry.issues}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    {expanded === entry.id ? 'Close' : 'View'}
                  </button>
                </td>
              </tr>
              {expanded === entry.id && (
                <tr key={`${entry.id}-expanded`} className="bg-stone-50">
                  <td colSpan={8} className="px-6 py-4">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{entry.fullNotes}</p>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectSection({ project }: { project: Project }) {
  const [collapsed, setCollapsed] = useState(false);
  const pct = projectProgress(project.rooms);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Project header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
          <span className="font-semibold text-slate-800">{project.name}</span>
          <span className="text-xs text-slate-500">
            {project.rooms.filter((r) => r.status === 'completed').length}/{project.rooms.length} rooms complete
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 bg-slate-200 rounded-full h-2">
            <div
              className="bg-slate-500 h-2 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-600 w-10 text-right">{pct}%</span>
        </div>
      </button>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-white border-b border-slate-100">
              <tr>
                {['Room', 'Zone', 'Products', 'Installer', 'Scheduled', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {project.rooms.map((room) => (
                <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{room.roomName}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{room.zone}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex flex-wrap gap-1">
                      {room.products.map((p) => (
                        <span
                          key={p}
                          className="inline-block bg-stone-100 text-stone-700 text-xs px-2 py-0.5 rounded border border-stone-200"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{room.assignedInstaller}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-xs">{room.scheduledDate}</td>
                  <td className="px-4 py-3">{statusBadge(room.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SiteInstallationPage() {
  const stats = computeStats(projects);

  return (
    <div className="min-h-screen bg-stone-50 p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Site Installation</h1>
        <p className="text-sm text-slate-500">
          Track room-by-room installation progress, site diary entries, and supervisor logs across all active projects.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Rooms" value={stats.total} accent="border-l-4 border-l-slate-400" />
        <SummaryCard label="Installed" value={stats.installed} accent="border-l-4 border-l-green-500" />
        <SummaryCard label="In Progress" value={stats.inProgress} accent="border-l-4 border-l-amber-400" />
        <SummaryCard label="Pending / Punch Listed" value={stats.pending} accent="border-l-4 border-l-orange-400" />
      </div>

      {/* Site Diary */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-700">Site Diary</h2>
          <p className="text-xs text-slate-400">Daily on-site records submitted by project supervisors.</p>
        </div>
        <DiaryTable entries={diaryEntries} />
      </section>

      {/* Room Installation Progress */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-700">Room Installation Progress</h2>
          <p className="text-xs text-slate-400">Grouped by project — click a project header to collapse its rooms.</p>
        </div>
        <div className="space-y-4">
          {projects.map((project) => (
            <ProjectSection key={project.id} project={project} />
          ))}
        </div>
      </section>
    </div>
  );
}
