'use client';

import { useState } from 'react';
import { FileText, Award } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type PunchCategory =
  | 'finishing'
  | 'structural'
  | 'furniture_fit'
  | 'electrical_coordination'
  | 'painting';

type PunchSeverity = 'critical' | 'major' | 'minor';

type PunchStatus = 'open' | 'in_progress' | 'resolved' | 'verified';

type HandoverStatus = 'blocked' | 'ready' | 'completed';

type FilterMode = 'all' | 'open' | 'resolved';

interface PunchItem {
  id: string;
  issueNumber: string;
  project: string;
  room: string;
  description: string;
  category: PunchCategory;
  severity: PunchSeverity;
  reportedBy: string;
  assignedTo: string;
  status: PunchStatus;
  resolvedDate?: string;
}

interface HandoverDossier {
  id: string;
  projectName: string;
  client: string;
  contractValue: string;
  rooms: number;
  openPunchItems: number;
  criticalOpenItems: number;
  handoverStatus: HandoverStatus;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const punchItems: PunchItem[] = [
  {
    id: 'PI001',
    issueNumber: '#001',
    project: 'The Grand Meridian',
    room: 'Suite 101',
    description: 'Wardrobe door alignment off — gap visible at top left hinge.',
    category: 'furniture_fit',
    severity: 'major',
    reportedBy: 'Ahmed Al-Rashidi',
    assignedTo: 'Faisal Al-Otaibi',
    status: 'in_progress',
  },
  {
    id: 'PI002',
    issueNumber: '#002',
    project: 'The Grand Meridian',
    room: 'Suite 201',
    description: 'Paint bleed across skirting board in northeast corner.',
    category: 'painting',
    severity: 'minor',
    reportedBy: 'QC Inspector - Layla',
    assignedTo: 'Paint Crew B',
    status: 'resolved',
    resolvedDate: '2025-11-04',
  },
  {
    id: 'PI003',
    issueNumber: '#003',
    project: 'Sapphire Residences',
    room: 'Unit 2A – Master',
    description: 'Ceiling rose not centred — offset 4 cm south from design plan.',
    category: 'finishing',
    severity: 'major',
    reportedBy: 'Noura Hassan',
    assignedTo: 'Ramzi Khalil',
    status: 'open',
  },
  {
    id: 'PI004',
    issueNumber: '#004',
    project: 'Sapphire Residences',
    room: 'Unit 3B – Master',
    description: 'Structural crack appearing above door frame — requires engineer review.',
    category: 'structural',
    severity: 'critical',
    reportedBy: 'QC Inspector - Layla',
    assignedTo: 'Structural Team',
    status: 'open',
  },
  {
    id: 'PI005',
    issueNumber: '#005',
    project: 'Azure Bay Villas',
    room: 'Villa A – Living',
    description: 'Socket height inconsistent with design spec — 32 cm instead of 40 cm from FFL.',
    category: 'electrical_coordination',
    severity: 'major',
    reportedBy: 'Khalid Mansour',
    assignedTo: 'MEP Sub-contractor',
    status: 'open',
  },
  {
    id: 'PI006',
    issueNumber: '#006',
    project: 'The Grand Meridian',
    room: 'Penthouse 301',
    description: 'Marble feature wall panel 3B has hairline crack — replace before handover.',
    category: 'finishing',
    severity: 'critical',
    reportedBy: 'QC Inspector - Layla',
    assignedTo: 'Stone Supplier Rep',
    status: 'open',
  },
  {
    id: 'PI007',
    issueNumber: '#007',
    project: 'Azure Bay Villas',
    room: 'Villa C – Exterior',
    description: 'Cladding panel edge sealant gap at northwest corner — weatherproofing risk.',
    category: 'finishing',
    severity: 'major',
    reportedBy: 'Khalid Mansour',
    assignedTo: 'Facade Crew',
    status: 'resolved',
    resolvedDate: '2025-11-03',
  },
  {
    id: 'PI008',
    issueNumber: '#008',
    project: 'Sapphire Residences',
    room: 'Unit 2A – Living',
    description: 'Media unit veneer peeling at bottom left panel — material defect.',
    category: 'furniture_fit',
    severity: 'major',
    reportedBy: 'Dana Yousef',
    assignedTo: 'Joinery Supplier',
    status: 'verified',
    resolvedDate: '2025-11-05',
  },
];

const handoverDossiers: HandoverDossier[] = [
  {
    id: 'HD001',
    projectName: 'The Grand Meridian',
    client: 'Al Meridian Hospitality LLC',
    contractValue: 'SAR 4,250,000',
    rooms: 5,
    openPunchItems: 3,
    criticalOpenItems: 2,
    handoverStatus: 'blocked',
  },
  {
    id: 'HD002',
    projectName: 'Sapphire Residences',
    client: 'Sapphire Living Co.',
    contractValue: 'SAR 2,100,000',
    rooms: 3,
    openPunchItems: 2,
    criticalOpenItems: 1,
    handoverStatus: 'blocked',
  },
  {
    id: 'HD003',
    projectName: 'Azure Bay Villas',
    client: 'Azure Properties',
    contractValue: 'SAR 1,800,000',
    rooms: 3,
    openPunchItems: 1,
    criticalOpenItems: 0,
    handoverStatus: 'ready',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function categoryLabel(cat: PunchCategory): string {
  const map: Record<PunchCategory, string> = {
    finishing: 'Finishing',
    structural: 'Structural',
    furniture_fit: 'Furniture Fit',
    electrical_coordination: 'Electrical',
    painting: 'Painting',
  };
  return map[cat];
}

function severityBadge(severity: PunchSeverity) {
  const map: Record<PunchSeverity, string> = {
    critical: 'bg-red-100 text-red-700 border border-red-300',
    major: 'bg-amber-100 text-amber-700 border border-amber-300',
    minor: 'bg-slate-100 text-slate-600 border border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${map[severity]}`}>
      {severity}
    </span>
  );
}

function punchStatusBadge(status: PunchStatus) {
  const map: Record<PunchStatus, string> = {
    open: 'bg-red-50 text-red-600 border border-red-200',
    in_progress: 'bg-amber-50 text-amber-600 border border-amber-200',
    resolved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    verified: 'bg-green-100 text-green-800 border border-green-300',
  };
  const labels: Record<PunchStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    verified: '✓ Verified',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

function handoverStatusBadge(status: HandoverStatus) {
  const map: Record<HandoverStatus, string> = {
    blocked: 'bg-red-100 text-red-700 border border-red-300 font-bold',
    ready: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
    completed: 'bg-green-100 text-green-800 border border-green-300',
  };
  const labels: Record<HandoverStatus, string> = {
    blocked: '🔴 BLOCKED',
    ready: '✅ Ready',
    completed: '🏆 Completed',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

// ── Summary Bar ───────────────────────────────────────────────────────────────

function PunchSummaryBar({ items }: { items: PunchItem[] }) {
  const totalOpen = items.filter((i) => i.status === 'open' || i.status === 'in_progress').length;
  const criticalOpen = items.filter((i) => i.severity === 'critical' && (i.status === 'open' || i.status === 'in_progress')).length;
  const resolvedThisWeek = items.filter(
    (i) => (i.status === 'resolved' || i.status === 'verified') && i.resolvedDate && i.resolvedDate >= '2025-11-03'
  ).length;

  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: 'Total Open', value: totalOpen, color: 'border-l-amber-400' },
        { label: 'Critical Open', value: criticalOpen, color: 'border-l-red-500' },
        { label: 'Resolved This Week', value: resolvedThisWeek, color: 'border-l-emerald-500' },
      ].map(({ label, value, color }) => (
        <div key={label} className={`bg-white rounded-lg border border-slate-200 shadow-sm p-4 border-l-4 ${color}`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Punch List Tab ────────────────────────────────────────────────────────────

function PunchListTab({ items }: { items: PunchItem[] }) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [criticalOnly, setCriticalOnly] = useState(false);

  const filtered = items.filter((item) => {
    if (criticalOnly && item.severity !== 'critical') return false;
    if (filter === 'open') return item.status === 'open' || item.status === 'in_progress';
    if (filter === 'resolved') return item.status === 'resolved' || item.status === 'verified';
    return true;
  });

  const filters: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'resolved', label: 'Resolved' },
  ];

  return (
    <div className="space-y-5">
      <PunchSummaryBar items={items} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCriticalOnly(!criticalOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            criticalOnly
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white text-red-600 border-red-300 hover:bg-red-50'
          }`}
        >
          🚨 Critical Only
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Issue #', 'Project', 'Room', 'Description', 'Category', 'Severity', 'Reported By', 'Assigned To', 'Status', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-10 text-center text-sm text-slate-400">
                  No punch items match the current filter.
                </td>
              </tr>
            )}
            {filtered.map((item) => (
              <tr
                key={item.id}
                className={`hover:bg-slate-50 transition-colors ${
                  item.severity === 'critical' && (item.status === 'open' || item.status === 'in_progress')
                    ? 'bg-red-50/40'
                    : ''
                }`}
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.issueNumber}</td>
                <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{item.project}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.room}</td>
                <td className="px-4 py-3 text-slate-600 max-w-xs text-xs leading-relaxed">{item.description}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-block bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded border border-emerald-200">
                    {categoryLabel(item.category)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{severityBadge(item.severity)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{item.reportedBy}</td>
                <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{item.assignedTo}</td>
                <td className="px-4 py-3 whitespace-nowrap">{punchStatusBadge(item.status)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button className="text-xs text-emerald-700 font-medium underline underline-offset-2 hover:text-emerald-900">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Handover Dossiers Tab ─────────────────────────────────────────────────────

function HandoverDossiersTab({ dossiers }: { dossiers: HandoverDossier[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {['Project Name', 'Client', 'Contract Value', 'Rooms', 'Open Punch Items', 'Handover Status', 'Action'].map(
              (h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {dossiers.map((d) => (
            <tr
              key={d.id}
              className={`hover:bg-slate-50 transition-colors ${d.handoverStatus === 'blocked' ? 'bg-red-50/30' : ''}`}
            >
              <td className="px-5 py-4 font-semibold text-slate-800">{d.projectName}</td>
              <td className="px-5 py-4 text-slate-600">{d.client}</td>
              <td className="px-5 py-4 font-mono text-slate-700 font-medium">{d.contractValue}</td>
              <td className="px-5 py-4 text-center text-slate-700">{d.rooms}</td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-800 font-semibold">{d.openPunchItems}</span>
                  {d.criticalOpenItems > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded font-semibold">
                      {d.criticalOpenItems} critical
                    </span>
                  )}
                </div>
              </td>
              <td className="px-5 py-4">{handoverStatusBadge(d.handoverStatus)}</td>
              <td className="px-5 py-4">
                {d.handoverStatus === 'completed' ? (
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 transition-colors">
                    <Award className="w-3.5 h-3.5" />
                    View Certificate
                  </button>
                ) : (
                  <button
                    disabled={d.handoverStatus === 'blocked'}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      d.handoverStatus === 'blocked'
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Generate Dossier
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TabKey = 'punch' | 'handover';

export default function QCHandoverPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('punch');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'punch', label: 'Punch List' },
    { key: 'handover', label: 'Handover Dossiers' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">QC &amp; Handover</h1>
        <p className="text-sm text-slate-500">
          Manage quality control punch lists and prepare client handover dossiers and completion certificates.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0" aria-label="Tabs">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'punch' && <PunchListTab items={punchItems} />}
      {activeTab === 'handover' && <HandoverDossiersTab dossiers={handoverDossiers} />}
    </div>
  );
}
