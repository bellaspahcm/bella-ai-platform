'use client';

import { useState } from 'react';

// ─── TypeScript Interfaces ──────────────────────────────────────────────────

type CertificateStatus = 'active' | 'expiring_soon' | 'expired';

interface WarrantyCertificateRow {
  certificateNo: string;
  project: string;
  client: string;
  handoverDate: string; // ISO date string
  warrantyExpires: string; // ISO date string
  coverage: string;
  status: CertificateStatus;
}

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type IssueCategory = 'structural' | 'finishing' | 'mechanical' | 'electrical';
type TicketPriority = 'urgent' | 'high' | 'medium' | 'low';

interface WarrantyTicketRow {
  ticketNo: string;
  project: string;
  client: string;
  reportedDate: string;
  category: IssueCategory;
  description: string;
  priority: TicketPriority;
  assignedTechnician: string;
  status: TicketStatus;
  scheduledVisit: string | null;
  resolvedDate: string | null;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_CERTIFICATES: WarrantyCertificateRow[] = [
  {
    certificateNo: 'WC-2024-001',
    project: 'Villa Harmonia — Full Interior',
    client: 'Siti Rahayu',
    handoverDate: '2024-03-15',
    warrantyExpires: '2027-03-15',
    coverage: 'Structural works, built-in furniture, paintwork',
    status: 'active',
  },
  {
    certificateNo: 'WC-2024-002',
    project: 'The Orchard Penthouse',
    client: 'Budi Santoso',
    handoverDate: '2024-07-01',
    warrantyExpires: '2026-07-01',
    coverage: 'Flooring, kitchen cabinetry, lighting installation',
    status: 'active',
  },
  {
    certificateNo: 'WC-2023-005',
    project: 'Sunrise Mall Food Court Reno',
    client: 'Sunrise Mall Management',
    handoverDate: '2023-11-20',
    warrantyExpires: '2025-11-20',
    coverage: 'Wall cladding, ceiling, electrical fixtures',
    status: 'expiring_soon',
  },
  {
    certificateNo: 'WC-2022-003',
    project: 'Kaffah Headquarters L3',
    client: 'PT Kaffah Properti',
    handoverDate: '2022-05-10',
    warrantyExpires: '2024-05-10',
    coverage: 'Partitions, carpeting, raised flooring',
    status: 'expired',
  },
  {
    certificateNo: 'WC-2024-003',
    project: 'Greenview Boutique Hotel — Lobby',
    client: 'CV Greenview Resort',
    handoverDate: '2024-09-05',
    warrantyExpires: '2026-09-05',
    coverage: 'Feature walls, bespoke joinery, stone flooring',
    status: 'active',
  },
];

const MOCK_TICKETS: WarrantyTicketRow[] = [
  {
    ticketNo: 'WT-2026-0041',
    project: 'Villa Harmonia — Full Interior',
    client: 'Siti Rahayu',
    reportedDate: '2026-11-01',
    category: 'finishing',
    description: 'Paint peeling on master bedroom accent wall, approx. 2 m².',
    priority: 'medium',
    assignedTechnician: 'Dian Pratama',
    status: 'in_progress',
    scheduledVisit: '2026-11-08',
    resolvedDate: null,
  },
  {
    ticketNo: 'WT-2026-0040',
    project: 'Greenview Boutique Hotel — Lobby',
    client: 'CV Greenview Resort',
    reportedDate: '2026-10-28',
    category: 'mechanical',
    description: 'Sliding door mechanism jammed — unable to close fully.',
    priority: 'urgent',
    assignedTechnician: 'Reza Firmansyah',
    status: 'open',
    scheduledVisit: '2026-11-06',
    resolvedDate: null,
  },
  {
    ticketNo: 'WT-2026-0039',
    project: 'The Orchard Penthouse',
    client: 'Budi Santoso',
    reportedDate: '2026-10-20',
    category: 'electrical',
    description: 'Under-cabinet kitchen lights flickering on zone B.',
    priority: 'high',
    assignedTechnician: 'Dian Pratama',
    status: 'resolved',
    scheduledVisit: '2026-10-24',
    resolvedDate: '2026-10-24',
  },
  {
    ticketNo: 'WT-2026-0038',
    project: 'Sunrise Mall Food Court Reno',
    client: 'Sunrise Mall Management',
    reportedDate: '2026-10-15',
    category: 'structural',
    description: 'Hairline crack appearing at junction of dropped ceiling and column cladding.',
    priority: 'high',
    assignedTechnician: 'Andi Surya',
    status: 'resolved',
    scheduledVisit: '2026-10-18',
    resolvedDate: '2026-10-20',
  },
  {
    ticketNo: 'WT-2026-0037',
    project: 'The Orchard Penthouse',
    client: 'Budi Santoso',
    reportedDate: '2026-10-10',
    category: 'finishing',
    description: 'Wardrobe door alignment off — door dragging on bottom track.',
    priority: 'low',
    assignedTechnician: 'Reza Firmansyah',
    status: 'resolved',
    scheduledVisit: '2026-10-14',
    resolvedDate: '2026-10-14',
  },
];

// ─── Helper Utilities ───────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysUntil(isoDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Badge Components ────────────────────────────────────────────────────────

function CertStatusBadge({ status }: { status: CertificateStatus }) {
  const styles: Record<CertificateStatus, string> = {
    active: 'bg-sky-100 text-sky-700',
    expiring_soon: 'bg-orange-100 text-orange-700',
    expired: 'bg-gray-200 text-gray-500',
  };
  const labels: Record<CertificateStatus, string> = {
    active: 'Active',
    expiring_soon: 'Expiring Soon',
    expired: 'Expired',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const styles: Record<TicketPriority, string> = {
    urgent: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${styles[priority]}`}>
      {priority}
    </span>
  );
}

function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-sky-100 text-sky-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<TicketStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function CategoryBadge({ category }: { category: IssueCategory }) {
  const styles: Record<IssueCategory, string> = {
    structural: 'bg-purple-100 text-purple-700',
    finishing: 'bg-pink-100 text-pink-700',
    mechanical: 'bg-blue-100 text-blue-700',
    electrical: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${styles[category]}`}>
      {category}
    </span>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

type TabId = 'certificates' | 'tickets';

// ─── Certificates Tab ─────────────────────────────────────────────────────────

function CertificatesTab() {
  const rows = MOCK_CERTIFICATES.map((cert) => {
    const days = daysUntil(cert.warrantyExpires);
    return { ...cert, daysLeft: days };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-sky-50 text-xs font-semibold text-sky-700 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Certificate #</th>
              <th className="px-4 py-3 text-left">Project</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Handover Date</th>
              <th className="px-4 py-3 text-left">Warranty Expires</th>
              <th className="px-4 py-3 text-left">Coverage</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.certificateNo} className="hover:bg-sky-50/40 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-sky-700 font-semibold">
                  {row.certificateNo}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{row.project}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{row.client}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(row.handoverDate)}</td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{formatDate(row.warrantyExpires)}</p>
                  {row.daysLeft > 0 && row.status !== 'expired' && (
                    <p className={`text-xs mt-0.5 ${row.daysLeft <= 90 ? 'text-orange-500' : 'text-gray-400'}`}>
                      {row.daysLeft}d remaining
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs text-xs">{row.coverage}</td>
                <td className="px-4 py-3 text-center">
                  <CertStatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Service Tickets Tab ──────────────────────────────────────────────────────

type TicketFilter = TicketStatus | 'all';

function ServiceTicketsTab() {
  const [statusFilter, setStatusFilter] = useState<TicketFilter>('all');

  const filtered =
    statusFilter === 'all'
      ? MOCK_TICKETS
      : MOCK_TICKETS.filter((t) => t.status === statusFilter);

  const openCount = MOCK_TICKETS.filter((t) => t.status === 'open').length;
  const urgentCount = MOCK_TICKETS.filter((t) => t.priority === 'urgent').length;
  const resolvedThisMonth = MOCK_TICKETS.filter(
    (t) =>
      t.status === 'resolved' &&
      t.resolvedDate !== null &&
      new Date(t.resolvedDate).getMonth() === new Date().getMonth()
  ).length;

  const filterOptions: { label: string; value: TicketFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Resolved', value: 'resolved' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{openCount}</p>
          <p className="text-xs text-blue-600 font-medium mt-0.5">Open Tickets</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-red-700">{urgentCount}</p>
          <p className="text-xs text-red-600 font-medium mt-0.5">Urgent</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-emerald-700">{resolvedThisMonth}</p>
          <p className="text-xs text-emerald-600 font-medium mt-0.5">Resolved This Month</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === opt.value
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-sky-50 hover:border-sky-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tickets table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-sky-50 text-xs font-semibold text-sky-700 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Ticket #</th>
                <th className="px-4 py-3 text-left">Project / Client</th>
                <th className="px-4 py-3 text-left">Reported</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-center">Priority</th>
                <th className="px-4 py-3 text-left">Technician</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Scheduled Visit</th>
                <th className="px-4 py-3 text-left">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No tickets match the selected filter.
                  </td>
                </tr>
              )}
              {filtered.map((ticket) => (
                <tr key={ticket.ticketNo} className="hover:bg-sky-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-sky-700 font-semibold whitespace-nowrap">
                    {ticket.ticketNo}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-xs leading-snug">{ticket.project}</p>
                    <p className="text-xs text-gray-400">{ticket.client}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {formatDate(ticket.reportedDate)}
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={ticket.category} />
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs text-xs">{ticket.description}</td>
                  <td className="px-4 py-3 text-center">
                    <PriorityBadge priority={ticket.priority} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                    {ticket.assignedTechnician}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <TicketStatusBadge status={ticket.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                    {ticket.scheduledVisit ? formatDate(ticket.scheduledVisit) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                    {ticket.resolvedDate ? formatDate(ticket.resolvedDate) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function WarrantyPage() {
  const [activeTab, setActiveTab] = useState<TabId>('certificates');

  const expiringCount = MOCK_CERTIFICATES.filter((c) => c.status === 'expiring_soon').length;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'certificates', label: 'Certificates' },
    { id: 'tickets', label: 'Service Tickets' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warranty &amp; Aftercare</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage warranty certificates, track service tickets, and coordinate aftercare for
            completed interior projects.
          </p>
        </div>
        {expiringCount > 0 && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <span className="text-orange-500 text-lg">⚠️</span>
            <span className="text-sm font-medium text-orange-700">
              {expiringCount} certificate{expiringCount !== 1 ? 's' : ''} expiring within 90 days
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'certificates' && <CertificatesTab />}
      {activeTab === 'tickets' && <ServiceTicketsTab />}
    </div>
  );
}
