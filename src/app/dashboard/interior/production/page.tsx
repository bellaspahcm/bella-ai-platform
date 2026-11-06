'use client';

import React, { useState, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProductionStage =
  | 'design_locked'
  | 'cutting_cnc'
  | 'edge_banding'
  | 'assembly'
  | 'workshop_qc'
  | 'packing'
  | 'dispatched';

interface ProductionOrderRow {
  id: string;
  orderNumber: string;
  project: string;
  description: string;
  stage: ProductionStage;
  assignedCraftsman: string;
  startDate: string;
  targetDate: string;
  percentComplete: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: { key: ProductionStage; label: string }[] = [
  { key: 'design_locked', label: 'Design Locked' },
  { key: 'cutting_cnc', label: 'Cutting / CNC' },
  { key: 'edge_banding', label: 'Edge Banding' },
  { key: 'assembly', label: 'Assembly' },
  { key: 'workshop_qc', label: 'Workshop QC' },
  { key: 'packing', label: 'Packing' },
  { key: 'dispatched', label: 'Dispatched' },
];

const STAGE_BADGE_STYLES: Record<ProductionStage, string> = {
  design_locked: 'bg-zinc-100 text-zinc-600',
  cutting_cnc: 'bg-blue-100 text-blue-700',
  edge_banding: 'bg-indigo-100 text-indigo-700',
  assembly: 'bg-yellow-100 text-yellow-700',
  workshop_qc: 'bg-orange-100 text-orange-700',
  packing: 'bg-purple-100 text-purple-700',
  dispatched: 'bg-green-100 text-green-700',
};

const STAGE_PIPELINE_STYLES: Record<ProductionStage, string> = {
  design_locked: 'bg-zinc-200 text-zinc-700 border-zinc-300',
  cutting_cnc: 'bg-blue-100 text-blue-700 border-blue-300',
  edge_banding: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  assembly: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  workshop_qc: 'bg-orange-100 text-orange-700 border-orange-300',
  packing: 'bg-purple-100 text-purple-700 border-purple-300',
  dispatched: 'bg-green-100 text-green-700 border-green-300',
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const PRODUCTION_ORDERS: ProductionOrderRow[] = [
  {
    id: 'PO-001',
    orderNumber: 'WO-2024-0101',
    project: 'Al Noor Villa',
    description: 'Master Bedroom Wardrobe Set — 4 panels, MDF lacquered',
    stage: 'assembly',
    assignedCraftsman: 'Khalid Hassan',
    startDate: '2024-05-01',
    targetDate: '2024-05-20',
    percentComplete: 65,
  },
  {
    id: 'PO-002',
    orderNumber: 'WO-2024-0102',
    project: 'Al Noor Villa',
    description: 'Kitchen Cabinets — Upper & Lower, White Matte',
    stage: 'cutting_cnc',
    assignedCraftsman: 'Mohammed Yusuf',
    startDate: '2024-05-05',
    targetDate: '2024-05-25',
    percentComplete: 30,
  },
  {
    id: 'PO-003',
    orderNumber: 'WO-2024-0103',
    project: 'Skyline Penthouse',
    description: 'Living Room TV Unit — Walnut veneer, LED back',
    stage: 'workshop_qc',
    assignedCraftsman: 'Ahmed Salem',
    startDate: '2024-04-20',
    targetDate: '2024-05-10',
    percentComplete: 90,
  },
  {
    id: 'PO-004',
    orderNumber: 'WO-2024-0104',
    project: 'Skyline Penthouse',
    description: "Dining Room Buffet — Marble top, Oak frame",
    stage: 'edge_banding',
    assignedCraftsman: 'Khalid Hassan',
    startDate: '2024-05-08',
    targetDate: '2024-05-28',
    percentComplete: 45,
  },
  {
    id: 'PO-005',
    orderNumber: 'WO-2024-0105',
    project: 'Desert Rose Resort',
    description: 'Reception Desk — Curved, Corian surface',
    stage: 'design_locked',
    assignedCraftsman: 'Rami Jaber',
    startDate: '2024-05-15',
    targetDate: '2024-06-15',
    percentComplete: 5,
  },
  {
    id: 'PO-006',
    orderNumber: 'WO-2024-0106',
    project: 'Desert Rose Resort',
    description: 'Lobby Feature Wall — CNC carved panels x12',
    stage: 'design_locked',
    assignedCraftsman: 'Tariq Al Rasheed',
    startDate: '2024-05-18',
    targetDate: '2024-06-25',
    percentComplete: 0,
  },
  {
    id: 'PO-007',
    orderNumber: 'WO-2024-0097',
    project: 'Marina Office',
    description: 'Executive Desk Set — Glass & Walnut, 3 units',
    stage: 'packing',
    assignedCraftsman: 'Mohammed Yusuf',
    startDate: '2024-04-10',
    targetDate: '2024-05-05',
    percentComplete: 95,
  },
  {
    id: 'PO-008',
    orderNumber: 'WO-2024-0088',
    project: 'Marina Office',
    description: 'Open Shelving System — Powder coated steel',
    stage: 'dispatched',
    assignedCraftsman: 'Ahmed Salem',
    startDate: '2024-03-25',
    targetDate: '2024-04-20',
    percentComplete: 100,
  },
  {
    id: 'PO-009',
    orderNumber: 'WO-2024-0108',
    project: 'Garden Villas Phase 2',
    description: "Master Bath Vanity — Double basin, Honed marble",
    stage: 'cutting_cnc',
    assignedCraftsman: 'Rami Jaber',
    startDate: '2024-05-12',
    targetDate: '2024-06-01',
    percentComplete: 20,
  },
  {
    id: 'PO-010',
    orderNumber: 'WO-2024-0109',
    project: 'Garden Villas Phase 2',
    description: 'Kids Room Bunk Beds x3 — Birch ply, painted',
    stage: 'assembly',
    assignedCraftsman: 'Tariq Al Rasheed',
    startDate: '2024-05-10',
    targetDate: '2024-05-30',
    percentComplete: 55,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStageLabel(key: ProductionStage): string {
  return STAGES.find((s) => s.key === key)?.label ?? key;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const color =
    value >= 90 ? 'bg-green-500' : value >= 60 ? 'bg-amber-400' : value >= 30 ? 'bg-blue-400' : 'bg-zinc-300';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-zinc-500 font-mono w-7 text-right">{value}%</span>
    </div>
  );
}

// ─── Kanban Pipeline Card ─────────────────────────────────────────────────────

function PipelineCard({ stage, count }: { stage: ProductionStage; count: number }) {
  const label = getStageLabel(stage);
  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col items-center gap-1 min-w-[100px] ${STAGE_PIPELINE_STYLES[stage]}`}>
      <span className="text-2xl font-bold">{count}</span>
      <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductionPage() {
  const [stageFilter, setStageFilter] = useState<ProductionStage | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const stageCounts = useMemo<Record<ProductionStage, number>>(() => {
    const counts = {} as Record<ProductionStage, number>;
    for (const s of STAGES) counts[s.key] = 0;
    for (const order of PRODUCTION_ORDERS) counts[order.stage] += 1;
    return counts;
  }, []);

  const filteredOrders = useMemo(() => {
    return PRODUCTION_ORDERS.filter((order) => {
      const matchesStage = stageFilter === 'all' || order.stage === stageFilter;
      const matchesSearch =
        searchQuery.trim() === '' ||
        order.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStage && matchesSearch;
    });
  }, [stageFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Workshop Production</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Track all production orders across workshop stages</p>
      </div>

      {/* Kanban Pipeline */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 p-5 mb-8">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">Stage Pipeline</h2>
        <div className="flex flex-wrap gap-3">
          {STAGES.map((s, i) => (
            <React.Fragment key={s.key}>
              <PipelineCard stage={s.key} count={stageCounts[s.key]} />
              {i < STAGES.length - 1 && (
                <div className="flex items-center text-zinc-300 font-light text-xl self-center">›</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 px-5 py-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-zinc-600 whitespace-nowrap">Filter by Stage:</label>
          <select
            className="border border-zinc-200 rounded-lg text-sm px-3 py-1.5 text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as ProductionStage | 'all')}
          >
            <option value="all">All Stages</option>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-zinc-600 whitespace-nowrap">Search Project:</label>
          <input
            type="text"
            placeholder="Project name or order #"
            className="border border-zinc-200 rounded-lg text-sm px-3 py-1.5 text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 flex-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <span className="text-xs text-zinc-400 ml-auto">{filteredOrders.length} orders</span>
      </div>

      {/* Production Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-700">Production Orders</h2>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + New Order
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-xs text-zinc-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Order #</th>
                <th className="px-4 py-3 text-left">Project</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Craftsman</th>
                <th className="px-4 py-3 text-left">Start Date</th>
                <th className="px-4 py-3 text-left">Target Date</th>
                <th className="px-4 py-3 text-left">Progress</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-zinc-400 text-sm">
                    No production orders match the current filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => (
                  <tr
                    key={order.id}
                    className={`border-t border-zinc-50 hover:bg-zinc-50/80 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{order.orderNumber}</td>
                    <td className="px-4 py-3 font-medium text-zinc-800 whitespace-nowrap">{order.project}</td>
                    <td className="px-4 py-3 text-zinc-600 max-w-[220px] truncate" title={order.description}>
                      {order.description}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STAGE_BADGE_STYLES[order.stage]}`}
                      >
                        {getStageLabel(order.stage)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{order.assignedCraftsman}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{formatDate(order.startDate)}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{formatDate(order.targetDate)}</td>
                    <td className="px-4 py-3">
                      <ProgressBar value={order.percentComplete} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="text-indigo-600 hover:text-indigo-800 font-medium text-xs underline underline-offset-2">
                          View
                        </button>
                        <button className="text-zinc-400 hover:text-zinc-700 font-medium text-xs underline underline-offset-2">
                          Update
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
